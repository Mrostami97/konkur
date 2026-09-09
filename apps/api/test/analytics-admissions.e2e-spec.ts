import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import AdmZip from "adm-zip";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  const suffix = Math.floor(1_000_000 + Math.random() * 8_999_999);
  return `+9897${suffix}`;
}

function buildZip(payload: unknown): Buffer {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(payload)));
  return zip.toBuffer();
}

describe("Analytics (rank estimation/backtest) + Admissions (e2e)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const field = `analytics-field-${Date.now()}`;
  const quota = "region-1";
  const programCode = `program-${Date.now()}`;

  async function login(phone: string): Promise<string> {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  async function ingestReportCard(
    externalId: string,
    subjectScores: { subject_code: string; percent: number }[],
    rankValue: number,
    admissionStatus?: "accepted" | "rejected",
  ) {
    const payload = {
      schema_version: "report-card.v1",
      external_id: externalId,
      anonymous_id: `anon-${externalId}`,
      exam_year: 1405,
      degree: "master",
      field,
      quota,
      subject_scores: subjectScores,
      rank: { value: rankValue, scope: "quota" },
      admissions: admissionStatus ? [{ program_code: programCode, status: admissionStatus }] : [],
      provenance: { producer_type: "human", source_artifact: "analytics-test" },
    };
    const zip = buildZip(payload);
    const jobRes = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);
    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [itemsRes.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/import/${jobRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);
  }

  beforeAll(async () => {
    otpProvider = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otpProvider)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);

    // 10 comparable report cards: higher combined score -> better (lower) rank.
    for (let i = 0; i < 10; i++) {
      const algorithms = 50 + i * 3;
      const dataStructures = 55 + i * 3;
      const rank = 500 - i * 40; // higher scores -> lower rank number
      await ingestReportCard(
        `analytics-rc-${Date.now()}-${i}`,
        [
          { subject_code: "algorithms", percent: algorithms },
          { subject_code: "data-structures", percent: dataStructures },
        ],
        rank,
        i < 5 ? "rejected" : "accepted", // top half (lower rank) accepted
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies backtest and catalog authoring to a plain student", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/admin/analytics/backtest")
      .set("Cookie", studentCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post("/admin/universities")
      .set("Cookie", studentCookie)
      .send({ code: "x", title: "x", city: "x" })
      .expect(403);
  });

  it("produces a real rank estimate with median/interval/confidence/comparables/sensitivity", async () => {
    const studentCookie = await login(randomPhone());
    const res = await request(app.getHttpServer())
      .post("/me/rank-estimates")
      .set("Cookie", studentCookie)
      .send({
        degree: "master",
        field,
        quota,
        subjectScores: [
          { subjectCode: "algorithms", percent: 65 },
          { subjectCode: "data-structures", percent: 70 },
        ],
      })
      .expect(201);

    expect(res.body.comparableCount).toBeGreaterThanOrEqual(5);
    expect(res.body.rankP50Low).toBeLessThanOrEqual(res.body.rankMedian);
    expect(res.body.rankMedian).toBeLessThanOrEqual(res.body.rankP50High);
    expect(res.body.rankP80Low).toBeLessThanOrEqual(res.body.rankP50Low);
    expect(res.body.rankP80High).toBeGreaterThanOrEqual(res.body.rankP50High);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(res.body.confidence);
    expect(res.body.sensitivity.algorithms).toBeDefined();
    expect(res.body.sensitivity["data-structures"]).toBeDefined();
    expect(res.body.methodology).toContain("rank-estimator.v1");

    const latestRes = await request(app.getHttpServer())
      .get("/me/rank-estimates/latest")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(latestRes.body.id).toBe(res.body.id);
  });

  it("refuses to fabricate an estimate when there aren't enough comparables", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/me/rank-estimates")
      .set("Cookie", studentCookie)
      .send({
        degree: "master",
        field: `nonexistent-field-${Date.now()}`,
        quota,
        subjectScores: [{ subjectCode: "algorithms", percent: 50 }],
      })
      .expect(400);
  });

  it("builds an admissions catalog and computes a real empirical acceptance chance", async () => {
    const sourceRes = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `admissions-official-source-${Date.now()}`,
        kind: "OFFICIAL_ADMISSIONS_BOOKLET",
        title: "Official admissions test fixture",
        publisher: "Official test authority",
        canonicalUrl: `https://example.test/official-admissions/${Date.now()}`,
        sourceTier: "PRIMARY_OFFICIAL",
        checkedAt: new Date().toISOString(),
        rightsBasis: "LINK_ONLY",
        mayLink: true,
      })
      .expect(201);
    const uniRes = await request(app.getHttpServer())
      .post("/admin/universities")
      .set("Cookie", adminCookie)
      .send({ sourceId: sourceRes.body.id, code: `uni-${Date.now()}`, title: "Test University", city: "Tehran" })
      .expect(201);
    const programRes = await request(app.getHttpServer())
      .post("/admin/programs")
      .set("Cookie", adminCookie)
      .send({
        universityId: uniRes.body.id,
        sourceId: sourceRes.body.id,
        code: programCode,
        title: "Software Engineering",
        degree: "MASTER",
        field,
        tuitionType: "FREE",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/programs/${programRes.body.id}/capacities`)
      .set("Cookie", adminCookie)
      .send({ sourceId: sourceRes.body.id, examYear: 1405, quota, capacity: 20 })
      .expect(201);

    const listRes = await request(app.getHttpServer()).get(`/programs?field=${field}`).expect(200);
    expect(listRes.body.some((p: any) => p.code === programCode)).toBe(true);

    // A strong student (good rank) should land in the "accepted" half of the cohort.
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/me/rank-estimates")
      .set("Cookie", studentCookie)
      .send({
        degree: "master",
        field,
        quota,
        subjectScores: [
          { subjectCode: "algorithms", percent: 80 },
          { subjectCode: "data-structures", percent: 85 },
        ],
      })
      .expect(201);

    const chanceRes = await request(app.getHttpServer())
      .get(`/me/rank-estimates/programs/${programRes.body.id}/acceptance-chance`)
      .set("Cookie", studentCookie)
      .expect(200);
    expect(chanceRes.body.sampleSize).toBeGreaterThan(0);
    expect(chanceRes.body.chance).toBeGreaterThanOrEqual(0);
    expect(chanceRes.body.chance).toBeLessThanOrEqual(1);

    // Choice list: add, reorder, compare, remove.
    await request(app.getHttpServer())
      .post("/me/choices")
      .set("Cookie", studentCookie)
      .send({ programId: programRes.body.id })
      .expect(201);
    const choicesRes = await request(app.getHttpServer())
      .get("/me/choices")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(choicesRes.body).toHaveLength(1);

    const compareRes = await request(app.getHttpServer())
      .get("/me/choices/compare")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(compareRes.body[0].program.code).toBe(programCode);
    expect(compareRes.body[0].chance).not.toBeNull();

    await request(app.getHttpServer())
      .delete(`/me/choices/${programRes.body.id}`)
      .set("Cookie", studentCookie)
      .expect(200);
    const afterRemove = await request(app.getHttpServer())
      .get("/me/choices")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(afterRemove.body).toHaveLength(0);
  });

  it("runs a real backtest measuring interval calibration", async () => {
    const res = await request(app.getHttpServer())
      .post("/admin/analytics/backtest")
      .set("Cookie", adminCookie)
      .expect(201);
    expect(res.body.sampleSize).toBeGreaterThan(0);
    expect(res.body.coverageP50).toBeGreaterThanOrEqual(0);
    expect(res.body.coverageP50).toBeLessThanOrEqual(1);
    expect(res.body.coverageP80).toBeGreaterThanOrEqual(res.body.coverageP50 - 0.001);
    expect(res.body.meanAbsPercentError).toBeGreaterThanOrEqual(0);

    const listRes = await request(app.getHttpServer())
      .get("/admin/analytics/backtests")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(listRes.body.length).toBeGreaterThan(0);
  });
});
