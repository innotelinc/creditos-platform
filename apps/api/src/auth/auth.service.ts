import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role, User, UserStatus, TenantPlan, SubscriptionStatus } from "@prisma/client";
import { authenticator } from "otplib";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";
import { MailService } from "../notifications/mail.service";
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TotpDisableDto,
  TotpVerifyDto,
} from "./dto";
import type { AccessTokenPayload } from "./jwt.strategy";

export interface AuthResult {
  user: Omit<User, "passwordHash" | "totpSecret">;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto, ip?: string, userAgent?: string): Promise<AuthResult> {
    let tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug, plan: TenantPlan.TRIAL },
      });
      this.logger.log(`Created tenant ${tenant.slug}`);
    }

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() } },
    });
    if (existing) throw new BadRequestException("An account with this email already exists in this agency");

    const userCount = await this.prisma.user.count({ where: { tenantId: tenant.id } });
    const passwordHash = await bcrypt.hash(dto.password, 12);
    // First user of a tenant becomes ADMIN — practical bootstrap for new agencies.
    // Consumer signups (model=CONSUMER) are always CLIENT.
    const role = dto.model === "CONSUMER" || userCount > 0 ? Role.CLIENT : Role.ADMIN;
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
      },
    });

    const trialDays = this.config.get<number>("TRIAL_DAYS") ?? 3;
    // Start a trial for new tenants (length configurable via TRIAL_DAYS)
    if (tenant.plan === TenantPlan.TRIAL && userCount === 0) {
      const trialEnds = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      await this.prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planCode: "TRIAL",
          status: SubscriptionStatus.TRIALING,
          provider: "local",
          trialEndsAt: trialEnds,
        },
      });
      this.logger.log(`Started ${trialDays}-day trial for ${tenant.slug} (ends ${trialEnds.toISOString()})`);
    }

    await this.mail.send(
      user.email,
      "Welcome to CreditOS",
      `<p>Hi ${user.name},</p><p>Your <strong>${tenant.name}</strong> account is ready. You have a ${trialDays}-day free trial to explore all features. Sign in at ${this.config.get("APP_URL")}/login.</p>`,
    );

    return this.issueTokens(user, ip, userAgent);
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException("Invalid email or password");
    if (user.status === UserStatus.DISABLED) throw new UnauthorizedException("This account has been disabled");
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid email or password");

    if (user.totpEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: "Two-factor code required",
          code: "TOTP_REQUIRED",
        });
      }
      if (!authenticator.verify({ token: dto.totpCode, secret: user.totpSecret ?? "" })) {
        throw new UnauthorizedException("Invalid two-factor code");
      }
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(user, ip, userAgent);
  }

  async refresh(refreshToken: string | undefined, ip?: string, userAgent?: string): Promise<AuthResult> {
    if (!refreshToken) throw new UnauthorizedException("Refresh token missing");
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired or revoked");
    }
    // Rotation: revoke the old token, issue a new one.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: stored.id },
    });
    return this.issueTokens(stored.user, ip, userAgent);
  }

  async logout(refreshToken: string | undefined): Promise<{ success: true }> {
    if (refreshToken) {
      const hash = this.tokens.hashRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException("Current password is incorrect");
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalidate all sessions on password change.
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, appUrl: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email.toLowerCase() } });
    // Always succeed to avoid user enumeration.
    if (user) {
      const token = this.tokens.generateResetToken(user.id);
      const link = `${appUrl}/reset-password?token=${token}`;
      await this.mail.send(
        user.email,
        "Reset your CreditOS password",
        `<p>Hi ${user.name},</p><p>Reset your password here: <a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
      );
      this.logger.log(`Password reset requested for ${user.email}`);
    }
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const userId = this.tokens.verifyResetToken(dto.token);
    if (!userId) throw new BadRequestException("Invalid or expired reset token");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("Invalid reset token");
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  async enableTotp(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, "CreditOS", secret);
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    return { secret, otpauthUrl };
  }

  async verifyTotp(userId: string, dto: TotpVerifyDto): Promise<{ success: true; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) throw new BadRequestException("2FA not initialized");
    if (!authenticator.verify({ token: dto.code, secret: user.totpSecret })) {
      throw new BadRequestException("Invalid verification code");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return { success: true, backupCodes: [this.tokens.generateOtp(), this.tokens.generateOtp()] };
  }

  async disableTotp(userId: string, dto: TotpDisableDto): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) throw new BadRequestException("2FA not enabled");
    if (!authenticator.verify({ token: dto.code, secret: user.totpSecret })) {
      throw new BadRequestException("Invalid code");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } });
    return { success: true };
  }

  async sessions(userId: string) {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
    });
    return { items: rows };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true, brandColor: true, settings: true } } },
    });
    if (!user) throw new UnauthorizedException();
    const { passwordHash, totpSecret, tenant, ...safe } = user;
    // Shape matches the web app's AuthSession: { user, tenant }.
    return { user: safe, tenant };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async issueTokens(user: User, ip?: string, userAgent?: string): Promise<AuthResult> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      isSuperAdmin: user.isSuperAdmin,
    };
    const expiresIn = this.config.get<number>("JWT_ACCESS_TTL") ?? 900;
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET"),
      expiresIn,
    });

    const refreshToken = this.tokens.generateRefreshToken();
    const refreshTtl = this.config.get<number>("JWT_REFRESH_TTL") ?? 2_592_000;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        ip,
        userAgent: userAgent?.slice(0, 200),
      },
    });

    const { passwordHash: _p, totpSecret: _t, ...safe } = user;
    return { user: safe, accessToken, refreshToken, expiresIn };
  }

}
