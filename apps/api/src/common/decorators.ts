import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Permission } from "./types";

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";
export const PERMISSIONS_KEY = "permissions";

/** Marks a route as public (skips JWT auth). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles (SUPER_ADMIN always passes). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Restricts a route to roles that hold the given permission. */
export const Permissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Current authenticated user from the JWT. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as { id: string; email: string; name: string; role: Role; tenantId: string; isSuperAdmin: boolean };
});

/** Raw express request (ip / user-agent). */
export const Req = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest());
