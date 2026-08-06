import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Writes an audit trail row for every significant action. Tenant and user are
 * resolved from the AsyncLocalStorage request context — never from caller input.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const ctx = this.tenancy.getContext();
    if (!ctx) return; // unauthenticated/system actions skip the tenant audit trail
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta ? JSON.parse(JSON.stringify(entry.meta)) : undefined,
      },
    });
  }
}
