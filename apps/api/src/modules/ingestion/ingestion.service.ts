import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ArticleV1,
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

type ContractItem = ArticleV1 | QuestionV1 | ReportCardV1;

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
    if (!["article.v1", "report-card.v1", "question.v1"].includes(schemaVersion)) {
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

  private async stageItem(
    jobId: string,
    schemaVersion: string,
    rawItem: unknown,
    files: Map<string, Buffer>,
  ) {
    const externalId = extractExternalId(rawItem) ?? "unknown";

    const validation =
      schemaVersion === "article.v1"
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
      schemaVersion === "article.v1"
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
    const job = await this.prisma.importJob.findUniqueOrThrow({ where: { id: item.importJobId } });
    const payload = item.rawPayload as unknown as ContractItem;

    return this.prisma.$transaction(async (tx) => {
      const { entityId, version, entityType } = await this.publishBySchema(tx, job.schemaVersion, payload);

      await tx.contentVersion.create({
        data: {
          entityType,
          entityId,
          version,
          payload: payload as unknown as Prisma.InputJsonValue,
          publishedByImportItemId: item.id,
        },
      });

      const updatedItem = await tx.importItem.update({
        where: { id: item.id },
        data: { status: ImportItemStatus.PUBLISHED, publishedEntityId: entityId, publishedVersion: version },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: "ImportPublished",
          payload: { schemaVersion: job.schemaVersion, externalId: item.externalId, entityId, version },
        },
      });

      await this.audit.log(
        {
          actorUserId: actorId,
          action: "import.published",
          targetType: entityType,
          targetId: entityId,
          metadata: { version, importItemId: item.id },
        },
        tx,
      );

      return updatedItem;
    });
  }

  private async publishBySchema(
    tx: Prisma.TransactionClient,
    schemaVersion: string,
    payload: ContractItem,
  ): Promise<{ entityId: string; version: number; entityType: VersionedEntityType }> {
    if (schemaVersion === "article.v1") {
      const p = payload as ArticleV1;
      const existing = await tx.article.findUnique({ where: { externalId: p.external_id } });
      const version = (existing?.version ?? 0) + 1;
      const data = {
        externalId: p.external_id,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        contentBlocks: p.content_blocks as unknown as Prisma.InputJsonValue,
        taxonomyMajor: p.taxonomy.major,
        taxonomyTags: p.taxonomy.tags ?? [],
        provenance: p.provenance as unknown as Prisma.InputJsonValue,
        version,
        reviewStatus: "PUBLISHED" as const,
        publishedAt: new Date(),
      };
      const article = existing
        ? await tx.article.update({ where: { id: existing.id }, data })
        : await tx.article.create({ data });
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

  async rollbackEntity(entityType: VersionedEntityType, entityId: string, toVersion: number, actorId: string) {
    const target = await this.prisma.contentVersion.findUnique({
      where: { entityType_entityId_version: { entityType, entityId, version: toVersion } },
    });
    if (!target) throw new NotFoundException("target version not found");

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
        data: { entityType, entityId, version: newVersion, payload: payload as unknown as Prisma.InputJsonValue },
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
}

function schemaVersionToEntityType(schemaVersion: string): VersionedEntityType {
  if (schemaVersion === "article.v1") return VersionedEntityType.ARTICLE;
  if (schemaVersion === "report-card.v1") return VersionedEntityType.REPORT_CARD;
  return VersionedEntityType.QUESTION;
}
