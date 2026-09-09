import {
  AccessMode,
  Degree,
  Prisma,
  PrismaClient,
  ResourceHostingMode,
  ResourceKind,
  ReviewStatus,
  VersionedEntityType,
} from "@prisma/client";
import seedData from "./seed-data/resource-drafts.json";

type SeedSource = (typeof seedData.sources)[number];
type SeedResource = (typeof seedData.resources)[number];

function sourceCreateData(source: SeedSource): Prisma.ContentSourceCreateInput {
  return {
    externalId: source.externalId,
    kind: source.kind,
    title: source.title,
    publisher: source.publisher,
    canonicalUrl: source.canonicalUrl,
    sourceTier: source.sourceTier,
    checkedAt: new Date(source.checkedAt),
    rightsBasis: source.rightsBasis,
    mayLink: source.mayLink,
    mayEmbed: source.mayEmbed,
    mayQuote: source.mayQuote,
    mayReproduce: source.mayReproduce,
    mayAdapt: source.mayAdapt,
    mayTranslate: source.mayTranslate,
    mayHost: source.mayHost,
    commercialUseAllowed: source.commercialUseAllowed,
    attributionText: source.attributionText,
    metadata: source.metadata as Prisma.InputJsonValue,
  };
}

function versionPayload(resource: SeedResource, sourceId: string): Prisma.InputJsonValue {
  return {
    schema_version: "resource.v1",
    external_id: resource.externalId,
    slug: resource.slug,
    title: resource.title,
    summary: resource.summary,
    description: resource.description,
    kind: resource.kind,
    access_mode: resource.accessMode,
    hosting_mode: resource.hostingMode,
    content_blocks: [],
    external_url: resource.externalUrl,
    source_artifact_id: null,
    taxonomy: {
      degrees: resource.taxonomyDegrees,
      fields: resource.taxonomyFields,
      subject_codes: resource.subjectCodes,
      topic_codes: resource.topicCodes,
    },
    author_profile_id: null,
    metadata: resource.metadata,
    provenance: resource.provenance,
    sources: [{
      source_id: sourceId,
      relation: "SUPPORTS",
      locator: null,
      claim: resource.sourceClaim,
      order: 0,
    }],
  } as Prisma.InputJsonValue;
}

export async function seedStaticResources(prisma: PrismaClient) {
  for (const source of seedData.sources) {
    await prisma.contentSource.upsert({
      where: { externalId: source.externalId },
      update: {
        rightsBasis: source.rightsBasis,
        mayLink: source.mayLink,
        mayEmbed: source.mayEmbed,
        mayQuote: source.mayQuote,
        mayReproduce: source.mayReproduce,
        mayAdapt: source.mayAdapt,
        mayTranslate: source.mayTranslate,
        mayHost: source.mayHost,
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

  for (const resource of seedData.resources) {
    const sourceId = sourceIds.get(resource.sourceExternalId);
    if (!sourceId) throw new Error(`Missing Phase 14 source ${resource.sourceExternalId}`);

    await prisma.$transaction(async (tx) => {
      // A deployment seed may create a missing Draft, but must never replace
      // later human edits, publication decisions or source associations.
      const existing = await tx.resource.findUnique({ where: { slug: resource.slug } });
      if (existing) return;

      const created = await tx.resource.create({
        data: {
          externalId: resource.externalId,
          slug: resource.slug,
          title: resource.title,
          summary: resource.summary,
          description: resource.description,
          kind: resource.kind as ResourceKind,
          accessMode: resource.accessMode as AccessMode,
          hostingMode: resource.hostingMode as ResourceHostingMode,
          contentBlocks: [],
          externalUrl: resource.externalUrl,
          taxonomyDegrees: resource.taxonomyDegrees as Degree[],
          taxonomyFields: resource.taxonomyFields,
          subjectCodes: resource.subjectCodes,
          topicCodes: resource.topicCodes,
          provenance: resource.provenance as Prisma.InputJsonValue,
          metadata: resource.metadata as Prisma.InputJsonValue,
          reviewStatus: ReviewStatus.DRAFT,
          sources: {
            create: {
              sourceId,
              relation: "SUPPORTS",
              claim: resource.sourceClaim,
              order: 0,
            },
          },
        },
      });

      await tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.RESOURCE,
          entityId: created.id,
          version: created.version,
          payload: versionPayload(resource, sourceId),
          schemaVersion: "resource.v1",
          reviewStatus: ReviewStatus.DRAFT,
        },
      });
    });
  }
}
