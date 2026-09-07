import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { validateArticleV2, type ArticleV2 } from "@konkurcom/contracts";
import { ArticleContentType, Degree, Prisma, ReviewStatus, VersionedEntityType } from "@prisma/client";
import { ARTICLE_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateArticleDto } from "./dto/create-article.dto";
import { SourceLinkDto } from "./dto/editorial.dto";
import { UpdateArticleDto } from "./dto/update-article.dto";

const EDITABLE_STATUSES: ReviewStatus[] = [ReviewStatus.DRAFT, ReviewStatus.REJECTED];
const articleEditorialInclude = {
  sources: { include: { source: true }, orderBy: { order: "asc" as const } },
  authorProfile: true,
  reviewerProfile: true,
} satisfies Prisma.ArticleInclude;
type ArticleEditorial = Prisma.ArticleGetPayload<{ include: typeof articleEditorialInclude }>;
type EditorialLookupClient = Pick<Prisma.TransactionClient, "contentSource" | "contributorProfile">;
const publicArticleInclude = {
  sources: {
    include: {
      source: {
        select: {
          title: true,
          publisher: true,
          canonicalUrl: true,
          deepUrl: true,
          checkedAt: true,
          licenseName: true,
          licenseUrl: true,
          attributionText: true,
        },
      },
    },
    orderBy: { order: "asc" as const },
  },
  authorProfile: { select: { slug: true, displayName: true, roleTitle: true, isPublished: true } },
  reviewerProfile: { select: { slug: true, displayName: true, roleTitle: true, isPublished: true } },
} satisfies Prisma.ArticleInclude;
type PublicArticleRecord = Prisma.ArticleGetPayload<{ include: typeof publicArticleInclude }>;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async create(authorId: string, dto: CreateArticleDto) {
    assertValidContentBlocks(dto.contentBlocks, ARTICLE_BLOCK_TYPES);
    const article = await this.prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          slug: dto.slug,
          title: dto.title,
          summary: dto.summary,
          contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
          taxonomyMajor: dto.taxonomyMajor,
          taxonomyTags: dto.taxonomyTags ?? [],
          contentType: dto.contentType ?? ArticleContentType.ARTICLE,
          quickAnswer: dto.quickAnswer,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          taxonomyDegrees: dto.taxonomyDegrees ?? [],
          taxonomyFields: dto.taxonomyFields ?? [],
          subjectCodes: dto.subjectCodes ?? [],
          topicCodes: dto.topicCodes ?? [],
          validForYear: dto.validForYear,
          authorProfileId: dto.authorProfileId,
          sourceValidatedAt: dto.sourceValidatedAt ? new Date(dto.sourceValidatedAt) : undefined,
          reviewDueAt: dto.reviewDueAt ? new Date(dto.reviewDueAt) : undefined,
          authorId,
          provenance: { producer_type: "human", source_artifact: "admin-editor" },
          reviewStatus: ReviewStatus.DRAFT,
          sources: dto.sourceLinks?.length
            ? { create: dto.sourceLinks.map((source) => this.articleSourceData(source)) }
            : undefined,
        },
      });
      const withExternalId = await tx.article.update({
        where: { id: created.id },
        data: { externalId: `admin-article-${created.id}` },
        include: articleEditorialInclude,
      });
      await tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.ARTICLE,
          entityId: created.id,
          version: 1,
          schemaVersion: "article.v2",
          reviewStatus: ReviewStatus.DRAFT,
          createdByUserId: authorId,
          payload: this.articlePayload(withExternalId) as Prisma.InputJsonValue,
        },
      });
      return withExternalId;
    });
    await this.audit.log({ actorUserId: authorId, action: "article.created", targetType: "Article", targetId: article.id, metadata: { schemaVersion: "article.v2" } });
    return article;
  }

  async update(articleId: string, actorId: string, dto: UpdateArticleDto) {
    const article = await this.getEditorial(articleId);
    if (!EDITABLE_STATUSES.includes(article.reviewStatus)) {
      throw new ForbiddenException(`cannot edit an article in status ${article.reviewStatus}; create a revision first`);
    }
    if (dto.contentBlocks) assertValidContentBlocks(dto.contentBlocks, ARTICLE_BLOCK_TYPES);
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.article.update({
        where: { id: articleId },
        data: {
          title: dto.title,
          summary: dto.summary,
          contentBlocks: dto.contentBlocks ? (dto.contentBlocks as Prisma.InputJsonValue) : undefined,
          taxonomyMajor: dto.taxonomyMajor,
          taxonomyTags: dto.taxonomyTags,
          contentType: dto.contentType,
          quickAnswer: dto.quickAnswer,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          taxonomyDegrees: dto.taxonomyDegrees,
          taxonomyFields: dto.taxonomyFields,
          subjectCodes: dto.subjectCodes,
          topicCodes: dto.topicCodes,
          validForYear: dto.validForYear,
          authorProfileId: dto.authorProfileId,
          sourceValidatedAt: dto.sourceValidatedAt ? new Date(dto.sourceValidatedAt) : undefined,
          reviewDueAt: dto.reviewDueAt ? new Date(dto.reviewDueAt) : undefined,
          reviewStatus: ReviewStatus.DRAFT,
          sources: dto.sourceLinks
            ? { deleteMany: {}, create: dto.sourceLinks.map((source) => this.articleSourceData(source)) }
            : undefined,
        },
        include: articleEditorialInclude,
      });
      await tx.contentVersion.upsert({
        where: { entityType_entityId_version: { entityType: VersionedEntityType.ARTICLE, entityId: articleId, version: next.version } },
        update: { payload: this.articlePayload(next) as Prisma.InputJsonValue, reviewStatus: ReviewStatus.DRAFT, reviewNote: null },
        create: {
          entityType: VersionedEntityType.ARTICLE,
          entityId: articleId,
          version: next.version,
          schemaVersion: "article.v2",
          reviewStatus: ReviewStatus.DRAFT,
          createdByUserId: actorId,
          payload: this.articlePayload(next) as Prisma.InputJsonValue,
        },
      });
      return next;
    });
    await this.audit.log({ actorUserId: actorId, action: "article.updated", targetType: "Article", targetId: articleId });
    return updated;
  }

  async revise(articleId: string, actorId: string) {
    const version = await this.prisma.$transaction(async (tx) => {
      await this.lockArticle(tx, articleId);
      const article = await this.getEditorialWith(tx, articleId);
      if (article.reviewStatus !== ReviewStatus.PUBLISHED) throw new ForbiddenException("only a published article can start a new revision");
      const pending = await tx.contentVersion.findFirst({
        where: { entityType: VersionedEntityType.ARTICLE, entityId: articleId, reviewStatus: { in: [ReviewStatus.DRAFT, ReviewStatus.IN_REVIEW] } },
      });
      if (pending) throw new ForbiddenException("this article already has a pending revision");
      const latest = await tx.contentVersion.findFirst({
        where: { entityType: VersionedEntityType.ARTICLE, entityId: articleId },
        orderBy: { version: "desc" },
      });
      const nextVersion = Math.max(article.version, latest?.version ?? 0) + 1;
      return tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.ARTICLE,
          entityId: articleId,
          version: nextVersion,
          schemaVersion: "article.v2",
          reviewStatus: ReviewStatus.DRAFT,
          createdByUserId: actorId,
          payload: { ...this.articlePayload(article), review_status: "draft" } as Prisma.InputJsonValue,
        },
      });
    });
    await this.audit.log({ actorUserId: actorId, action: "article.revision_created", targetType: "Article", targetId: articleId, metadata: { version: version.version } });
    return version;
  }

  async updateRevision(articleId: string, version: number, actorId: string, payload: unknown) {
    const validation = validateArticleV2(payload);
    if (!validation.valid || !validation.data) throw new BadRequestException(validation.errors);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockArticle(tx, articleId);
      const article = await this.getEditorialWith(tx, articleId);
      this.assertCanonicalIdentity(article, validation.data!);
      const revision = await this.findRevisionWith(tx, articleId, version);
      await this.assertLatestRevision(tx, article, revision);
      if (!EDITABLE_STATUSES.includes(revision.reviewStatus)) throw new ForbiddenException("revision is not editable");
      return tx.contentVersion.update({
        where: { id: revision.id },
        data: { payload: payload as Prisma.InputJsonValue, reviewStatus: ReviewStatus.DRAFT, reviewNote: null },
      });
    });
    await this.audit.log({ actorUserId: actorId, action: "article.revision_updated", targetType: "Article", targetId: articleId, metadata: { version } });
    return updated;
  }

  async submitForReview(articleId: string, actorId: string, version?: number) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockArticle(tx, articleId);
      const article = await this.getEditorialWith(tx, articleId);
      const revision = await this.findRevisionWith(tx, articleId, version ?? article.version);
      await this.assertLatestRevision(tx, article, revision);
      if (!EDITABLE_STATUSES.includes(revision.reviewStatus)) throw new ForbiddenException("revision is not editable");
      await this.assertArticlePayloadPublishable(revision.payload, article, tx);
      const submitted = await tx.contentVersion.update({
        where: { id: revision.id },
        data: { reviewStatus: ReviewStatus.IN_REVIEW, submittedAt: new Date() },
      });
      if (article.reviewStatus !== ReviewStatus.PUBLISHED) {
        await tx.article.update({ where: { id: articleId }, data: { reviewStatus: ReviewStatus.IN_REVIEW } });
      }
      return submitted;
    });
    await this.audit.log({ actorUserId: actorId, action: "article.submitted_for_review", targetType: "Article", targetId: articleId, metadata: { version: updated.version } });
    return updated;
  }

  async approve(articleId: string, reviewerId: string, version?: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockArticle(tx, articleId);
      const article = await this.getEditorialWith(tx, articleId);
      const revision = await this.findRevisionWith(tx, articleId, version ?? article.version);
      await this.assertLatestRevision(tx, article, revision);
      if (revision.reviewStatus !== ReviewStatus.IN_REVIEW) throw new ForbiddenException("only an in-review revision can be approved");
      const payload = await this.assertArticlePayloadPublishable(revision.payload, article, tx);
      const reviewer = await tx.contributorProfile.findUnique({ where: { userId: reviewerId } });
      const now = new Date();
      const canonical = await this.applyArticleV2(tx, articleId, revision.version, payload, reviewer?.id, now);
      await tx.contentVersion.update({
        where: { id: revision.id },
        data: { reviewStatus: ReviewStatus.PUBLISHED, reviewedByUserId: reviewerId, reviewedAt: now, publishedAt: now },
      });
      return {
        canonical,
        selfReviewed:
          revision.createdByUserId === reviewerId ||
          article.authorId === reviewerId ||
          article.authorProfile?.userId === reviewerId,
        version: revision.version,
      };
    });
    await this.audit.log({ actorUserId: reviewerId, action: "article.approved", targetType: "Article", targetId: articleId, metadata: { version: result.version, selfReviewed: result.selfReviewed } });
    return result.canonical;
  }

  async reject(articleId: string, reviewerId: string, reason?: string, version?: number) {
    if (!reason?.trim()) throw new BadRequestException("a rejection reason is required");
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockArticle(tx, articleId);
      const article = await this.getEditorialWith(tx, articleId);
      const revision = await this.findRevisionWith(tx, articleId, version ?? article.version);
      await this.assertLatestRevision(tx, article, revision);
      if (revision.reviewStatus !== ReviewStatus.IN_REVIEW) throw new ForbiddenException("only an in-review revision can be rejected");
      const rejected = await tx.contentVersion.update({
        where: { id: revision.id },
        data: { reviewStatus: ReviewStatus.REJECTED, reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewNote: reason },
      });
      if (article.reviewStatus !== ReviewStatus.PUBLISHED) {
        await tx.article.update({ where: { id: articleId }, data: { reviewStatus: ReviewStatus.REJECTED } });
      }
      return rejected;
    });
    await this.audit.log({ actorUserId: reviewerId, action: "article.rejected", targetType: "Article", targetId: articleId, metadata: { reason, version: updated.version } });
    return updated;
  }

  async listPublished() {
    const articles = await this.prisma.article.findMany({ where: { reviewStatus: ReviewStatus.PUBLISHED }, orderBy: { publishedAt: "desc" }, include: publicArticleInclude });
    return articles.map((article) => this.toPublicArticle(article));
  }

  async getPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug }, include: publicArticleInclude });
    if (!article || article.reviewStatus !== ReviewStatus.PUBLISHED) throw new NotFoundException("article not found");
    return this.toPublicArticle(article);
  }

  async listAll() {
    const articles = await this.prisma.article.findMany({ orderBy: { updatedAt: "desc" }, include: articleEditorialInclude });
    return Promise.all(articles.map(async (article) => ({
      ...article,
      latestRevision: await this.prisma.contentVersion.findFirst({ where: { entityType: VersionedEntityType.ARTICLE, entityId: article.id }, orderBy: { version: "desc" } }),
    })));
  }

  async getById(articleId: string) {
    const article = await this.getEditorial(articleId);
    const versions = await this.prisma.contentVersion.findMany({ where: { entityType: VersionedEntityType.ARTICLE, entityId: articleId }, orderBy: { version: "desc" } });
    return { ...article, versions };
  }

  async preview(articleId: string, version?: number) {
    const article = await this.getEditorial(articleId);
    const revision = await this.prisma.contentVersion.findFirst({ where: { entityType: VersionedEntityType.ARTICLE, entityId: articleId, ...(version ? { version } : {}) }, orderBy: { version: "desc" } });
    return { article, revision };
  }

  private async getEditorial(articleId: string): Promise<ArticleEditorial> {
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, include: articleEditorialInclude });
    if (!article) throw new NotFoundException("article not found");
    return article;
  }

  private async getEditorialWith(tx: Prisma.TransactionClient, articleId: string): Promise<ArticleEditorial> {
    const article = await tx.article.findUnique({ where: { id: articleId }, include: articleEditorialInclude });
    if (!article) throw new NotFoundException("article not found");
    return article;
  }

  private async findRevisionWith(tx: Prisma.TransactionClient, articleId: string, version: number) {
    const revision = await tx.contentVersion.findUnique({ where: { entityType_entityId_version: { entityType: VersionedEntityType.ARTICLE, entityId: articleId, version } } });
    if (!revision) throw new NotFoundException("article revision not found");
    return revision;
  }

  private async lockArticle(tx: Prisma.TransactionClient, articleId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "articles" WHERE "id" = ${articleId} FOR UPDATE`);
    if (rows.length === 0) throw new NotFoundException("article not found");
  }

  private async assertLatestRevision(
    tx: Prisma.TransactionClient,
    article: ArticleEditorial,
    revision: { id: string; version: number; schemaVersion: string },
  ) {
    if (revision.schemaVersion !== "article.v2") throw new ForbiddenException("this workflow only supports article.v2 revisions");
    const latest = await tx.contentVersion.findFirst({
      where: { entityType: VersionedEntityType.ARTICLE, entityId: article.id },
      orderBy: { version: "desc" },
    });
    if (!latest || latest.id !== revision.id || revision.version < article.version) {
      throw new ForbiddenException("only the latest article revision can be changed or reviewed");
    }
  }

  private async assertArticlePayloadPublishable(
    payload: Prisma.JsonValue,
    article?: ArticleEditorial,
    client: EditorialLookupClient = this.prisma,
  ): Promise<ArticleV2> {
    const validation = validateArticleV2(payload);
    if (!validation.valid || !validation.data) throw new BadRequestException(validation.errors);
    if (article) this.assertCanonicalIdentity(article, validation.data);
    const sourceIds = validation.data.sources.map((source) => source.source_external_id);
    const sources = await client.contentSource.findMany({ where: { externalId: { in: sourceIds }, archivedAt: null } });
    if (new Set(sources.map((source) => source.externalId)).size !== new Set(sourceIds).size) {
      throw new BadRequestException("every article source must reference an active ContentSource externalId");
    }
    if (validation.data.editorial?.author_slug) {
      const author = await client.contributorProfile.findUnique({ where: { slug: validation.data.editorial.author_slug } });
      if (!author) throw new BadRequestException("article author profile does not exist");
    }
    return validation.data;
  }

  private async applyArticleV2(tx: Prisma.TransactionClient, articleId: string, version: number, payload: ArticleV2, reviewerProfileId: string | undefined, now: Date) {
    const sourceIds = payload.sources.map((source) => source.source_external_id);
    const sources = await tx.contentSource.findMany({ where: { externalId: { in: sourceIds }, archivedAt: null } });
    const sourceByExternalId = new Map(sources.map((source) => [source.externalId, source.id]));
    if (sourceByExternalId.size !== new Set(sourceIds).size) {
      throw new BadRequestException("every article source must reference an active ContentSource externalId");
    }
    const author = payload.editorial?.author_slug ? await tx.contributorProfile.findUnique({ where: { slug: payload.editorial.author_slug } }) : null;
    return tx.article.update({
      where: { id: articleId },
      data: {
        externalId: payload.external_id,
        slug: payload.slug,
        contentType: payload.content_type.toUpperCase() as ArticleContentType,
        title: payload.title,
        summary: payload.summary,
        quickAnswer: payload.quick_answer,
        contentBlocks: payload.content_blocks as unknown as Prisma.InputJsonValue,
        assets: (payload.assets ?? []) as unknown as Prisma.InputJsonValue,
        taxonomyMajor: payload.taxonomy.major,
        taxonomyTags: payload.taxonomy.tags ?? [],
        taxonomyDegrees: payload.taxonomy.degrees.map((degree) => degree.toUpperCase() as Degree),
        taxonomyFields: payload.taxonomy.fields,
        subjectCodes: payload.taxonomy.subject_codes,
        topicCodes: payload.taxonomy.topic_codes,
        seoTitle: payload.seo.title,
        seoDescription: payload.seo.description,
        validForYear: payload.validity.exam_year,
        sourceValidatedAt: payload.validity.source_checked_at ? new Date(payload.validity.source_checked_at) : null,
        reviewDueAt: payload.validity.review_due_at ? new Date(payload.validity.review_due_at) : null,
        provenance: payload.provenance as unknown as Prisma.InputJsonValue,
        authorProfileId: author?.id,
        reviewerProfileId,
        reviewedAt: now,
        reviewStatus: ReviewStatus.PUBLISHED,
        publishedAt: now,
        version,
        sources: { deleteMany: {}, create: payload.sources.map((source) => ({ sourceId: sourceByExternalId.get(source.source_external_id)!, relation: source.relation, locator: source.locator, claim: source.claim, order: source.order ?? 0 })) },
      },
      include: articleEditorialInclude,
    });
  }

  private articlePayload(article: ArticleEditorial) {
    const validity = article.validForYear === null
      ? { time_sensitive: false }
      : {
          exam_year: article.validForYear,
          time_sensitive: true,
          ...(article.sourceValidatedAt ? { source_checked_at: article.sourceValidatedAt.toISOString() } : {}),
          ...(article.reviewDueAt ? { review_due_at: article.reviewDueAt.toISOString() } : {}),
        };
    return {
      schema_version: "article.v2",
      external_id: article.externalId ?? `admin-article-${article.id}`,
      content_type: article.contentType.toLowerCase(),
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      quick_answer: article.quickAnswer ?? "",
      content_blocks: article.contentBlocks,
      taxonomy: { major: article.taxonomyMajor, tags: article.taxonomyTags, degrees: article.taxonomyDegrees.map((degree) => degree.toLowerCase()), fields: article.taxonomyFields, subject_codes: article.subjectCodes, topic_codes: article.topicCodes },
      seo: { title: article.seoTitle ?? "", description: article.seoDescription ?? "" },
      validity,
      sources: article.sources.map((link) => ({
        source_external_id: link.source.externalId ?? link.source.id,
        relation: link.relation,
        ...(link.locator ? { locator: link.locator } : {}),
        ...(link.claim ? { claim: link.claim } : {}),
        order: link.order,
      })),
      ...(article.authorProfile ? { editorial: { author_slug: article.authorProfile.slug } } : {}),
      assets: article.assets,
      provenance: article.provenance ?? { producer_type: "human", source_artifact: "admin-editor" },
      review_status: this.contractReviewStatus(article.reviewStatus),
    };
  }

  private articleSourceData(source: SourceLinkDto) {
    return { sourceId: source.sourceId, relation: source.relation, locator: source.locator, claim: source.claim, order: source.order ?? 0 };
  }

  private assertCanonicalIdentity(article: ArticleEditorial, payload: ArticleV2) {
    const externalId = article.externalId ?? `admin-article-${article.id}`;
    if (payload.slug !== article.slug || payload.external_id !== externalId) {
      throw new BadRequestException("article revisions cannot change slug or external_id");
    }
  }

  private contractReviewStatus(status: ReviewStatus) {
    if (status === ReviewStatus.PUBLISHED) return "approved";
    if (status === ReviewStatus.IN_REVIEW) return "in_review";
    if (status === ReviewStatus.REJECTED) return "rejected";
    return "draft";
  }

  private toPublicArticle(article: PublicArticleRecord) {
    return {
      id: article.id,
      externalId: article.externalId,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      contentType: article.contentType,
      quickAnswer: article.quickAnswer,
      contentBlocks: article.contentBlocks,
      assets: article.assets,
      taxonomyMajor: article.taxonomyMajor,
      taxonomyTags: article.taxonomyTags,
      taxonomyDegrees: article.taxonomyDegrees,
      taxonomyFields: article.taxonomyFields,
      subjectCodes: article.subjectCodes,
      topicCodes: article.topicCodes,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      validForYear: article.validForYear,
      sourceValidatedAt: article.sourceValidatedAt,
      reviewDueAt: article.reviewDueAt,
      reviewedAt: article.reviewedAt,
      reviewStatus: article.reviewStatus,
      version: article.version,
      createdAt: article.createdAt,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      sources: article.sources.map((link) => ({
        relation: link.relation,
        locator: link.locator,
        claim: link.claim,
        order: link.order,
        source: {
          title: link.source.title,
          publisher: link.source.publisher,
          canonicalUrl: link.source.canonicalUrl,
          deepUrl: link.source.deepUrl,
          checkedAt: link.source.checkedAt,
          licenseName: link.source.licenseName,
          licenseUrl: link.source.licenseUrl,
          attributionText: link.source.attributionText,
        },
      })),
      authorProfile: article.authorProfile?.isPublished
        ? { slug: article.authorProfile.slug, displayName: article.authorProfile.displayName, roleTitle: article.authorProfile.roleTitle }
        : null,
      reviewerProfile: article.reviewerProfile?.isPublished
        ? { slug: article.reviewerProfile.slug, displayName: article.reviewerProfile.displayName, roleTitle: article.reviewerProfile.roleTitle }
        : null,
    };
  }
}
