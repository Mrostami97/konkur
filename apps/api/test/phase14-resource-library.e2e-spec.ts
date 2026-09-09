import "reflect-metadata";
import { BadRequestException, INestApplication, ValidationPipe } from "@nestjs/common";
import {
  AccessMode,
  Degree,
  ResourceHostingMode,
  ResourceKind,
  ReviewStatus,
  VersionedEntityType,
} from "@prisma/client";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import resourceSeed from "../src/seed-data/resource-drafts.json";
import { seedStaticResources } from "../src/seed-static-resources";
import { EditorialService } from "../src/modules/content/editorial.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Phase 14 resource library (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let editorial: EditorialService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const actorId = `phase14-actor-${suffix}`;
  const firstSlug = `phase14-filter-first-${suffix}`;
  const secondSlug = `phase14-filter-second-${suffix}`;
  const draftSlug = `phase14-filter-draft-${suffix}`;
  const rejectedSlug = `phase14-no-link-${suffix}`;
  const mismatchSlug = `phase14-mismatch-${suffix}`;
  const firstSubject = `phase14-data-structures-${suffix}`;
  const secondSubject = `phase14-automata-${suffix}`;
  const firstTopic = `phase14-hashing-${suffix}`;
  const secondTopic = `phase14-formal-languages-${suffix}`;
  const fixtureResourceIds: string[] = [];
  const fixtureSourceIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    editorial = app.get(EditorialService);

    const firstUrl = `https://example.test/phase14/${suffix}/first`;
    const secondUrl = `https://example.test/phase14/${suffix}/second`;
    const [firstSource, secondSource, blockedSource] = await Promise.all([
      prisma.contentSource.create({
        data: {
          externalId: `phase14-source-first-${suffix}`,
          kind: "TEST_PAGE",
          title: "Phase 14 first source",
          publisher: "Test publisher",
          canonicalUrl: firstUrl,
          sourceTier: "FIRST_PARTY",
          checkedAt: new Date("2026-09-08T00:00:00.000Z"),
          rightsBasis: "LINK_ONLY",
          mayLink: true,
        },
      }),
      prisma.contentSource.create({
        data: {
          externalId: `phase14-source-second-${suffix}`,
          kind: "TEST_PAGE",
          title: "Phase 14 second source",
          publisher: "Test publisher",
          canonicalUrl: secondUrl,
          sourceTier: "FIRST_PARTY",
          checkedAt: new Date("2026-08-20T00:00:00.000Z"),
          rightsBasis: "LINK_ONLY",
          mayLink: true,
        },
      }),
      prisma.contentSource.create({
        data: {
          externalId: `phase14-source-blocked-${suffix}`,
          kind: "TEST_PAGE",
          title: "Phase 14 blocked source",
          publisher: "Test publisher",
          canonicalUrl: `https://example.test/phase14/${suffix}/blocked`,
          sourceTier: "FIRST_PARTY",
          checkedAt: new Date("2026-09-08T00:00:00.000Z"),
          rightsBasis: "LINK_ONLY",
          mayLink: false,
        },
      }),
    ]);
    fixtureSourceIds.push(firstSource.id, secondSource.id, blockedSource.id);

    const [first, second, draft] = await Promise.all([
      prisma.resource.create({
        data: {
          externalId: `phase14-filter-first-${suffix}`,
          slug: firstSlug,
          title: "منبع فیلتر اول",
          summary: "منبع عمومی برای آزمون فیلترهای فاز چهارده.",
          kind: ResourceKind.TELEGRAM_POST,
          accessMode: AccessMode.PUBLIC,
          hostingMode: ResourceHostingMode.EXTERNAL_LINK,
          externalUrl: firstUrl,
          taxonomyDegrees: [Degree.MASTER],
          taxonomyFields: ["computer-engineering"],
          subjectCodes: [firstSubject],
          topicCodes: [firstTopic],
          metadata: {
            catalog: {
              learningType: "حل تمرین",
              startLevel: "متوسط",
              coverage: "هش",
              volume: "یک جلسه",
              sampleLabel: "نمونهٔ اصلی",
              costLabel: "رایگان",
              relatedGuideSlugs: ["choose-study-resources", "INVALID VALUE", "choose-study-resources"],
              privateEditorialNote: "must never be public",
            },
            privateStorageKey: "must-never-leak",
          },
          provenance: { secret: `phase14-provenance-${suffix}` },
          reviewStatus: ReviewStatus.PUBLISHED,
          reviewedAt: new Date("2026-09-08T12:00:00.000Z"),
          publishedAt: new Date("2026-09-08T12:00:00.000Z"),
          sources: { create: { sourceId: firstSource.id, relation: "SUPPORTS", order: 0 } },
        },
      }),
      prisma.resource.create({
        data: {
          externalId: `phase14-filter-second-${suffix}`,
          slug: secondSlug,
          title: "منبع فیلتر دوم",
          summary: "منبع عمومی دوم برای تفکیک نتیجه‌ها.",
          kind: ResourceKind.VIDEO,
          accessMode: AccessMode.PUBLIC,
          hostingMode: ResourceHostingMode.EXTERNAL_LINK,
          externalUrl: secondUrl,
          taxonomyDegrees: [Degree.PHD],
          taxonomyFields: ["computer-science"],
          subjectCodes: [secondSubject],
          topicCodes: [secondTopic],
          reviewStatus: ReviewStatus.PUBLISHED,
          reviewedAt: new Date("2026-08-20T12:00:00.000Z"),
          publishedAt: new Date("2026-08-20T12:00:00.000Z"),
          sources: { create: { sourceId: secondSource.id, relation: "SUPPORTS", order: 0 } },
        },
      }),
      prisma.resource.create({
        data: {
          externalId: `phase14-filter-draft-${suffix}`,
          slug: draftSlug,
          title: "منبع پیش‌نویس فیلتر",
          summary: "این رکورد نباید در پاسخ عمومی دیده شود.",
          kind: ResourceKind.TELEGRAM_POST,
          accessMode: AccessMode.PUBLIC,
          hostingMode: ResourceHostingMode.EXTERNAL_LINK,
          externalUrl: firstUrl,
          taxonomyDegrees: [Degree.MASTER],
          taxonomyFields: ["computer-engineering"],
          subjectCodes: [firstSubject],
          topicCodes: [firstTopic],
          reviewStatus: ReviewStatus.DRAFT,
          sources: { create: { sourceId: firstSource.id, relation: "SUPPORTS", order: 0 } },
        },
      }),
    ]);
    fixtureResourceIds.push(first.id, second.id, draft.id);

    const rejected = await editorial.createResource(actorId, {
      externalId: `phase14-no-link-${suffix}`,
      slug: rejectedSlug,
      title: "منبع بدون اجازهٔ لینک",
      summary: "این منبع نباید امکان ارسال برای بازبینی داشته باشد.",
      kind: ResourceKind.TELEGRAM_POST,
      accessMode: AccessMode.PUBLIC,
      hostingMode: ResourceHostingMode.EXTERNAL_LINK,
      externalUrl: `https://example.test/phase14/${suffix}/blocked`,
      sources: [{ sourceId: blockedSource.id, relation: "SUPPORTS", order: 0 }],
    });
    const mismatch = await editorial.createResource(actorId, {
      externalId: `phase14-mismatch-${suffix}`,
      slug: mismatchSlug,
      title: "منبع با لینک نامنطبق",
      summary: "منبع فعال نباید یک نشانی خارجی متفاوت را مجاز کند.",
      kind: ResourceKind.TELEGRAM_POST,
      accessMode: AccessMode.PUBLIC,
      hostingMode: ResourceHostingMode.EXTERNAL_LINK,
      externalUrl: `https://example.test/phase14/${suffix}/different`,
      sources: [{ sourceId: firstSource.id, relation: "SUPPORTS", order: 0 }],
    });
    fixtureResourceIds.push(rejected.id, mismatch.id);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.contentVersion.deleteMany({
        where: { entityType: VersionedEntityType.RESOURCE, entityId: { in: fixtureResourceIds } },
      });
      await prisma.resource.deleteMany({ where: { id: { in: fixtureResourceIds } } });
      await prisma.contentSource.deleteMany({ where: { id: { in: fixtureSourceIds } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    }
    await app.close();
  });

  it("seeds eight provenance-bearing Draft resources idempotently without replacing editorial work", async () => {
    await seedStaticResources(prisma);
    const seeded = await prisma.resource.findMany({
      where: { externalId: { in: resourceSeed.resources.map((item) => item.externalId) } },
      orderBy: { slug: "asc" },
    });
    expect(seeded).toHaveLength(8);
    expect(seeded.every((item) => item.reviewStatus === ReviewStatus.DRAFT)).toBe(true);
    expect(seeded.every((item) => item.provenance !== null)).toBe(true);
    expect(seeded.every((item) => item.sourceArtifactId === null)).toBe(true);
    for (const item of seeded) {
      expect(await prisma.contentVersion.count({
        where: { entityType: VersionedEntityType.RESOURCE, entityId: item.id, schemaVersion: "resource.v1" },
      })).toBe(1);
    }

    const original = seeded[0];
    await prisma.resource.update({ where: { id: original.id }, data: { title: "عنوان ویرایش‌شده توسط تحریریه" } });
    await seedStaticResources(prisma);
    expect((await prisma.resource.findUniqueOrThrow({ where: { id: original.id } })).title).toBe("عنوان ویرایش‌شده توسط تحریریه");
    expect(await prisma.contentVersion.count({
      where: { entityType: VersionedEntityType.RESOURCE, entityId: original.id },
    })).toBe(1);
    await prisma.resource.update({ where: { id: original.id }, data: { title: original.title } });
  });

  it("filters only published resources by degree, field, subject, topic, kind and inclusive review dates", async () => {
    const checks = [
      `degree=MASTER&subject=${firstSubject}`,
      `field=computer-engineering&subject=${firstSubject}`,
      `topic=${firstTopic}`,
      `kind=TELEGRAM_POST&subject=${firstSubject}`,
      `reviewedFrom=2026-09-08&reviewedTo=2026-09-08&subject=${firstSubject}`,
    ];
    for (const query of checks) {
      const response = await request(app.getHttpServer()).get(`/resources?${query}`).expect(200);
      expect(response.body.map((item: { slug: string }) => item.slug)).toContain(firstSlug);
      expect(response.body.map((item: { slug: string }) => item.slug)).not.toContain(secondSlug);
      expect(response.body.map((item: { slug: string }) => item.slug)).not.toContain(draftSlug);
    }
    const second = await request(app.getHttpServer())
      .get(`/resources?degree=PHD&field=computer-science&subject=${secondSubject}&topic=${secondTopic}&kind=VIDEO`)
      .expect(200);
    expect(second.body.map((item: { slug: string }) => item.slug)).toContain(secondSlug);
    expect(second.body.map((item: { slug: string }) => item.slug)).not.toContain(firstSlug);

    await request(app.getHttpServer()).get("/resources?kind=NOT_A_KIND").expect(400);
    await request(app.getHttpServer()).get("/resources?reviewedFrom=2026-99-99").expect(400);
    await request(app.getHttpServer()).get("/resources?reviewedFrom=2026-09-09&reviewedTo=2026-09-08").expect(400);
  });

  it("exposes only the allowlisted catalog profile and never raw metadata or provenance", async () => {
    const response = await request(app.getHttpServer()).get(`/resources/${firstSlug}`).expect(200);
    expect(response.body.catalogProfile).toEqual({
      learningType: "حل تمرین",
      startLevel: "متوسط",
      coverage: "هش",
      volume: "یک جلسه",
      sampleLabel: "نمونهٔ اصلی",
      costLabel: "رایگان",
      relatedGuideSlugs: ["choose-study-resources"],
    });
    expect(response.body).not.toHaveProperty("metadata");
    expect(response.body).not.toHaveProperty("provenance");
    expect(JSON.stringify(response.body)).not.toContain("must-never-leak");
    expect(JSON.stringify(response.body)).not.toContain(`phase14-provenance-${suffix}`);
  });

  it("rejects publication without an active matching mayLink source", async () => {
    await expect(editorial.submitResource(fixtureResourceIds[3], actorId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(editorial.submitResource(fixtureResourceIds[4], actorId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stops exposing an external URL as soon as link permission is revoked or archived", async () => {
    const sourceId = fixtureSourceIds[0];
    await prisma.contentSource.update({ where: { id: sourceId }, data: { mayLink: false } });

    const revoked = await request(app.getHttpServer()).get(`/resources/${firstSlug}`).expect(200);
    expect(revoked.body).not.toHaveProperty("externalUrl");
    expect(revoked.body.canAccess).toBe(false);
    expect(revoked.body.sources).toEqual([]);
    await request(app.getHttpServer()).get(`/resources/${firstSlug}/content`).expect(404);

    await prisma.contentSource.update({ where: { id: sourceId }, data: { mayLink: true, archivedAt: new Date(), sourceStatus: "ARCHIVED" } });
    const archived = await request(app.getHttpServer()).get(`/resources?subject=${firstSubject}`).expect(200);
    const item = archived.body.find((candidate: { slug: string }) => candidate.slug === firstSlug);
    expect(item).toBeDefined();
    expect(item).not.toHaveProperty("externalUrl");
    expect(item.sources).toEqual([]);
    await request(app.getHttpServer()).get(`/resources/${firstSlug}/content`).expect(404);
  });
});
