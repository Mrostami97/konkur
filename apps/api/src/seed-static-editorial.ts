import { ArticleContentType, Degree, Prisma, PrismaClient, ReviewStatus, VersionedEntityType } from "@prisma/client";
import { ArticleV2, validateArticleV2 } from "@konkurcom/contracts";
import seedData from "./seed-data/editorial-drafts.json";

type SeedSource = (typeof seedData.sources)[number];

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
      sourceId: sourceIds.get(source.source_external_id)!,
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
      if (existing) return;

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
