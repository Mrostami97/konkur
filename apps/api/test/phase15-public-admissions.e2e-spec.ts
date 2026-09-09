import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Degree, TuitionType } from "@prisma/client";
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

describe("Phase 15 public report cards and official admissions catalog (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const field = `phase15-field-${suffix}`;
  const quota = `phase15-quota-${suffix}`;
  const universityCode = `phase15-university-${suffix}`;
  const hiddenUniversityCode = `phase15-hidden-university-${suffix}`;
  const programCode = `phase15-program-${suffix}`;
  const hiddenProgramCode = `phase15-hidden-program-${suffix}`;
  const reportExternalIds = Array.from({ length: 6 }, (_, index) => `phase15-report-${index}-${suffix}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const officialSource = await prisma.contentSource.create({
      data: {
        externalId: `phase15-official-source-${suffix}`,
        kind: "OFFICIAL_ADMISSIONS_BOOKLET",
        title: `دفترچه رسمی آزمون ${suffix}`,
        publisher: "سازمان رسمی آزمون",
        canonicalUrl: `https://official.example.test/${suffix}`,
        sourceTier: "PRIMARY_OFFICIAL",
        sourceStatus: "ACTIVE",
        checkedAt: new Date("2026-09-09T00:00:00.000Z"),
        rightsBasis: "LINK_ONLY",
        mayLink: true,
        checksum: `private-checksum-${suffix}`,
        metadata: { internalNote: `private-source-note-${suffix}` },
      },
    });
    const nonOfficialSource = await prisma.contentSource.create({
      data: {
        externalId: `phase15-nonofficial-source-${suffix}`,
        kind: "SECONDARY_GUIDE",
        title: `منبع غیررسمی ${suffix}`,
        publisher: "ناشر آزمایشی",
        canonicalUrl: `https://secondary.example.test/${suffix}`,
        sourceTier: "SECONDARY",
        sourceStatus: "ACTIVE",
        checkedAt: new Date("2026-09-08T00:00:00.000Z"),
        rightsBasis: "LINK_ONLY",
        mayLink: true,
      },
    });

    const university = await prisma.university.create({
      data: {
        code: universityCode,
        title: `دانشگاه رسمی ${suffix}`,
        city: "تهران",
        sourceId: officialSource.id,
      },
    });
    const hiddenUniversity = await prisma.university.create({
      data: {
        code: hiddenUniversityCode,
        title: `دانشگاه بدون منبع رسمی ${suffix}`,
        city: "تهران",
        sourceId: nonOfficialSource.id,
      },
    });
    const program = await prisma.program.create({
      data: {
        universityId: university.id,
        code: programCode,
        title: `گرایش رسمی ${suffix}`,
        degree: Degree.MASTER,
        field,
        tuitionType: TuitionType.FREE,
        sourceId: officialSource.id,
      },
    });
    await prisma.program.create({
      data: {
        universityId: hiddenUniversity.id,
        code: hiddenProgramCode,
        title: `گرایش غیررسمی ${suffix}`,
        degree: Degree.MASTER,
        field,
        tuitionType: TuitionType.FREE,
        sourceId: nonOfficialSource.id,
      },
    });
    await prisma.capacity.createMany({
      data: [
        {
          programId: program.id,
          examYear: 1405,
          quota,
          capacity: 12,
          sourceId: officialSource.id,
        },
        {
          programId: program.id,
          examYear: 1404,
          quota: `hidden-${quota}`,
          capacity: 99,
          sourceId: nonOfficialSource.id,
        },
      ],
    });

    await prisma.reportCard.createMany({
      data: [
        ...[20, 30, 40, 50, 60].map((rankValue, index) => ({
          externalId: reportExternalIds[index],
          anonymousId: `private-anonymous-id-${index}-${suffix}`,
          examYear: 1405,
          degree: Degree.MASTER,
          field,
          quota,
          subjectScores: [{
            subject_code: "algorithms",
            percent: 60 + index,
            student_name: `private-student-${index}-${suffix}`,
          }],
          rank: {
            value: rankValue,
            scope: "quota",
            full_name: `private-rank-owner-${index}-${suffix}`,
          },
          admissions: [{
            program_code: programCode,
            status: index < 3 ? "accepted" : "rejected",
            evidence_url: `https://private.example.test/${index}/${suffix}`,
          }],
          provenance: {
            source_artifact: `private-provenance-${index}-${suffix}`,
            producer_type: "human",
          },
          publicConsent: true,
        })),
        {
          externalId: reportExternalIds[5],
          anonymousId: `private-no-consent-${suffix}`,
          examYear: 1405,
          degree: Degree.MASTER,
          field,
          quota,
          subjectScores: [{ subject_code: "algorithms", percent: 100 }],
          rank: { value: 1, scope: "quota" },
          admissions: [{ program_code: programCode, status: "accepted" }],
          provenance: { source_artifact: `private-hidden-provenance-${suffix}` },
          publicConsent: false,
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.reportCard.deleteMany({ where: { externalId: { in: reportExternalIds } } });
      await prisma.capacity.deleteMany({
        where: { program: { code: { in: [programCode, hiddenProgramCode] } } },
      });
      await prisma.program.deleteMany({ where: { code: { in: [programCode, hiddenProgramCode] } } });
      await prisma.university.deleteMany({
        where: { code: { in: [universityCode, hiddenUniversityCode] } },
      });
      await prisma.contentSource.deleteMany({
        where: {
          externalId: {
            in: [`phase15-official-source-${suffix}`, `phase15-nonofficial-source-${suffix}`],
          },
        },
      });
    }
    if (app) await app.close();
  });

  it("publishes only consented report cards and strips identity, provenance and unapproved JSON fields", async () => {
    const response = await request(app.getHttpServer())
      .get("/report-cards")
      .query({ examYear: 1405, degree: "MASTER", field, quota, limit: 50 })
      .expect(200);

    expect(response.body.total).toBe(5);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items.map((item: { rank: { value: number } }) => item.rank.value)).not.toContain(1);
    const keys = allObjectKeys(response.body.items);
    for (const forbiddenKey of [
      "id",
      "externalId",
      "anonymousId",
      "provenance",
      "student_name",
      "full_name",
      "evidence_url",
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
    expect(response.text).not.toContain(`private-no-consent-${suffix}`);
    expect(response.text).not.toContain(`private-provenance-`);
    expect(response.text).not.toContain(`private-student-`);
  });

  it("supports the public filters and suppresses aggregate statistics below five records", async () => {
    const completeCohort = await request(app.getHttpServer())
      .get("/report-cards")
      .query({
        examYear: 1405,
        degree: "MASTER",
        field,
        quota,
        specialization: programCode,
        university: universityCode,
        rankMin: 20,
        rankMax: 60,
        limit: 50,
      })
      .expect(200);

    expect(completeCohort.body).toMatchObject({ total: 5, page: 1, limit: 50 });
    expect(completeCohort.body.cohort).toMatchObject({
      sampleSize: 5,
      minimumSampleSize: 5,
      dataYears: [1405],
      aggregate: {
        rankMedian: 40,
        intervalKind: "EMPIRICAL_CENTRAL_80",
      },
    });
    expect(completeCohort.body.cohort.aggregate.intervalNote).toContain("تضمین رتبه نیست");

    const unavailableOfficialCohort = await request(app.getHttpServer())
      .get("/report-cards")
      .query({
        field,
        quota,
        specialization: hiddenProgramCode,
        university: hiddenUniversityCode,
        limit: 50,
      })
      .expect(200);
    expect(unavailableOfficialCohort.body.total).toBe(0);
    expect(unavailableOfficialCohort.body.cohort.aggregate).toBeNull();

    const smallCohort = await request(app.getHttpServer())
      .get("/report-cards")
      .query({ field, quota, rankMax: 50, limit: 50 })
      .expect(200);
    expect(smallCohort.body.total).toBe(4);
    expect(smallCohort.body.cohort.sampleSize).toBe(4);
    expect(smallCohort.body.cohort.aggregate).toBeNull();

    await request(app.getHttpServer())
      .get("/report-cards")
      .query({ rankMin: 100, rankMax: 10 })
      .expect(400);
  });

  it("exposes only active official-source admissions records and only safe source attribution", async () => {
    const universities = await request(app.getHttpServer()).get("/universities").expect(200);
    const visibleUniversity = universities.body.find((item: { code: string }) => item.code === universityCode);
    expect(visibleUniversity).toBeDefined();
    expect(universities.body.some((item: { code: string }) => item.code === hiddenUniversityCode)).toBe(false);
    expect(Object.keys(visibleUniversity.source).sort()).toEqual([
      "canonicalUrl",
      "checkedAt",
      "publisher",
      "title",
    ]);
    expect(universities.text).not.toContain(`private-checksum-${suffix}`);
    expect(universities.text).not.toContain(`private-source-note-${suffix}`);

    const programs = await request(app.getHttpServer())
      .get("/programs")
      .query({ degree: "master", field, university: universityCode })
      .expect(200);
    const visibleProgram = programs.body.find((item: { code: string }) => item.code === programCode);
    expect(visibleProgram).toBeDefined();
    expect(programs.body.some((item: { code: string }) => item.code === hiddenProgramCode)).toBe(false);
    expect(visibleProgram.capacities).toHaveLength(1);
    expect(visibleProgram.capacities[0]).toMatchObject({ examYear: 1405, quota, capacity: 12 });

    await request(app.getHttpServer()).get(`/universities/${hiddenUniversityCode}`).expect(404);
    await request(app.getHttpServer()).get(`/programs/code/${hiddenProgramCode}`).expect(404);
    await request(app.getHttpServer()).get(`/universities/${universityCode}`).expect(200);
    await request(app.getHttpServer()).get(`/programs/code/${programCode}`).expect(200);
  });
});
