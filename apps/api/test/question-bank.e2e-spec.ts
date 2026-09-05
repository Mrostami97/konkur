import "reflect-metadata";
import { createHash } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import AdmZip from "adm-zip";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function randomPhone(): string {
  const suffix = Math.floor(1_000_000 + Math.random() * 8_999_999);
  return `+9894${suffix}`;
}

function questionDto(externalId: string, subjectCode: string, examYear: number) {
  return {
    external_id: externalId,
    exam: { degree: "master", major: "computer-engineering", year: examYear },
    subject_code: subjectCode,
    topic_codes: ["asymptotic-analysis"],
    stem_blocks: [{ type: "text", text: "directly authored stem" }],
    options: [
      { number: 1, blocks: [{ type: "text", text: "A" }] },
      { number: 2, blocks: [{ type: "text", text: "B" }] },
      { number: 3, blocks: [{ type: "text", text: "C" }] },
      { number: 4, blocks: [{ type: "text", text: "D" }] },
    ],
    correct_option: 2,
    solution_blocks: [{ type: "text", text: "directly authored solution" }],
  };
}

function buildZip(payload: unknown, files: { name: string; buffer: Buffer }[] = []): Buffer {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(payload)));
  for (const f of files) zip.addFile(f.name, f.buffer);
  return zip.toBuffer();
}

describe("Taxonomy + Question Bank (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;

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
    prisma = app.get(PrismaService);
    await seed();

    async function login(phone: string) {
      await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
      const code = otpProvider.sent[otpProvider.sent.length - 1].code;
      const res = await request(app.getHttpServer())
        .post("/auth/otp/verify")
        .send({ phone, code })
        .expect(200);
      return res.headers["set-cookie"][0] as string;
    }

    adminCookie = await login(SEED_ADMIN_PHONE);
    studentCookie = await login(randomPhone());
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies taxonomy/question authoring to a plain student", async () => {
    await request(app.getHttpServer())
      .post("/admin/subjects")
      .set("Cookie", studentCookie)
      .send({ code: "algorithms", title: "Algorithms" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", studentCookie)
      .send(questionDto(`forbidden-${Date.now()}`, "algorithms", 1405))
      .expect(403);
  });

  it("manages a Subject/Topic catalog visible publicly", async () => {
    const suffix = Date.now();
    await request(app.getHttpServer())
      .post("/admin/subjects")
      .set("Cookie", adminCookie)
      .send({ code: `algorithms-${suffix}`, title: "Algorithms" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/admin/topics")
      .set("Cookie", adminCookie)
      .send({ code: `asymptotic-${suffix}`, title: "Asymptotic Analysis", subjectCode: `algorithms-${suffix}` })
      .expect(201);

    const subjectsRes = await request(app.getHttpServer()).get("/subjects").expect(200);
    expect(subjectsRes.body.some((s: any) => s.code === `algorithms-${suffix}`)).toBe(true);

    const topicsRes = await request(app.getHttpServer())
      .get(`/topics?subjectCode=algorithms-${suffix}`)
      .expect(200);
    expect(topicsRes.body).toHaveLength(1);
    expect(topicsRes.body[0].code).toBe(`asymptotic-${suffix}`);
  });

  it("authors a question directly (no zip), through the same stage->review->publish path", async () => {
    const externalId = `direct-question-${Date.now()}`;

    const jobRes = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send(questionDto(externalId, "algorithms", 1405))
      .expect(201);
    expect(jobRes.body.status).toBe("STAGED");

    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(itemsRes.body).toHaveLength(1);
    expect(itemsRes.body[0].status).toBe("VALID");

    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [itemsRes.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/import/${jobRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    expect(question.version).toBe(1);

    const publicRes = await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(200);
    expect(publicRes.body.correctOption).toBe(2);
    expect(publicRes.body.options).toHaveLength(4);

    const versionsRes = await request(app.getHttpServer())
      .get(`/admin/content/QUESTION/${question.id}/versions`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(versionsRes.body).toHaveLength(1);
  });

  it("filters the question bank by subject, exam year, and free-text", async () => {
    const suffix = Date.now();
    const subjectCode = `search-subject-${suffix}`;

    async function authorAndPublish(externalId: string, year: number) {
      const jobRes = await request(app.getHttpServer())
        .post("/admin/questions")
        .set("Cookie", adminCookie)
        .send(questionDto(externalId, subjectCode, year))
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

    await authorAndPublish(`search-q1-${suffix}`, 1404);
    await authorAndPublish(`search-q2-${suffix}`, 1405);

    const bySubject = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${subjectCode}`)
      .expect(200);
    expect(bySubject.body.total).toBe(2);

    const byYear = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${subjectCode}&examYear=1405`)
      .expect(200);
    expect(byYear.body.total).toBe(1);

    const byQ = await request(app.getHttpServer()).get(`/questions?q=${subjectCode}`).expect(200);
    expect(byQ.body.total).toBe(2);
  });

  it("republishing bumps the version and rollback restores an old one with history intact", async () => {
    const externalId = `direct-versioned-${Date.now()}`;

    async function authorApprovePublish(correctOption: number) {
      const dto = questionDto(externalId, "algorithms", 1405);
      dto.correct_option = correctOption;
      const jobRes = await request(app.getHttpServer())
        .post("/admin/questions")
        .set("Cookie", adminCookie)
        .send(dto)
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

    await authorApprovePublish(2);
    const v1 = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    expect(v1.version).toBe(1);
    expect(v1.correctOption).toBe(2);

    await authorApprovePublish(3);
    const v2 = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    expect(v2.version).toBe(2);
    expect(v2.correctOption).toBe(3);

    const rollbackRes = await request(app.getHttpServer())
      .post("/admin/content/rollback")
      .set("Cookie", adminCookie)
      .send({ entityType: "QUESTION", entityId: v2.id, toVersion: 1 })
      .expect(201);
    expect(rollbackRes.body.newVersion).toBe(3);

    const afterRollback = await prisma.question.findUniqueOrThrow({ where: { id: v2.id } });
    expect(afterRollback.correctOption).toBe(2);
    expect(afterRollback.version).toBe(3);

    const versionsRes = await request(app.getHttpServer())
      .get(`/admin/content/QUESTION/${v2.id}/versions`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(versionsRes.body.map((v: any) => v.version)).toEqual([1, 2, 3]);
  });

  it("serves an ingested media asset via a short-lived redirect", async () => {
    const externalId = `media-question-${Date.now()}`;
    const imageBuf = Buffer.from("fake-png-for-media-test");
    const checksum = sha256(imageBuf);
    const zip = buildZip(
      {
        schema_version: "question.v1",
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: "algorithms",
        topic_codes: ["asymptotic-analysis"],
        stem_blocks: [{ type: "image", media_key: "fig1" }],
        options: [
          { number: 1, blocks: [{ type: "text", text: "A" }] },
          { number: 2, blocks: [{ type: "text", text: "B" }] },
          { number: 3, blocks: [{ type: "text", text: "C" }] },
          { number: 4, blocks: [{ type: "text", text: "D" }] },
        ],
        correct_option: 1,
        solution_blocks: [{ type: "text", text: "..." }],
        assets: [{ media_key: "fig1", filename: "fig1.png", mime_type: "image/png", checksum: `sha256:${checksum}` }],
        provenance: { producer_type: "human", source_artifact: "media-test" },
      },
      [{ name: "fig1.png", buffer: imageBuf }],
    );

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

    const res = await request(app.getHttpServer()).get(`/media/${checksum}`).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^http/);
  });
});
