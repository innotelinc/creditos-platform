import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma, Role, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { CreateUserDto, UpdateUserDto } from "../auth/dto";
import { AuditService } from "../audit/audit.service";

export interface CreateClientInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: UserStatus;
}

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
    // `notes` are staff-written client notes — not exposed via the profile endpoint.
    const { passwordHash, totpSecret, notes, ...safe } = user;
    return safe;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const { passwordHash: _p, totpSecret: _t, notes: _n, ...safe } = await this.prisma.user.update({
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
      where: { tenantId, role: Role.CLIENT },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notes: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { reportsAsClient: true, disputesAsClient: true } },
      },
    });
    return { items };
  }

  /** Staff adds a client to the workspace (Role.CLIENT with portal credentials). */
  async createClient(input: CreateClientInput) {
    const tenantId = this.tenancy.getTenantId();
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) throw new BadRequestException("A client with this email already exists");

    // No password provided → generate a temporary one, shown to staff once so
    // they can share it with the client (client can reset it via forgot-password).
    const generated = input.password ? undefined : randomBytes(6).toString("base64url");
    const password = input.password ?? generated!;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        name: input.name,
        passwordHash,
        role: Role.CLIENT,
        status: UserStatus.ACTIVE,
        phone: input.phone,
        notes: input.notes,
      },
      select: { id: true, name: true, email: true, phone: true, notes: true, status: true, createdAt: true },
    });
    await this.audit.log({
      action: "client.created",
      entity: "User",
      entityId: user.id,
      meta: { email: user.email },
    });
    return { user, temporaryPassword: generated };
  }

  async updateClient(id: string, input: UpdateClientInput) {
    const tenantId = this.tenancy.getTenantId();
    const target = await this.prisma.user.findFirst({ where: { id, tenantId, role: Role.CLIENT } });
    if (!target) throw new NotFoundException("Client not found");

    const data: Prisma.UserUpdateInput = {
      name: input.name ?? undefined,
      phone: input.phone ?? undefined,
      notes: input.notes ?? undefined,
      status: input.status ?? undefined,
    };
    if (input.email) {
      const email = input.email.toLowerCase();
      const dup = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
      if (dup && dup.id !== id) throw new BadRequestException("A client with this email already exists");
      data.email = email;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, phone: true, notes: true, status: true, createdAt: true },
    });
    await this.audit.log({ action: "client.updated", entity: "User", entityId: id, meta: { email: user.email } });
    return user;
  }

  /** Soft-remove a client: disables portal access while preserving history. */
  async removeClient(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const target = await this.prisma.user.findFirst({ where: { id, tenantId, role: Role.CLIENT } });
    if (!target) throw new NotFoundException("Client not found");

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.DISABLED },
    });
    await this.audit.log({ action: "client.removed", entity: "User", entityId: id });
    return { success: true };
  }
}
