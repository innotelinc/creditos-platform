import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, Role, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { CreateUserDto, UpdateUserDto } from "../auth/dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) throw new NotFoundException("User not found");
    const { passwordHash, totpSecret, ...safe } = user;
    return safe;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const { passwordHash: _p, totpSecret: _t, ...safe } = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
    });
    await this.audit.log({ action: "user.profile.updated", entity: "User", entityId: userId });
    return safe;
  }

  async list(query: { role?: Role; search?: string; limit?: number; offset?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.UserWhereInput = { tenantId };
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          phone: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async create(dto: CreateUserDto) {
    const tenantId = this.tenancy.getTenantId();
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new BadRequestException("A user with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: dto.name,
        passwordHash,
        role: dto.role as Role,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
    await this.audit.log({
      action: "user.created",
      entity: "User",
      entityId: user.id,
      meta: { role: user.role },
    });
    return user;
  }

  async updateRole(userId: string, role: Role) {
    const tenantId = this.tenancy.getTenantId();
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) throw new NotFoundException("User not found");
    if (target.isSuperAdmin) throw new BadRequestException("Cannot change a super admin's role");

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    await this.audit.log({ action: "user.role.updated", entity: "User", entityId: userId, meta: { role } });
    return user;
  }

  async updateStatus(userId: string, status: UserStatus) {
    const tenantId = this.tenancy.getTenantId();
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!target) throw new NotFoundException("User not found");
    if (target.isSuperAdmin) throw new BadRequestException("Cannot disable a super admin");

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    await this.audit.log({ action: "user.status.updated", entity: "User", entityId: userId, meta: { status } });
    return user;
  }

  async clients() {
    const tenantId = this.tenancy.getTenantId();
    const items = await this.prisma.user.findMany({
      where: { tenantId, role: Role.CLIENT, status: UserStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return { items };
  }
}
