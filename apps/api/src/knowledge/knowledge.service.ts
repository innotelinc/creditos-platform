import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string, search?: string) {
    const where: Prisma.KnowledgeArticleWhereInput = { published: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }
    const items = await this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ category: "asc" }, { order: "asc" }],
      select: { id: true, slug: true, title: true, category: true, excerpt: true, updatedAt: true },
    });
    return { items };
  }

  async categories() {
    const grouped = await this.prisma.knowledgeArticle.groupBy({
      by: ["category"],
      where: { published: true },
      _count: { _all: true },
    });
    const labels: Record<string, string> = {
      "getting-started": "Getting started",
      disputes: "Disputes",
      letters: "Letters",
      compliance: "Compliance",
      billing: "Billing",
      faq: "FAQ",
    };
    return {
      items: grouped
        .map((g) => ({ category: g.category, label: labels[g.category] ?? g.category, count: g._count._all }))
        .sort((a, b) => a.category.localeCompare(b.category)),
    };
  }

  async getBySlug(slug: string) {
    const article = await this.prisma.knowledgeArticle.findFirst({ where: { slug, published: true } });
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  async create(input: { slug: string; title: string; category: string; excerpt?: string; body: string; order?: number; published?: boolean }) {
    return this.prisma.knowledgeArticle.create({ data: { ...input, order: input.order ?? 0, published: input.published ?? true } });
  }

  async update(id: string, input: Partial<{ title: string; category: string; excerpt: string; body: string; order: number; published: boolean }>) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException("Article not found");
    return this.prisma.knowledgeArticle.update({ where: { id }, data: input });
  }
}
