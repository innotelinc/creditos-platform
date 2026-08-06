import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthUser, TenantContext } from "./types";

/**
 * Tenant isolation via AsyncLocalStorage. Each request's tenant context is
 * entered by the JWT guard; services read `getTenantId()` to scope queries.
 * This is the enforcement point for multi-tenant data isolation.
 */
@Injectable()
export class TenancyService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  /** Wraps downstream execution in the tenant context (reliable ALS propagation). */
  run<T>(ctx: TenantContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  enter(user: AuthUser): void {
    this.storage.enterWith({ tenantId: user.tenantId, user });
  }

  getContext(): TenantContext | undefined {
    return this.storage.getStore();
  }

  getTenantId(): string {
    const ctx = this.storage.getStore();
    if (!ctx) throw new Error("No tenant context — request is not authenticated");
    return ctx.tenantId;
  }

  getUser(): AuthUser {
    const ctx = this.storage.getStore();
    if (!ctx) throw new Error("No tenant context — request is not authenticated");
    return ctx.user;
  }

  /**
   * Own-data scope for CLIENT role users. Returns a Prisma where fragment
   * ({ clientId: <user.id> }) that forces queries to only touch the client's
   * own records; returns undefined for staff so tenant-wide scoping applies.
   * Spread into any where clause touching client-owned data.
   */
  getClientScope(): { clientId: string } | undefined {
    // Degrades to tenant-wide scope when called outside a request context
    // (e.g. from a background worker) instead of throwing.
    const ctx = this.storage.getStore();
    if (!ctx) return undefined;
    return ctx.user.role === "CLIENT" ? { clientId: ctx.user.id } : undefined;
  }
}
