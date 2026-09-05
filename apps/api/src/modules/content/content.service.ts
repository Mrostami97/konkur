import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReviewStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ARTICLE_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { CreateArticleDto } from "./dto/create-article.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";

const EDITABLE_STATUSES: ReviewStatus[] = [ReviewStatus.DRAFT, ReviewStatus.REJECTED];

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(authorId: string, dto: CreateArticleDto) {
    assertValidContentBlocks(dto.contentBlocks, ARTICLE_BLOCK_TYPES);
    const article = await this.prisma.article.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        summary: dto.summary,
        contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
        taxonomyMajor: dto.taxonomyMajor,
        taxonomyTags: dto.taxonomyTags ?? [],
        authorId,
        reviewStatus: ReviewStatus.DRAFT,
      },
    });
    await this.audit.log({
      actorUserId: authorId,
      action: "article.created",
      targetType: "Article",
      targetId: article.id,
    });
    return article;
  }

  async update(articleId: string, actorId: string, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("article not found");
    if (!EDITABLE_STATUSES.includes(article.reviewStatus)) {
      throw new ForbiddenException(`cannot edit an article in status ${article.reviewStatus}`);
    }
    if (dto.contentBlocks) assertValidContentBlocks(dto.contentBlocks, ARTICLE_BLOCK_TYPES);

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        title: dto.title,
        summary: dto.summary,
        contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
        taxonomyMajor: dto.taxonomyMajor,
        taxonomyTags: dto.taxonomyTags,
      },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "article.updated",
      targetType: "Article",
      targetId: articleId,
    });
    return updated;
  }

  async submitForReview(articleId: string, actorId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("article not found");
    if (!EDITABLE_STATUSES.includes(article.reviewStatus)) {
      throw new ForbiddenException(`cannot submit an article in status ${article.reviewStatus}`);
    }
    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: { reviewStatus: ReviewStatus.IN_REVIEW },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "article.submitted_for_review",
      targetType: "Article",
      targetId: articleId,
    });
    return updated;
  }

  async approve(articleId: string, reviewerId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("article not found");
    if (article.reviewStatus !== ReviewStatus.IN_REVIEW) {
      throw new ForbiddenException("only an in-review article can be approved");
    }
    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: { reviewStatus: ReviewStatus.PUBLISHED, publishedAt: new Date() },
    });
    await this.audit.log({
      actorUserId: reviewerId,
      action: "article.approved",
      targetType: "Article",
      targetId: articleId,
    });
    return updated;
  }

  async reject(articleId: string, reviewerId: string, reason?: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("article not found");
    if (article.reviewStatus !== ReviewStatus.IN_REVIEW) {
      throw new ForbiddenException("only an in-review article can be rejected");
    }
    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: { reviewStatus: ReviewStatus.REJECTED },
    });
    await this.audit.log({
      actorUserId: reviewerId,
      action: "article.rejected",
      targetType: "Article",
      targetId: articleId,
      metadata: reason ? { reason } : undefined,
    });
    return updated;
  }

  async listPublished() {
    return this.prisma.article.findMany({
      where: { reviewStatus: ReviewStatus.PUBLISHED },
      orderBy: { publishedAt: "desc" },
    });
  }

  async getPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug } });
    if (!article || article.reviewStatus !== ReviewStatus.PUBLISHED) {
      throw new NotFoundException("article not found");
    }
    return article;
  }

  async listAll() {
    return this.prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getById(articleId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("article not found");
    return article;
  }
}
