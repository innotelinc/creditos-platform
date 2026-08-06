import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "../common/decorators";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  TotpDisableDto,
  TotpVerifyDto,
} from "./dto";
import { AuthUser } from "../common/types";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Create account (bootstraps a new agency when the slug is new)" })
  register(
    @Body() dto: RegisterDto,
    @Req() req: { ip: string; headers: Record<string, string> },
  ) {
    return this.auth.register(dto, req.ip, req.headers["user-agent"]);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Sign in. Returns access + refresh tokens (refresh rotates on use)." })
  login(@Body() dto: LoginDto, @Req() req: { ip: string; headers: Record<string, string> }) {
    return this.auth.login(dto, req.ip, req.headers["user-agent"]);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate refresh token → new token pair" })
  refresh(@Body() dto: RefreshDto, @Req() req: { ip: string; headers: Record<string, string> }) {
    const token = dto.refreshToken ?? req.headers["x-refresh-token"];
    return this.auth.refresh(token, req.ip, req.headers["user-agent"]);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke the current refresh token" })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Send password reset email (never reveals whether the email exists)" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto, process.env.APP_URL ?? "http://localhost:3000");
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set a new password using a reset token" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Current user + tenant profile" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change password (invalidates all sessions)" })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Post("totp/generate")
  @ApiOperation({ summary: "Start 2FA enrollment — returns secret + otpauth URL" })
  generateTotp(@CurrentUser() user: AuthUser) {
    return this.auth.enableTotp(user.id);
  }

  @ApiBearerAuth()
  @Post("totp/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm a TOTP code to enable 2FA" })
  verifyTotp(@CurrentUser() user: AuthUser, @Body() dto: TotpVerifyDto) {
    return this.auth.verifyTotp(user.id, dto);
  }

  @ApiBearerAuth()
  @Post("totp/disable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disable 2FA with a valid code" })
  disableTotp(@CurrentUser() user: AuthUser, @Body() dto: TotpDisableDto) {
    return this.auth.disableTotp(user.id, dto);
  }

  @ApiBearerAuth()
  @Get("sessions")
  @ApiOperation({ summary: "Active sessions (device management)" })
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.sessions(user.id);
  }
}
