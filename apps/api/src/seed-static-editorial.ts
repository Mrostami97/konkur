import { ArticleContentType, Degree, Prisma, PrismaClient, ReviewStatus, VersionedEntityType } from "@prisma/client";
import { ArticleV2, validateArticleV2 } from "@konkurcom/contracts";
import seedData from "./seed-data/editorial-drafts.json";
import phase17LegacyDrafts from "./seed-data/phase17-legacy-editorial-drafts.json";

type SeedSource = (typeof seedData.sources)[number];

const legacyPhase17Payloads = new Map<string, (typeof phase17LegacyDrafts.articles)[number]>(
  phase17LegacyDrafts.articles.map((payload) => [payload.slug, payload] as const),
);

function stableJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(
        Object.entries(candidate as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return candidate;
  };
  return JSON.stringify(normalize(value));
}

function sourceCreateData(source: SeedSource) {
  return {
    externalId: source.externalId,
    kind: source.kind,
    title: source.title,
    publisher: source.publisher,
    canonicalUrl: source.canonicalUrl,
    sourceTier: source.sourceTier,
    publishedAt: "publishedAt" in source && source.publishedAt ? new Date(source.publishedAt) : null,
    checkedAt: new Date(source.checkedAt),
    rightsBasis: source.rightsBasis,
    mayLink: source.mayLink,
    mayAdapt: source.mayAdapt,
    commercialUseAllowed: source.commercialUseAllowed,
    attributionText: source.attributionText,
    metadata: source.metadata,
  };
}

export async function seedStaticEditorial(prisma: PrismaClient) {
  for (const source of seedData.sources) {
    await prisma.contentSource.upsert({
      where: { externalId: source.externalId },
      // Rights flags are safety policy, so rerunning the seed must apply a
      // downgrade even when this source was created by an older fixture.
      update: {
        rightsBasis: source.rightsBasis,
        mayLink: source.mayLink,
        mayAdapt: source.mayAdapt,
        commercialUseAllowed: source.commercialUseAllowed,
      },
      create: sourceCreateData(source),
    });
  }

  const sourceRows = await prisma.contentSource.findMany({
    where: { externalId: { in: seedData.sources.map((source) => source.externalId) } },
    select: { id: true, externalId: true },
  });
  const sourceIds = new Map(sourceRows.map((source) => [source.externalId, source.id]));

  for (const rawPayload of seedData.articles) {
    const validation = validateArticleV2(rawPayload);
    if (!validation.valid || !validation.data) {
      throw new Error("Invalid generated article.v2 draft " + rawPayload.slug + ": " + validation.errors.join("; "));
    }
    const payload = validation.data as ArticleV2;
    const sourceLinks = payload.sources.map((source) => ({
      source: {
        connect: { id: sourceIds.get(source.source_external_id)! },
      },
      relation: source.relation,
      locator: source.locator,
      claim: source.claim,
      order: source.order ?? 0,
    }));
    const canonicalData = {
      externalId: payload.external_id,
      contentType: payload.content_type.toUpperCase() as ArticleContentType,
      title: payload.title,
      summary: payload.summary,
      quickAnswer: payload.quick_answer,
      contentBlocks: payload.content_blocks as unknown as Prisma.InputJsonValue,
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
      reviewStatus: ReviewStatus.DRAFT,
      authorProfileId: null,
      reviewerProfileId: null,
    };

    await prisma.$transaction(async (tx) => {
      // Deployment seeds must never replace editorial work. The existence
      // check and both inserts share a transaction so a partial seed cannot
      // leave a canonical article without its required version snapshot.
      const existing = await tx.article.findUnique({ where: { slug: payload.slug } });
      if (existing) {
        const legacyRawPayload = legacyPhase17Payloads.get(payload.slug);
        if (!legacyRawPayload || existing.version !== 1 || existing.reviewStatus !== ReviewStatus.DRAFT) return;

        const legacyValidation = validateArticleV2(legacyRawPayload);
        if (!legacyValidation.valid || !legacyValidation.data) {
          throw new Error("Invalid Phase 17 legacy draft guard " + payload.slug + ": " + legacyValidation.errors.join("; "));
        }
        const legacyPayload = legacyValidation.data as ArticleV2;
        const currentVersion = await tx.contentVersion.findUnique({
          where: {
            entityType_entityId_version: {
              entityType: VersionedEntityType.ARTICLE,
              entityId: existing.id,
              version: existing.version,
            },
          },
        });
        const existingSourceLinks = await tx.articleSource.findMany({
          where: { articleId: existing.id },
          orderBy: { order: "asc" },
          select: {
            relation: true,
            locator: true,
            claim: true,
            order: true,
            source: { select: { externalId: true } },
          },
        });
        const expectedLegacySourceLinks = legacyPayload.sources.map((source) => ({
          relation: source.relation,
          locator: source.locator ?? null,
          claim: source.claim ?? null,
          order: source.order ?? 0,
          source: { externalId: source.source_external_id },
        }));
        const canonicalStillMatchesLegacy = existing.externalId === legacyPayload.external_id
          && existing.contentType === (legacyPayload.content_type.toUpperCase() as ArticleContentType)
          && existing.title === legacyPayload.title
          && existing.summary === legacyPayload.summary
          && existing.quickAnswer === legacyPayload.quick_answer
          && stableJson(existing.contentBlocks) === stableJson(legacyPayload.content_blocks)
          && stableJson(existing.taxonomyMajor) === stableJson(legacyPayload.taxonomy.major)
          && stableJson(existing.taxonomyTags) === stableJson(legacyPayload.taxonomy.tags ?? [])
          && stableJson(existing.taxonomyDegrees) === stableJson(legacyPayload.taxonomy.degrees.map((degree) => degree.toUpperCase()))
          && stableJson(existing.taxonomyFields) === stableJson(legacyPayload.taxonomy.fields)
          && stableJson(existing.subjectCodes) === stableJson(legacyPayload.taxonomy.subject_codes)
          && stableJson(existing.topicCodes) === stableJson(legacyPayload.taxonomy.topic_codes)
          && existing.seoTitle === legacyPayload.seo.title
          && existing.seoDescription === legacyPayload.seo.description
          && existing.validForYear === legacyPayload.validity.exam_year
          && existing.sourceValidatedAt?.toISOString() === legacyPayload.validity.source_checked_at
          && existing.reviewDueAt?.toISOString() === legacyPayload.validity.review_due_at
          && existing.authorProfileId === null
          && existing.reviewerProfileId === null
          && existing.reviewedAt === null
          && existing.publishedAt === null;
        const versionStillMatchesLegacy = currentVersion?.schemaVersion === "article.v2"
          && currentVersion.reviewStatus === ReviewStatus.DRAFT
          && stableJson(currentVersion.payload) === stableJson(legacyPayload);

        // The three pre-Phase-17 PhD pages shared the final slugs but carried
        // obsolete material. Replace only their exact untouched seed payloads,
        // preserve version 1, and leave every human edit/review state alone.
        if (
          !canonicalStillMatchesLegacy
          || !versionStillMatchesLegacy
          || stableJson(existingSourceLinks) !== stableJson(expectedLegacySourceLinks)
        ) return;

        const nextVersion = existing.version + 1;
        await tx.contentVersion.create({
          data: {
            entityType: VersionedEntityType.ARTICLE,
            entityId: existing.id,
            version: nextVersion,
            payload: payload as unknown as Prisma.InputJsonValue,
            schemaVersion: "article.v2",
            reviewStatus: ReviewStatus.DRAFT,
          },
        });
        await tx.article.update({
          where: { id: existing.id },
          data: {
            ...canonicalData,
            version: nextVersion,
            sources: {
              deleteMany: {},
              create: sourceLinks,
            },
          },
        });
        return;
      }

      const article = await tx.article.create({
        data: {
          ...canonicalData,
          slug: payload.slug,
          sources: { create: sourceLinks },
        },
      });

      await tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.ARTICLE,
          entityId: article.id,
          version: article.version,
          payload: payload as unknown as Prisma.InputJsonValue,
          schemaVersion: "article.v2",
          reviewStatus: ReviewStatus.DRAFT,
        },
      });
    });
  }
}
