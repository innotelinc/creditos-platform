import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LetterStatus, Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { AuditService } from "../audit/audit.service";
import { PdfService } from "./pdf.service";

export interface GenerateLetterInput {
  templateId?: string;
  templateCode?: string;
  clientId: string;
  disputeId?: string;
  accountId?: string;
  letterType?: string;
  title?: string;
}

const MERGE_FIELDS: Record<string, (user: User, extra: Record<string, string>) => string> = {
  client_name: (u) => u.name,
  client_email: (u) => u.email,
  client_phone: (u) => u.phone ?? "",
  date: () => new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
};

@Injectable()
export class LettersService {
  private readonly logger = new Logger(LettersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
  ) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(category?: string, favoriteOnly = false) {
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.LetterTemplateWhereInput = { OR: [{ tenantId }, { isSystem: true }] };
    if (category) where.category = category;
    if (favoriteOnly) where.isFavorite = true;
    const items = await this.prisma.letterTemplate.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return { items };
  }

  async createTemplate(input: { code: string; name: string; description?: string; category?: string; letterType: string; body: string; isFavorite?: boolean }) {
    const tenantId = this.tenancy.getTenantId();
    const existing = await this.prisma.letterTemplate.findUnique({
      where: { code_tenantId: { code: input.code, tenantId } },
    });
    if (existing) throw new Error("A template with this code already exists");
    const template = await this.prisma.letterTemplate.create({
      data: { ...input, tenantId },
    });
    await this.audit.log({ action: "template.created", entity: "LetterTemplate", entityId: template.id });
    return template;
  }

  async updateTemplate(id: string, input: Partial<{ name: string; description: string; category: string; letterType: string; body: string; isFavorite: boolean }>) {
    const tenantId = this.tenancy.getTenantId();
    const template = await this.prisma.letterTemplate.findFirst({ where: { id, OR: [{ tenantId }, { isSystem: true }] } });
    if (!template) throw new NotFoundException("Template not found");
    const updated = await this.prisma.letterTemplate.update({
      where: { id },
      data: { ...input, version: { increment: 1 } },
    });
    await this.audit.log({ action: "template.updated", entity: "LetterTemplate", entityId: id });
    return updated;
  }

  async favoriteTemplate(id: string, favorite: boolean) {
    const tenantId = this.tenancy.getTenantId();
    const template = await this.prisma.letterTemplate.findFirst({ where: { id, OR: [{ tenantId }, { isSystem: true }] } });
    if (!template) throw new NotFoundException("Template not found");
    return this.prisma.letterTemplate.update({ where: { id }, data: { isFavorite: favorite } });
  }

  // ── Letters ────────────────────────────────────────────────────────────────

  async generate(input: GenerateLetterInput, creatorId?: string) {
    const tenantId = this.tenancy.getTenantId();
    const client = await this.prisma.user.findFirst({
      where: { id: input.clientId, tenantId, role: "CLIENT" },
    });
    if (!client) throw new NotFoundException("Client not found");

    let template = null;
    if (input.templateId) {
      template = await this.prisma.letterTemplate.findFirst({
        where: { id: input.templateId, OR: [{ tenantId }, { isSystem: true }] },
      });
    } else if (input.templateCode) {
      template = await this.prisma.letterTemplate.findFirst({
        where: { code: input.templateCode, OR: [{ tenantId }, { isSystem: true }] },
      });
    }
    if (!template) throw new NotFoundException("Letter template not found");

    const extra: Record<string, string> = {};
    if (input.accountId) {
      const account = await this.prisma.creditAccount.findFirst({
        where: { id: input.accountId, report: { tenantId, clientId: input.clientId } },
      });
      if (account) {
        extra.account_name = account.accountName;
        extra.account_number = account.accountNumber ?? "";
        extra.creditor = account.accountName;
        extra.balance = account.balance === null ? "" : `$${Number(account.balance).toFixed(2)}`;
        extra.bureau = account.bureau;
        extra.last_reported = account.lastReportedDate?.toISOString().slice(0, 10) ?? "";
      }
    }

    const body = this.renderTemplate(template.body, client, extra);
    const letter = await this.prisma.letter.create({
      data: {
        tenantId,
        clientId: input.clientId,
        disputeId: input.disputeId,
        templateId: template.id,
        title: input.title ?? `${template.name} — ${client.name}`,
        letterType: template.letterType,
        body,
        version: 1,
        createdById: creatorId,
        status: LetterStatus.READY,
      },
    });
    await this.prisma.letterVersion.create({
      data: { letterId: letter.id, version: 1, title: letter.title, body, createdById: creatorId },
    });
    await this.audit.log({
      action: "letter.generated",
      entity: "Letter",
      entityId: letter.id,
      meta: { template: template.code, clientId: input.clientId },
    });
    return this.get(letter.id);
  }

  async list(query: { clientId?: string; status?: LetterStatus; limit?: number; offset?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const where: Prisma.LetterWhereInput = { tenantId };
    // Clients only ever see their own letters; staff may filter by client.
    const clientScope = this.tenancy.getClientScope();
    const clientId = clientScope?.clientId ?? query.clientId;
    if (clientId) where.clientId = clientId;
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.prisma.letter.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          client: { select: { id: true, name: true, email: true } },
          template: { select: { code: true, name: true } },
          dispute: { select: { id: true, title: true, status: true } },
        },
      }),
      this.prisma.letter.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const letter = await this.prisma.letter.findFirst({
      where: { id, tenantId, ...this.tenancy.getClientScope() },
      include: {
        client: { select: { id: true, name: true, email: true } },
        template: true,
        dispute: { select: { id: true, title: true, status: true, currentRound: true } },
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!letter) throw new NotFoundException("Letter not found");
    return letter;
  }

  /** Saves a new version of an editable letter. */
  async saveVersion(id: string, body: string, title: string | undefined, creatorId?: string) {
    const tenantId = this.tenancy.getTenantId();
    const letter = await this.prisma.letter.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!letter) throw new NotFoundException("Letter not found");
    const version = letter.version + 1;
    const updated = await this.prisma.letter.update({
      where: { id },
      data: { body, title: title ?? letter.title, version, updatedAt: new Date() },
    });
    await this.prisma.letterVersion.create({
      data: { letterId: id, version, title: updated.title, body, createdById: creatorId },
    });
    await this.audit.log({ action: "letter.version.created", entity: "Letter", entityId: id, meta: { version } });
    return this.get(id);
  }

  async markSent(id: string, disputeId?: string) {
    const tenantId = this.tenancy.getTenantId();
    const letter = await this.prisma.letter.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!letter) throw new NotFoundException("Letter not found");
    await this.prisma.letter.update({ where: { id }, data: { status: LetterStatus.SENT } });
    await this.audit.log({ action: "letter.sent", entity: "Letter", entityId: id, meta: { disputeId } });
    return this.get(id);
  }

  async renderPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const letter = await this.get(id);
    const buffer = await this.pdf.renderLetter({
      title: letter.title,
      body: letter.body,
      clientName: letter.client.name,
      clientEmail: letter.client.email,
    });
    return { buffer, filename: `${letter.title.replace(/[^a-z0-9]+/gi, "-")}.pdf` };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private renderTemplate(body: string, client: User, extra: Record<string, string>): string {
    return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, field: string) => {
      const key = field.toLowerCase();
      if (extra[key] !== undefined) return extra[key] ?? "";
      const resolver = MERGE_FIELDS[key];
      if (resolver) return resolver(client, extra);
      return match; // leave unknown fields for manual editing
    });
  }
}
