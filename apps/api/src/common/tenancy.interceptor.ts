import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { TenancyService } from "./tenancy";
import type { AuthUser } from "./types";

/**
 * Runs the entire downstream request chain inside the AsyncLocalStorage tenant
 * context. Guards (JwtAuthGuard) populate `req.user` first; this interceptor
 * then makes `TenancyService.getTenantId()` reliable for every service call.
 */
@Injectable()
export class TenancyInterceptor implements NestInterceptor {
  constructor(private readonly tenancy: TenancyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (req.user) {
      return this.tenancy.run(
        { tenantId: req.user.tenantId, user: req.user },
        () => next.handle(),
      );
    }
    return next.handle();
  }
}
