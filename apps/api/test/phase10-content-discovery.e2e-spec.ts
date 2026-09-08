import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import {
  AccessMode,
  ArticleContentType,
  Degree,
  ResourceHostingMode,
  ResourceKind,
  ReviewStatus,
} from "@prisma/client";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

function allObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allObjectKeys);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [...Object.keys(record), ...Object.values(record).flatMap(allObjectKeys)];
}

describe("Phase 10 public content discovery (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const prerequisiteSubjectCode = `phase10-prerequisite-${suffix}`;
  const subjectCode = `phase10-subject-${suffix}`;
  const prerequisiteTopicCode = `phase10-topic-prerequisite-${suffix}`;
  const topicCode = `phase10-topic-${suffix}`;
  const publicContributorSlug = `phase10-public-contributor-${suffix}`;
  const hiddenContributorSlug = `phase10-hidden-contributor-${suffix}`;
  const exactArticleSlug = `phase10-exact-article-${suffix}`;
  const summaryArticleSlug = `phase10-summary-article-${suffix}`;
  const draftArticleSlug = `phase10-draft-article-${suffix}`;
  const publicResourceSlug = `phase10-public-resource-${suffix}`;
  const draftResourceSlug = `phase10-draft-resource-${suffix}`;
  const publicCourseSlug = `phase10-public-course-${suffix}`;
  const draftCourseSlug = `phase10-draft-course-${suffix}`;
  const publicReportExternalId = `phase10-public-report-${suffix}`;
  const hiddenReportExternalId = `phase10-hidden-report-${suffix}`;
  const searchPhrase = `داده ساختار یکپارچه ${suffix}`;
  const paginationPhrase = `کاوش ${suffix}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const prerequisiteSubject = await prisma.subject.create({
      data: {
        code: prerequisiteSubjectCode,
        slug: prerequisiteSubjectCode,
        title: `پیش‌نیاز ${suffix}`,
        description: "پیش‌نیاز عمومی",
      },
    });
    const subject = await prisma.subject.create({
      data: {
        code: subjectCode,
        slug: subjectCode,
        title: `درس اصلی ${suffix}`,
        description: "توضیح عمومی درس",
        metadata: { audience: "master" },
        prerequisites: { create: { prerequisiteId: prerequisiteSubject.id } },
      },
    });
    const prerequisiteTopic = await prisma.topic.create({
      data: {
        code: prerequisiteTopicCode,
        slug: prerequisiteTopicCode,
        title: `مبحث پیش‌نیاز ${suffix}`,
        subjectId: subject.id,
      },
    });
    await prisma.topic.create({
      data: {
        code: topicCode,
        slug: topicCode,
        title: `مبحث اصلی ${suffix}`,
        description: "توضیح عمومی مبحث",
        subjectId: subject.id,
        prerequisites: { create: { prerequisiteId: prerequisiteTopic.id } },
      },
    });

    const publicContributor = await prisma.contributorProfile.create({
      data: {
        slug: publicContributorSlug,
        displayName: `نویسنده عمومی ${suffix}`,
        roleTitle: "بازبین علمی",
        shortBio: "زندگی‌نامه عمومی",
        bioBlocks: [{ type: "text", text: "تجربه آموزشی مستند" }],
        sameAs: ["https://example.com/public-profile"],
        isPublished: true,
      },
    });
    await prisma.contributorProfile.create({
      data: {
        slug: hiddenContributorSlug,
        displayName: `نویسنده پنهان ${suffix}`,
        shortBio: "این متن نباید عمومی باشد",
        isPublished: false,
      },
    });

    await prisma.article.createMany({
      data: [
        {
          externalId: `phase10-exact-article-${suffix}`,
          slug: exactArticleSlug,
          title: `راهنمای داده‌ساختار یکپارچه ${suffix}`,
          summary: "پاسخ سریع و عمومی",
          quickAnswer: "از تعریف داده شروع کنید.",
          contentBlocks: [{ type: "text", text: "محتوای منتشرشده" }],
          taxonomyMajor: ["computer-engineering"],
          subjectCodes: [subjectCode],
          topicCodes: [topicCode],
          contentType: ArticleContentType.GUIDE,
          authorProfileId: publicContributor.id,
          reviewStatus: ReviewStatus.PUBLISHED,
          publishedAt: new Date("2026-01-03T00:00:00.000Z"),
        },
        {
          externalId: `phase10-summary-article-${suffix}`,
          slug: summaryArticleSlug,
          title: `یادداشت تکمیلی ${suffix}`,
          summary: `توضیح ساده ${searchPhrase}`,
          contentBlocks: [{ type: "text", text: "محتوای ثانویه" }],
          taxonomyMajor: ["computer-engineering"],
          subjectCodes: [subjectCode],
          topicCodes: [topicCode],
          reviewStatus: ReviewStatus.PUBLISHED,
          publishedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          externalId: `phase10-draft-article-${suffix}`,
          slug: draftArticleSlug,
          title: searchPhrase,
          summary: "پیش‌نویس خصوصی",
          contentBlocks: [{ type: "text", text: "نباید پیدا شود" }],
          taxonomyMajor: ["computer-engineering"],
          subjectCodes: [subjectCode],
          topicCodes: [topicCode],
          authorProfileId: publicContributor.id,
          reviewStatus: ReviewStatus.DRAFT,
        },
      ],
    });

    await prisma.resource.createMany({
      data: [
        {
          externalId: `phase10-public-resource-${suffix}`,
          slug: publicResourceSlug,
          title: `جزوه عمومی ${suffix}`,
          summary: "معرفی عمومی منبع",
          description: "توضیح عمومی منبع",
          kind: ResourceKind.NOTE,
          accessMode: AccessMode.ENTITLEMENT,
          hostingMode: ResourceHostingMode.METADATA_ONLY,
          contentBlocks: [{ type: "text", text: `عبارت محرمانه ${suffix}` }],
          taxonomyDegrees: [Degree.MASTER],
          subjectCodes: [subjectCode],
          topicCodes: [topicCode],
          authorProfileId: publicContributor.id,
          reviewStatus: ReviewStatus.PUBLISHED,
          publishedAt: new Date("2026-01-04T00:00:00.000Z"),
        },
        {
          externalId: `phase10-draft-resource-${suffix}`,
          slug: draftResourceSlug,
          title: `منبع پنهان ${suffix}`,
          summary: searchPhrase,
          kind: ResourceKind.NOTE,
          accessMode: AccessMode.PUBLIC,
          hostingMode: ResourceHostingMode.METADATA_ONLY,
          subjectCodes: [subjectCode],
          topicCodes: [topicCode],
          reviewStatus: ReviewStatus.DRAFT,
        },
      ],
    });

    await prisma.course.create({
      data: {
        slug: publicCourseSlug,
        title: `دوره عمومی ${suffix}`,
        description: "دوره مرتبط منتشرشده",
        subjectId: subject.id,
        accessMode: AccessMode.PUBLIC,
        isPublished: true,
        modules: {
          create: {
            title: "فصل اول",
            order: 1,
            lessons: {
              create: {
                title: "درس اول",
                order: 1,
                contentBlocks: [],
                topics: { create: { topic: { connect: { code: topicCode } } } },
              },
            },
          },
        },
      },
    });
    await prisma.course.create({
      data: {
        slug: draftCourseSlug,
        title: `دوره پنهان ${suffix}`,
        description: "نباید در محتوای مرتبط باشد",
        subjectId: subject.id,
        isPublished: false,
        modules: {
          create: {
            title: "فصل پنهان",
            order: 1,
            lessons: {
              create: {
                title: "درس پنهان",
                order: 1,
                contentBlocks: [],
                topics: { create: { topic: { connect: { code: topicCode } } } },
              },
            },
          },
        },
      },
    });

    await prisma.subject.createMany({
      data: ["الف", "ب", "پ"].map((letter, index) => ({
        code: `phase10-pagination-${index}-${suffix}`,
        slug: `phase10-pagination-${index}-${suffix}`,
        title: `${paginationPhrase} ${letter}`,
      })),
    });

    await prisma.reportCard.createMany({
      data: [
        {
          externalId: publicReportExternalId,
          anonymousId: `anon-public-${suffix}`,
          examYear: 1405,
          degree: Degree.MASTER,
          field: `public-field-${suffix}`,
          quota: "region-1",
          subjectScores: [{ subject_code: subjectCode, percent: 75 }],
          rank: { value: 17, scope: "quota" },
          admissions: [{ program_code: "public-program", status: "accepted" }],
          provenance: { producer_type: "human", source_artifact: `secret-public-provenance-${suffix}` },
          publicConsent: true,
        },
        {
          externalId: hiddenReportExternalId,
          anonymousId: `anon-hidden-${suffix}`,
          examYear: 1405,
          degree: Degree.MASTER,
          field: `hidden-field-${suffix}`,
          quota: "region-1",
          subjectScores: [{ subject_code: subjectCode, percent: 90 }],
          rank: { value: 1, scope: "quota" },
          admissions: [],
          provenance: { producer_type: "human", source_artifact: `secret-hidden-provenance-${suffix}` },
          publicConsent: false,
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.reportCard.deleteMany({ where: { externalId: { in: [publicReportExternalId, hiddenReportExternalId] } } });
      await prisma.resource.deleteMany({ where: { slug: { in: [publicResourceSlug, draftResourceSlug] } } });
      await prisma.article.deleteMany({ where: { slug: { in: [exactArticleSlug, summaryArticleSlug, draftArticleSlug] } } });
      await prisma.course.deleteMany({ where: { slug: { in: [publicCourseSlug, draftCourseSlug] } } });
      await prisma.topic.deleteMany({ where: { code: { in: [topicCode, prerequisiteTopicCode] } } });
      await prisma.subject.deleteMany({
        where: {
          code: {
            in: [
              subjectCode,
              prerequisiteSubjectCode,
              ...[0, 1, 2].map((index) => `phase10-pagination-${index}-${suffix}`),
            ],
          },
        },
      });
      await prisma.contributorProfile.deleteMany({
        where: { slug: { in: [publicContributorSlug, hiddenContributorSlug] } },
      });
    }
    if (app) await app.close();
  });

  it("normalizes Persian text, ranks title matches first and never searches private resource payloads", async () => {
    const normalizedVariant = `داده‌ساختار يكپارچه ${suffix}`;
    const response = await request(app.getHttpServer())
      .get("/content/search")
      .query({ q: normalizedVariant })
      .expect(200);

    expect(response.body.items[0].slug).toBe(exactArticleSlug);
    expect(response.body.items[0].href).toBe(`/guides/${exactArticleSlug}`);
    expect(response.body.items.some((item: { slug: string }) => item.slug === summaryArticleSlug)).toBe(true);
    expect(response.body.items.some((item: { slug: string }) => item.slug === draftArticleSlug)).toBe(false);
    expect(response.body.items.some((item: { slug: string }) => item.slug === draftResourceSlug)).toBe(false);

    const privatePayload = await request(app.getHttpServer())
      .get("/content/search")
      .query({ q: `عبارت محرمانه ${suffix}` })
      .expect(200);
    expect(privatePayload.body.total).toBe(0);
  });

  it("paginates search results deterministically", async () => {
    const first = await request(app.getHttpServer())
      .get("/content/search")
      .query({ q: paginationPhrase, page: 1, limit: 2 })
      .expect(200);
    const repeated = await request(app.getHttpServer())
      .get("/content/search")
      .query({ q: paginationPhrase, page: 1, limit: 2 })
      .expect(200);
    const second = await request(app.getHttpServer())
      .get("/content/search")
      .query({ q: paginationPhrase, page: 2, limit: 2 })
      .expect(200);

    expect(first.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(first.body.items).toEqual(repeated.body.items);
    expect(second.body.items).toHaveLength(1);
    expect(new Set([...first.body.items, ...second.body.items].map((item) => item.slug)).size).toBe(3);
  });

  it("returns subject and topic prerequisites with published related content only", async () => {
    const subject = await request(app.getHttpServer()).get(`/subjects/${subjectCode}`).expect(200);
    expect(subject.body.prerequisites.map((item: { code: string }) => item.code)).toContain(prerequisiteSubjectCode);
    expect(subject.body.topics.map((item: { code: string }) => item.code)).toContain(topicCode);
    expect(subject.body.relatedContent.articles.map((item: { slug: string }) => item.slug)).toContain(exactArticleSlug);
    expect(subject.body.relatedContent.articles.map((item: { slug: string }) => item.slug)).not.toContain(draftArticleSlug);
    expect(subject.body.relatedContent.resources.map((item: { slug: string }) => item.slug)).toEqual([publicResourceSlug]);
    expect(subject.body.relatedContent.courses.map((item: { slug: string }) => item.slug)).toContain(publicCourseSlug);
    expect(subject.body.relatedContent.courses.map((item: { slug: string }) => item.slug)).not.toContain(draftCourseSlug);

    const topic = await request(app.getHttpServer()).get(`/topics/${topicCode}`).expect(200);
    expect(topic.body.subject.code).toBe(subjectCode);
    expect(topic.body.prerequisites.map((item: { code: string }) => item.code)).toContain(prerequisiteTopicCode);
    expect(topic.body.relatedContent.articles.map((item: { slug: string }) => item.slug)).toContain(exactArticleSlug);
    expect(topic.body.relatedContent.resources.map((item: { slug: string }) => item.slug)).toEqual([publicResourceSlug]);
    expect(topic.body.relatedContent.courses.map((item: { slug: string }) => item.slug)).toEqual([publicCourseSlug]);
    expect(allObjectKeys(subject.body)).not.toContain("id");
    expect(allObjectKeys(topic.body)).not.toContain("id");
  });

  it("shows only published contributor profiles and published authored content", async () => {
    const contributor = await request(app.getHttpServer())
      .get(`/contributors/${publicContributorSlug}`)
      .expect(200);
    expect(contributor.body.slug).toBe(publicContributorSlug);
    expect(contributor.body.authoredArticles.map((item: { slug: string }) => item.slug)).toContain(exactArticleSlug);
    expect(contributor.body.authoredArticles.map((item: { slug: string }) => item.slug)).not.toContain(draftArticleSlug);
    expect(contributor.body.authoredResources.map((item: { slug: string }) => item.slug)).toEqual([publicResourceSlug]);
    expect(allObjectKeys(contributor.body)).not.toEqual(expect.arrayContaining(["id", "userId", "provenance"]));
    await request(app.getHttpServer()).get(`/contributors/${hiddenContributorSlug}`).expect(404);
  });

  it("returns only consented report cards through an anonymous allowlist", async () => {
    const response = await request(app.getHttpServer())
      .get("/report-cards")
      .query({ page: 1, limit: 50 })
      .expect(200);
    const publicCard = response.body.items.find((item: { field: string }) => item.field === `public-field-${suffix}`);

    expect(publicCard).toBeDefined();
    expect(response.body.items.some((item: { field: string }) => item.field === `hidden-field-${suffix}`)).toBe(false);
    expect(Object.keys(publicCard).sort()).toEqual(
      ["admissions", "degree", "examYear", "field", "quota", "rank", "subjectScores"].sort(),
    );
    expect(response.text).not.toContain(publicReportExternalId);
    expect(response.text).not.toContain(`anon-public-${suffix}`);
    expect(response.text).not.toContain(`secret-public-provenance-${suffix}`);
    expect(response.text).not.toContain(hiddenReportExternalId);
  });
});
