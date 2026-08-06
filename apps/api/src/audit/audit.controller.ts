import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { Permissions } from "../common/decorators";
import { IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

class AuditQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;
}

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit")
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
  ) {}

  @Get()
  @Permissions("viewAudit")
  @ApiOperation({ summary: "Tenant audit trail (admins)" })
  async list(@Query() query: AuditQueryDto) {
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (query.action) where.action = { contains: query.action, mode: "insensitive" };
    if (query.entity) where.entity = query.entity;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, limit: query.limit, offset: query.offset };
  }
}
