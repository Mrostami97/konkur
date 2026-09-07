import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleV1,
  ArticleV2,
  QuestionV1,
  ReportCardV1,
  validateArticle,
  validateQuestion,
  validateReportCard,
} from "@konkurcom/contracts";
import {
  DedupeStatus,
  ImportItemStatus,
  ImportJobStatus,
  Prisma,
  VersionedEntityType,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObjectStorageService } from "./object-storage.service";
import { parseImportZip } from "./zip-reader";
import { sha256Buffer, sha256Json } from "./checksum";

type ContractItem = ArticleV1 | ArticleV2 | QuestionV1 | ReportCardV1;
type PublicationReview = { reviewedByUserId: string; reviewedAt: Date };
const SUPPORTED_SCHEMA_VERSIONS = ["article.v1", "article.v2", "report-card.v1", "question.v1"] as const;

function extractExternalId(item: unknown): string | null {
  if (item && typeof item === "object" && typeof (item as Record<string, unknown>).external_id === "string") {
    return (item as Record<string, unknown>).external_id as string;
  }
  return null;
}

function extractSchemaVersion(item: unknown): string | null {
  const value = item && typeof item === "object" ? (item as Record<string, unknown>).schema_version : undefined;
  if (typeof value === "string") {
    return value;
  }
  return null;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
  ) {}

  async receiveImport(fileBuffer: Buffer, submittedBy: string) {
    const idempotencyKey = sha256Buffer(fileBuffer);

    const existing = await this.prisma.importJob.findUnique({ where: { idempotencyKey } });
    if (existing) return existing; // idempotent reimport: identical upload is a no-op

    const { items: rawItems, files } = parseImportZip(fileBuffer);
    if (rawItems.length === 0) throw new BadRequestException("payload.json contains no items");

    const schemaVersions = new Set(rawItems.map(extractSchemaVersion));
    if (schemaVersions.size !== 1 || schemaVersions.has(null)) {
      throw new BadRequestException("all items in one import must share the same schema_version");
    }
    const schemaVersion = [...schemaVersions][0] as string;
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion as (typeof SUPPORTED_SCHEMA_VERSIONS)[number])) {
      throw new BadRequestException(`unknown schema_version: ${schemaVersion}`);
    }

    const job = await this.prisma.importJob.create({
      data: {
        schemaVersion,
        idempotencyKey,
        submittedBy,
        totalItems: rawItems.length,
        status: ImportJobStatus.RECEIVED,
      },
    });

    for (const rawItem of rawItems) {
      await this.stageItem(job.id, schemaVersion, rawItem, files);
    }

    return this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.STAGED },
    });
  }

  /**
   * Direct single-item authoring (doc §10.2 Phase 3 "Workflow محتوا"), e.g. a
   * question typed by hand rather than bulk-imported. Reuses the exact same
   * Stage -> Review -> Publish machinery as receiveImport (same ImportJob/
   * ImportItem rows, same /admin/import review UI) instead of a parallel
   * authoring workflow -- just without a zip or media files. A question
   * referencing new (not-yet-uploaded) media assets isn't supported this way;
   * use the zip upload path for that.
   */
  async receiveDirectItem(rawItem: unknown, submittedBy: string) {
    const schemaVersion = extractSchemaVersion(rawItem);
    if (!schemaVersion || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion as (typeof SUPPORTED_SCHEMA_VERSIONS)[number])) {
      throw new BadRequestException(`unknown or missing schema_version`);
    }
    const idempotencyKey = sha256Json({ direct: true, rawItem });
    const existing = await this.prisma.importJob.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const job = await this.prisma.importJob.create({
      data: { schemaVersion, idempotencyKey, submittedBy, totalItems: 1, status: ImportJobStatus.RECEIVED },
    });
    await this.stageItem(job.id, schemaVersion, rawItem, new Map());
    return this.prisma.importJob.update({
      where: { id: job.id },
      data: { status: ImportJobStatus.STAGED },
    });
  }

  private async stageItem(
    jobId: string,
    schemaVersion: string,
    rawItem: unknown,
    files: Map<string, Buffer>,
  ) {
    const externalId = extractExternalId(rawItem) ?? "unknown";

    const validation =
      schemaVersion.startsWith("article.")
        ? validateArticle(rawItem)
        : schemaVersion === "report-card.v1"
          ? validateReportCard(rawItem)
          : validateQuestion(rawItem);

    if (!validation.valid) {
      await this.prisma.importItem.create({
        data: {
          importJobId: jobId,
          externalId,
          rawPayload: rawItem as Prisma.InputJsonValue,
          status: ImportItemStatus.INVALID,
          validationErrors: validation.errors as unknown as Prisma.InputJsonValue,
        },
      });
      return;
    }

    // Assets: verify every referenced media file is present in the zip with
    // a matching checksum, then upload it to object storage (doc §6.2 step 6).
    const assetErrors: string[] = [];
    const assets: { media_key: string; filename: string; mime_type: string; checksum: string }[] =
      (rawItem as Record<string, unknown>).assets as typeof assets | undefined ?? [];
    for (const asset of assets) {
      const fileBuf = files.get(asset.filename);
      if (!fileBuf) {
        assetErrors.push(`asset ${asset.filename} referenced but not present in the zip`);
        continue;
      }
      const actualChecksum = `sha256:${sha256Buffer(fileBuf)}`;
      if (actualChecksum !== asset.checksum) {
        assetErrors.push(`asset ${asset.filename} checksum mismatch`);
        continue;
      }
      const key = `${asset.checksum.replace("sha256:", "")}/${asset.filename}`;
      const alreadyStored = await this.storage.objectExists(key);
      if (!alreadyStored) {
        await this.storage.putObject(key, fileBuf, asset.mime_type);
      }
      await this.prisma.sourceArtifact.upsert({
        where: { checksum: asset.checksum },
        update: {},
        create: {
          checksum: asset.checksum,
          filename: asset.filename,
          mimeType: asset.mime_type,
          size: fileBuf.length,
          storageKey: key,
        },
      });
    }

    if (assetErrors.length > 0) {
      await this.prisma.importItem.create({
        data: {
          importJobId: jobId,
          externalId,
          rawPayload: rawItem as Prisma.InputJsonValue,
          status: ImportItemStatus.INVALID,
          validationErrors: assetErrors as unknown as Prisma.InputJsonValue,
        },
      });
      return;
    }

    const dedupe = await this.computeDedupe(schemaVersion, externalId, rawItem);

    await this.prisma.importItem.create({
      data: {
        importJobId: jobId,
        externalId,
        rawPayload: rawItem as Prisma.InputJsonValue,
        status: ImportItemStatus.VALID,
        validationErrors: [],
        dedupeStatus: dedupe.status,
      },
    });
  }

  private async computeDedupe(
    schemaVersion: string,
    externalId: string,
    rawItem: unknown,
  ): Promise<{ status: DedupeStatus }> {
    const existing =
      schemaVersion.startsWith("article.")
        ? await this.prisma.article.findUnique({ where: { externalId } })
        : schemaVersion === "report-card.v1"
          ? await this.prisma.reportCard.findUnique({ where: { externalId } })
          : await this.prisma.question.findUnique({ where: { externalId } });

    if (!existing) return { status: DedupeStatus.NEW };

    const latestVersion = await this.prisma.contentVersion.findFirst({
      where: { entityType: schemaVersionToEntityType(schemaVersion), entityId: existing.id },
      orderBy: { version: "desc" },
    });
    if (latestVersion && sha256Json(latestVersion.payload) === sha256Json(rawItem)) {
      return { status: DedupeStatus.MATCH };
    }
    return { status: DedupeStatus.CONFLICT };
  }

  async listJobs() {
    return this.prisma.importJob.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getJob(jobId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("import job not found");
    return job;
  }

  async listItems(jobId: string) {
    return this.prisma.importItem.findMany({ where: { importJobId: jobId }, orderBy: { createdAt: "asc" } });
  }

  async reviewItems(itemIds: string[], reviewerId: string, decision: "APPROVE" | "REJECT", note?: string) {
    const items = await this.prisma.importItem.findMany({ where: { id: { in: itemIds } } });
    const results = [];
    for (const item of items) {
      if (item.status !== ImportItemStatus.VALID) {
        throw new ForbiddenException(`item ${item.id} is not in a reviewable state (${item.status})`);
      }
      const updated = await this.prisma.importItem.update({
        where: { id: item.id },
        data: {
          status: decision === "APPROVE" ? ImportItemStatus.APPROVED : ImportItemStatus.REJECTED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });
      results.push(updated);
    }
    await this.audit.log({
      actorUserId: reviewerId,
      action: decision === "APPROVE" ? "import.items_approved" : "import.items_rejected",
      targetType: "ImportItem",
      targetId: itemIds.join(","),
      metadata: { count: itemIds.length, note },
    });
    return results;
  }

  async publishApprovedInJob(jobId: string, actorId: string) {
    const approved = await this.prisma.importItem.findMany({
      where: { importJobId: jobId, status: ImportItemStatus.APPROVED },
    });
    const published = [];
    for (const item of approved) {
      published.push(await this.publishItem(item.id, actorId));
    }

    const remainingOpen = await this.prisma.importItem.count({
      where: { importJobId: jobId, status: { in: [ImportItemStatus.VALID, ImportItemStatus.APPROVED] } },
    });
    await this.prisma.importJob.update({
      where: { id: jobId },
      data: { status: remainingOpen === 0 ? ImportJobStatus.PUBLISHED : ImportJobStatus.REVIEWED },
    });

    return published;
  }

  private async publishItem(itemId: string, actorId: string) {
    const item = await this.prisma.importItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("import item not found");
    if (item.status !== ImportItemStatus.APPROVED) {
      throw new ForbiddenException(`item ${itemId} must be APPROVED before it can be published`);
    }
    if (!item.reviewedBy || !item.reviewedAt) {
      throw new ForbiddenException(`approved item ${itemId} has no recorded reviewer`);
    }
    const job = await this.prisma.importJob.findUniqueOrThrow({ where: { id: item.importJobId } });
    const payload = item.rawPayload as unknown as ContractItem;

    const { entityId, version } = await this.publishValidatedPayload(
      job.schemaVersion,
      payload,
      actorId,
      item.id,
      { reviewedByUserId: item.reviewedBy, reviewedAt: item.reviewedAt },
    );

    return this.prisma.importItem.update({
      where: { id: item.id },
      data: { status: ImportItemStatus.PUBLISHED, publishedEntityId: entityId, publishedVersion: version },
    });
  }

  /**
   * Shared by the bulk-ZIP ingestion pipeline (publishItem, above) and direct
   * single-item authoring (e.g. QuestionBankService authoring one question by
   * hand) -- one code path does the canonical upsert + version snapshot +
   * outbox event + audit log, so both entry points version identically.
   * `importItemId` is omitted for direct authoring.
   */
  async publishValidatedPayload(
    schemaVersion: string,
    payload: ContractItem,
    actorId: string,
    importItemId?: string,
    recordedReview?: PublicationReview,
  ): Promise<{ entityId: string; version: number; entityType: VersionedEntityType }> {
    return this.prisma.$transaction(async (tx) => {
      const publishedAt = new Date();
      const review = recordedReview ?? { reviewedByUserId: actorId, reviewedAt: publishedAt };
      const { entityId, version, entityType } = await this.publishBySchema(
        tx,
        schemaVersion,
        payload,
        review.reviewedByUserId,
        review.reviewedAt,
      );

      await tx.contentVersion.create({
        data: {
          entityType,
          entityId,
          version,
          payload: payload as unknown as Prisma.InputJsonValue,
          schemaVersion,
          reviewStatus: "PUBLISHED",
          createdByUserId: actorId,
          reviewedByUserId: review.reviewedByUserId,
          reviewedAt: review.reviewedAt,
          publishedAt,
          publishedByImportItemId: importItemId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: "ImportPublished",
          payload: {
            schemaVersion,
            externalId: (payload as { external_id: string }).external_id,
            entityId,
            version,
          },
        },
      });

      await this.audit.log(
        {
          actorUserId: actorId,
          action: importItemId ? "import.published" : "content.authored",
          targetType: entityType,
          targetId: entityId,
          metadata: {
            version,
            importItemId,
            publisherUserId: actorId,
            reviewedByUserId: review.reviewedByUserId,
            reviewedAt: review.reviewedAt.toISOString(),
          },
        },
        tx,
      );

      return { entityId, version, entityType };
    });
  }

  private async publishBySchema(
    tx: Prisma.TransactionClient,
    schemaVersion: string,
    payload: ContractItem,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<{ entityId: string; version: number; entityType: VersionedEntityType }> {
    if (schemaVersion === "article.v1") {
      const p = payload as ArticleV1;
      const existing = await tx.article.findUnique({ where: { externalId: p.external_id } });
      const reviewer = await tx.contributorProfile.findUnique({ where: { userId: reviewerId } });
      const version = (existing?.version ?? 0) + 1;
      const data = {
        externalId: p.external_id,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        contentBlocks: p.content_blocks as unknown as Prisma.InputJsonValue,
        assets: (p.assets ?? []) as unknown as Prisma.InputJsonValue,
        taxonomyMajor: p.taxonomy.major,
        taxonomyTags: p.taxonomy.tags ?? [],
        provenance: p.provenance as unknown as Prisma.InputJsonValue,
        reviewerProfileId: reviewer?.id,
        reviewedAt,
        version,
        reviewStatus: "PUBLISHED" as const,
        publishedAt: new Date(),
      };
      const article = existing
        ? await tx.article.update({ where: { id: existing.id }, data })
        : await tx.article.create({ data });
      return { entityId: article.id, version, entityType: VersionedEntityType.ARTICLE };
    }

    if (schemaVersion === "article.v2") {
      const p = payload as ArticleV2;
      let existing = await tx.article.findUnique({ where: { externalId: p.external_id } });
      if (existing) {
        await this.lockArticle(tx, existing.id);
        existing = await tx.article.findUnique({ where: { id: existing.id } });
        const pending = await tx.contentVersion.findFirst({
          where: {
            entityType: VersionedEntityType.ARTICLE,
            entityId: existing!.id,
            schemaVersion: "article.v2",
            reviewStatus: { in: ["DRAFT", "IN_REVIEW"] },
          },
        });
        if (pending) throw new ForbiddenException("this article already has a pending revision");
      }
      const latest = existing
        ? await tx.contentVersion.findFirst({
            where: { entityType: VersionedEntityType.ARTICLE, entityId: existing.id },
            orderBy: { version: "desc" },
          })
        : null;
      const version = Math.max(existing?.version ?? 0, latest?.version ?? 0) + 1;
      const externalSourceIds = p.sources.map((source) => source.source_external_id);
      const sources = await tx.contentSource.findMany({ where: { externalId: { in: externalSourceIds }, archivedAt: null } });
      const sourceByExternalId = new Map(sources.map((source) => [source.externalId, source.id]));
      if (sourceByExternalId.size !== new Set(externalSourceIds).size) {
        throw new BadRequestException("article.v2 references an unknown or archived ContentSource");
      }
      const author = p.editorial?.author_slug
        ? await tx.contributorProfile.findUnique({ where: { slug: p.editorial.author_slug } })
        : null;
      if (p.editorial?.author_slug && !author) throw new BadRequestException("article.v2 author profile does not exist");
      const reviewer = await tx.contributorProfile.findUnique({ where: { userId: reviewerId } });
      const now = new Date();
      const sourceRows = p.sources.map((source) => ({
        sourceId: sourceByExternalId.get(source.source_external_id)!,
        relation: source.relation,
        locator: source.locator,
        claim: source.claim,
        order: source.order ?? 0,
      }));
      const data = {
        externalId: p.external_id,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        contentType: p.content_type.toUpperCase() as "ARTICLE" | "GUIDE" | "NEWS" | "CASE_STUDY",
        quickAnswer: p.quick_answer,
        contentBlocks: p.content_blocks as unknown as Prisma.InputJsonValue,
        assets: (p.assets ?? []) as unknown as Prisma.InputJsonValue,
        taxonomyMajor: p.taxonomy.major,
        taxonomyTags: p.taxonomy.tags ?? [],
        taxonomyDegrees: p.taxonomy.degrees.map((degree) => degree.toUpperCase() as "MASTER" | "PHD"),
        taxonomyFields: p.taxonomy.fields,
        subjectCodes: p.taxonomy.subject_codes,
        topicCodes: p.taxonomy.topic_codes,
        seoTitle: p.seo.title,
        seoDescription: p.seo.description,
        validForYear: p.validity.exam_year,
        sourceValidatedAt: p.validity.source_checked_at ? new Date(p.validity.source_checked_at) : null,
        reviewDueAt: p.validity.review_due_at ? new Date(p.validity.review_due_at) : null,
        provenance: p.provenance as unknown as Prisma.InputJsonValue,
        authorProfileId: author?.id,
        reviewerProfileId: reviewer?.id,
        reviewedAt,
        version,
        reviewStatus: "PUBLISHED" as const,
        publishedAt: now,
      };
      const article = existing
        ? await tx.article.update({
            where: { id: existing.id },
            data: { ...data, sources: { deleteMany: {}, create: sourceRows } },
          })
        : await tx.article.create({ data: { ...data, sources: { create: sourceRows } } });
      return { entityId: article.id, version, entityType: VersionedEntityType.ARTICLE };
    }

    if (schemaVersion === "report-card.v1") {
      const p = payload as ReportCardV1;
      const existing = await tx.reportCard.findUnique({ where: { externalId: p.external_id } });
      const version = (existing?.version ?? 0) + 1;
      const data = {
        externalId: p.external_id,
        anonymousId: p.anonymous_id,
        examYear: p.exam_year,
        degree: p.degree.toUpperCase() as "MASTER" | "PHD",
        field: p.field,
        quota: p.quota,
        subjectScores: p.subject_scores as unknown as Prisma.InputJsonValue,
        rank: p.rank as unknown as Prisma.InputJsonValue,
        admissions: p.admissions as unknown as Prisma.InputJsonValue,
        provenance: p.provenance as unknown as Prisma.InputJsonValue,
        version,
      };
      const reportCard = existing
        ? await tx.reportCard.update({ where: { id: existing.id }, data })
        : await tx.reportCard.create({ data });
      return { entityId: reportCard.id, version, entityType: VersionedEntityType.REPORT_CARD };
    }

    const p = payload as QuestionV1;
    const existing = await tx.question.findUnique({ where: { externalId: p.external_id } });
    const version = (existing?.version ?? 0) + 1;
    const data = {
      externalId: p.external_id,
      examDegree: p.exam.degree.toUpperCase() as "MASTER" | "PHD",
      examMajor: p.exam.major,
      examYear: p.exam.year,
      subjectCode: p.subject_code,
      topicCodes: p.topic_codes,
      stemBlocks: p.stem_blocks as unknown as Prisma.InputJsonValue,
      options: p.options as unknown as Prisma.InputJsonValue,
      correctOption: p.correct_option,
      solutionBlocks: p.solution_blocks as unknown as Prisma.InputJsonValue,
      assets: (p.assets ?? []) as unknown as Prisma.InputJsonValue,
      source: (p.source ?? null) as unknown as Prisma.InputJsonValue,
      provenance: p.provenance as unknown as Prisma.InputJsonValue,
      version,
    };
    const question = existing
      ? await tx.question.update({ where: { id: existing.id }, data })
      : await tx.question.create({ data });
    return { entityId: question.id, version, entityType: VersionedEntityType.QUESTION };
  }

  /** doc §10.2 Phase 3 DoD: "تاریخچه کامل" -- complete history for a piece of
   * versioned content, oldest first. */
  async listVersions(entityType: VersionedEntityType, entityId: string) {
    return this.prisma.contentVersion.findMany({
      where: { entityType, entityId },
      orderBy: { version: "asc" },
    });
  }

  async rollbackEntity(entityType: VersionedEntityType, entityId: string, toVersion: number, actorId: string) {
    if (entityType === VersionedEntityType.RESOURCE) {
      throw new BadRequestException("resource rollback must use the editorial resource revision workflow");
    }

    const target = await this.prisma.contentVersion.findUnique({
      where: { entityType_entityId_version: { entityType, entityId, version: toVersion } },
    });
    if (!target) throw new NotFoundException("target version not found");

    if (entityType === VersionedEntityType.ARTICLE && target.schemaVersion === "article.v2") {
      if (target.reviewStatus !== "PUBLISHED") {
        throw new ForbiddenException("only a published article version can be used as a rollback target");
      }
      const draft = await this.prisma.$transaction(async (tx) => {
        await this.lockArticle(tx, entityId);
        const article = await tx.article.findUnique({ where: { id: entityId } });
        if (!article) throw new NotFoundException("article not found");
        const pending = await tx.contentVersion.findFirst({
          where: {
            entityType: VersionedEntityType.ARTICLE,
            entityId,
            schemaVersion: "article.v2",
            reviewStatus: { in: ["DRAFT", "IN_REVIEW"] },
          },
        });
        if (pending) throw new ForbiddenException("this article already has a pending revision");
        const latest = await tx.contentVersion.findFirstOrThrow({
          where: { entityType, entityId },
          orderBy: { version: "desc" },
        });
        const newVersion = Math.max(article.version, latest.version) + 1;
        await tx.contentVersion.create({
          data: {
            entityType,
            entityId,
            version: newVersion,
            payload: { ...(target.payload as Prisma.JsonObject), review_status: "draft" },
            schemaVersion: "article.v2",
            reviewStatus: "DRAFT",
            createdByUserId: actorId,
          },
        });
        await this.audit.log(
          {
            actorUserId: actorId,
            action: "content.rollback_draft_created",
            targetType: entityType,
            targetId: entityId,
            metadata: { toVersion, newVersion },
          },
          tx,
        );
        return { entityId, newVersion, restoredFromVersion: toVersion, pendingReview: true };
      });
      return draft;
    }

    const latest = await this.prisma.contentVersion.findFirstOrThrow({
      where: { entityType, entityId },
      orderBy: { version: "desc" },
    });
    const newVersion = latest.version + 1;
    const payload = target.payload as unknown as ContractItem;

    await this.prisma.$transaction(async (tx) => {
      if (entityType === VersionedEntityType.ARTICLE) {
        const p = payload as ArticleV1;
        await tx.article.update({
          where: { id: entityId },
          data: {
            title: p.title,
            summary: p.summary,
            contentBlocks: p.content_blocks as unknown as Prisma.InputJsonValue,
            assets: (p.assets ?? []) as unknown as Prisma.InputJsonValue,
            taxonomyMajor: p.taxonomy.major,
            taxonomyTags: p.taxonomy.tags ?? [],
            version: newVersion,
          },
        });
      } else if (entityType === VersionedEntityType.REPORT_CARD) {
        const p = payload as ReportCardV1;
        await tx.reportCard.update({
          where: { id: entityId },
          data: {
            subjectScores: p.subject_scores as unknown as Prisma.InputJsonValue,
            rank: p.rank as unknown as Prisma.InputJsonValue,
            admissions: p.admissions as unknown as Prisma.InputJsonValue,
            version: newVersion,
          },
        });
      } else {
        const p = payload as QuestionV1;
        await tx.question.update({
          where: { id: entityId },
          data: {
            stemBlocks: p.stem_blocks as unknown as Prisma.InputJsonValue,
            options: p.options as unknown as Prisma.InputJsonValue,
            correctOption: p.correct_option,
            solutionBlocks: p.solution_blocks as unknown as Prisma.InputJsonValue,
            version: newVersion,
          },
        });
      }

      await tx.contentVersion.create({
        data: {
          entityType,
          entityId,
          version: newVersion,
          payload: payload as unknown as Prisma.InputJsonValue,
          schemaVersion: target.schemaVersion,
          reviewStatus: "PUBLISHED",
          createdByUserId: actorId,
          reviewedByUserId: actorId,
          reviewedAt: new Date(),
          publishedAt: new Date(),
        },
      });

      await this.audit.log(
        {
          actorUserId: actorId,
          action: "content.rolled_back",
          targetType: entityType,
          targetId: entityId,
          metadata: { toVersion, newVersion },
        },
        tx,
      );
    });

    return { entityId, newVersion, restoredFromVersion: toVersion };
  }

  private async lockArticle(tx: Prisma.TransactionClient, articleId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "articles" WHERE "id" = ${articleId} FOR UPDATE`);
    if (rows.length === 0) throw new NotFoundException("article not found");
  }
}

function schemaVersionToEntityType(schemaVersion: string): VersionedEntityType {
  if (schemaVersion.startsWith("article.")) return VersionedEntityType.ARTICLE;
  if (schemaVersion === "report-card.v1") return VersionedEntityType.REPORT_CARD;
  return VersionedEntityType.QUESTION;
}
