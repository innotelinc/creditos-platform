import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./decorators";
import type { AuthUser } from "./types";

/**
 * Routes that must stay reachable even when a tenant's trial has expired:
 * auth, billing (so users can re-subscribe), pricing catalog, health,
 * settings (profile / branding), notifications (so the re-prompt shows),
 * platform admin, the public knowledge base and contact form.
 */
const EXEMPT_PREFIXES = [
  "/v1/auth",
  "/v1/billing",
  "/v1/pricing",
  "/v1/users/me",
  "/v1/tenants/me",
  "/v1/notifications",
  "/v1/admin",
  "/v1/knowledge",
  "/v1/contact",
  "/docs",
  "/health",
];

/**
 * Full feature block for expired trials: once a tenant's subscription is
 * EXPIRED (trial ended without conversion), every core endpoint — reports,
 * analysis, letters, disputes, documents, dashboard, CRM, user management —
 * returns 402 Payment Required until a paid plan is chosen.
 *
 * Runs after JwtAuthGuard so `req.user` is populated. Public routes, super
 * admins, and the exempt prefixes above pass through.
 */
@Injectable()
export class SubscriptionGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser; path?: string }>();
    const user = req.user;
    if (!user) return true; // unauthenticated — JwtAuthGuard rejects
    if (user.isSuperAdmin) return true;

    const path = req.path ?? "";
    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: user.tenantId } });
    const now = new Date();
    // A TRIALING row whose trialEndsAt has passed is treated as expired even
    // before the hourly sweep flips it — no window of un-gated access.
    const blocked =
      sub?.status === SubscriptionStatus.EXPIRED ||
      (sub?.status === SubscriptionStatus.TRIALING &&
        !!sub.trialEndsAt &&
        sub.trialEndsAt < now);

    if (blocked) {
      throw new HttpException(
        { statusCode: HttpStatus.PAYMENT_REQUIRED, message: "Your trial has ended — choose a plan to continue." },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
