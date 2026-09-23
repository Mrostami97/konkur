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
import data from "./seed-data/free-lectures.json";

type Publisher = (typeof data.publishers)[number];
type Lecture = (typeof data.resources)[number];

/**
 * Free university lectures the owner chose to point students at, one per
 * subject where the site has no video of its own yet.
 *
 * Link-only by construction: `hostingMode` is EXTERNAL_LINK and every source
 * says `mayEmbed`/`mayHost`/`mayReproduce` false. Sharif's courseware footer
 * forbids republication without the university's permission, so these are
 * cards that send the student to the original page -- never a player on ours.
 *
 * Each lecture gets its own ContentSource whose canonicalUrl is that
 * lecture's exact URL. The editorial link-permission check compares URLs
 * exactly, so every link is cleared individually; one source for a whole
 * publisher would clear none of them.
 *
 * Unlike the Phase 14 AI-assisted drafts, these are created published: the
 * owner selected each one personally and every link was opened and checked.
 * Like them, a row that already exists is never touched, so a later edit or
 * an unpublish in the admin panel survives every redeploy.
 */
export async function seedFreeLectures(prisma: PrismaClient) {
  const publishers = new Map(data.publishers.map((publisher) => [publisher.id, publisher]));
  const checkedAt = new Date(data.checkedAt);

  for (const lecture of data.resources) {
    const publisher = publishers.get(lecture.publisher);
    if (!publisher) throw new Error(`Unknown free-lecture publisher ${lecture.publisher}`);

    const source = await prisma.contentSource.upsert({
      where: { externalId: `free-source-${lecture.slug}` },
      update: {},
      create: sourceFor(lecture, publisher, checkedAt),
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      const existing = await tx.resource.findUnique({ where: { slug: lecture.slug }, select: { id: true } });
      if (existing) return;

      const created = await tx.resource.create({
        data: {
          externalId: lecture.externalId,
          slug: lecture.slug,
          title: lecture.title,
          summary: lecture.summary,
          description:
            "این کارت فقط شما را به صفحهٔ اصلی درس می‌برد. ویدیوها متعلق به ناشر اصلی است و روی این سایت کپی یا پخش نمی‌شود.",
          kind: ResourceKind.VIDEO,
          accessMode: AccessMode.PUBLIC,
          hostingMode: ResourceHostingMode.EXTERNAL_LINK,
          contentBlocks: [],
          externalUrl: lecture.externalUrl,
          taxonomyDegrees: [Degree.MASTER],
          taxonomyFields: lecture.taxonomyFields,
          subjectCodes: lecture.subjectCodes,
          topicCodes: [],
          provenance: provenanceOf(lecture) as Prisma.InputJsonValue,
          metadata: metadataOf(lecture) as Prisma.InputJsonValue,
          reviewStatus: ReviewStatus.PUBLISHED,
          reviewedAt: checkedAt,
          publishedAt: checkedAt,
          sources: {
            create: {
              sourceId: source.id,
              relation: "SUPPORTS",
              claim: "نشانی صفحهٔ اصلی درس رایگان در سایت ناشر.",
              order: 0,
            },
          },
        },
      });

      await tx.contentVersion.create({
        data: {
          entityType: VersionedEntityType.RESOURCE,
          entityId: created.id,
          version: 1,
          payload: {
            schema_version: "resource.v1",
            external_id: lecture.externalId,
            slug: lecture.slug,
            title: lecture.title,
            kind: "VIDEO",
            hosting_mode: "EXTERNAL_LINK",
            external_url: lecture.externalUrl,
            subject_codes: lecture.subjectCodes,
            provenance: provenanceOf(lecture),
          } as Prisma.InputJsonValue,
        },
      });
    });
  }
}

function sourceFor(lecture: Lecture, publisher: Publisher, checkedAt: Date): Prisma.ContentSourceCreateInput {
  return {
    externalId: `free-source-${lecture.slug}`,
    kind: publisher.kind,
    title: lecture.title,
    publisher: publisher.publisher,
    canonicalUrl: lecture.externalUrl,
    sourceTier: publisher.sourceTier,
    checkedAt,
    rightsBasis: publisher.rightsBasis,
    mayLink: publisher.mayLink,
    mayEmbed: publisher.mayEmbed,
    mayQuote: publisher.mayQuote,
    mayReproduce: publisher.mayReproduce,
    mayAdapt: publisher.mayAdapt,
    mayTranslate: publisher.mayTranslate,
    mayHost: publisher.mayHost,
    commercialUseAllowed: publisher.commercialUseAllowed,
    attributionText: publisher.attributionText,
    metadata: publisher.metadata as Prisma.InputJsonValue,
  };
}

function provenanceOf(lecture: Lecture) {
  return {
    producer_type: "human",
    producer_name: "owner-selected free lecture",
    source_artifact: `apps/api/src/seed-data/free-lectures.json:${lecture.slug}`,
    checked_at: data.checkedAt,
  };
}

/** What the free-video card shows. Kept in metadata rather than new columns:
 * it is display detail for one kind of resource, not a field every resource
 * needs. */
function metadataOf(lecture: Lecture) {
  return {
    freeLecture: {
      instructor: lecture.instructor,
      institution: lecture.institution,
      sessions: lecture.sessions,
      companionUrl: "companionUrl" in lecture ? lecture.companionUrl : null,
    },
    catalog: {
      learningType: "ویدیوی کلاس دانشگاهی",
      costLabel: "رایگان",
      sampleLabel: "تماشا در سایت ناشر",
    },
  };
}
