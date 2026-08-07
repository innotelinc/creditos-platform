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
 * Full feature block unless the tenant has an active paid subscription. There
 * are no free trials — a brand-new workspace has no subscription at all, so
 * every core endpoint — reports, analysis, letters, disputes, documents,
 * dashboard, CRM, user management — returns 402 Payment Required until the
 * first plan is paid. Canceled/expired subscriptions are blocked too.
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

    // No free trials: only an ACTIVE subscription grants access. New tenants
    // have no subscription row at all, so they are blocked until first payment.
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: user.tenantId } });
    const blocked = !sub || sub.status !== SubscriptionStatus.ACTIVE;

    if (blocked) {
      throw new HttpException(
        { statusCode: HttpStatus.PAYMENT_REQUIRED, message: "Your workspace isn't on an active plan — choose a plan to continue." },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
