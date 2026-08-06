import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenancyService } from "../common/tenancy";
import { S3Service } from "../reports/s3.service";
import { AuditService } from "../audit/audit.service";

export interface UploadDocumentInput {
  clientId: string;
  type?: DocumentType;
  filename: string;
  mimeType?: string;
  buffer: Buffer;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly s3: S3Service,
    private readonly audit: AuditService,
  ) {}

  async upload(input: UploadDocumentInput) {
    const tenantId = this.tenancy.getTenantId();
    // Client-role users can only ever upload to their own record.
    const clientScope = this.tenancy.getClientScope();
    const clientId = clientScope?.clientId ?? input.clientId;
    if (!clientId) throw new NotFoundException("Client not found in this tenant");
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, tenantId, role: "CLIENT" },
    });
    if (!client) throw new NotFoundException("Client not found in this tenant");
    input.clientId = clientId;

    const key = `documents/${tenantId}/${input.clientId}/${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await this.s3.putObject(key, input.buffer, input.mimeType || "application/octet-stream");

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        clientId: input.clientId,
        name: input.filename,
        type: input.type ?? DocumentType.OTHER,
        fileKey: key,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        uploadedById: this.tenancy.getUser().id,
      },
    });
    await this.audit.log({ action: "document.uploaded", entity: "Document", entityId: doc.id, meta: { filename: input.filename } });
    return doc;
  }

  async list(query: { clientId?: string; type?: DocumentType; limit?: number; offset?: number }) {
    const tenantId = this.tenancy.getTenantId();
    const where: Record<string, unknown> = { tenantId };
    const clientScope = this.tenancy.getClientScope();
    const clientId = clientScope?.clientId ?? query.clientId;
    if (clientId) where.clientId = clientId;
    if (query.type) where.type = query.type;

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
        include: {
          client: { select: { id: true, name: true, email: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, ...this.tenancy.getClientScope() },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  async remove(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.fileKey) await this.s3.deleteObject(doc.fileKey).catch(() => undefined);
    await this.prisma.document.delete({ where: { id } });
    await this.audit.log({ action: "document.deleted", entity: "Document", entityId: id });
    return { success: true };
  }

  async download(id: string) {
    const tenantId = this.tenancy.getTenantId();
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId, ...this.tenancy.getClientScope() } });
    if (!doc || !doc.fileKey) throw new NotFoundException("File not available");
    const buffer = await this.s3.getObject(doc.fileKey);
    return { buffer, filename: doc.name, mimeType: doc.mimeType ?? "application/octet-stream" };
  }
}
