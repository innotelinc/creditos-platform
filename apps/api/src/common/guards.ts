import { Injectable, UnauthorizedException, ForbiddenException, CanActivate, ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Role } from "@prisma/client";
import { TenancyService } from "./tenancy";
import { hasPermission, type AuthUser, type Permission } from "./types";
import { IS_PUBLIC_KEY, ROLES_KEY, PERMISSIONS_KEY } from "./decorators";

/**
 * Global JWT guard. Resolves the tenant context (AsyncLocalStorage) so every
 * downstream service can scope queries to the authenticated tenant.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenancy: TenancyService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(err: unknown, user: unknown, info: unknown): TUser {
    if (err || !user) {
      this.logger.debug(`Auth rejected: ${String((info as Error)?.message ?? err)}`);
      throw err instanceof Error ? err : new UnauthorizedException("Invalid or expired session");
    }
    this.tenancy.enter(user as AuthUser);
    return user as TUser;
  }
}

/** Enforces @Roles(...) metadata. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException("Not authenticated");
    if (user.isSuperAdmin || required.includes(user.role as Role)) return true;
    throw new ForbiddenException(`Requires role: ${required.join(" or ")}`);
  }
}

/** Enforces @Permissions(...) metadata via the RBAC matrix. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException("Not authenticated");
    const ok = required.every((p) => hasPermission(user.role as Role, p));
    if (ok) return true;
    throw new ForbiddenException("You do not have permission to perform this action");
  }
}
