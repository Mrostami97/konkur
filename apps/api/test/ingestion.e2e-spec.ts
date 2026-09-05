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
  return `+9893${suffix}`;
}

function buildZip(payload: unknown, files: { name: string; buffer: Buffer }[] = []): Buffer {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(payload)));
  for (const f of files) zip.addFile(f.name, f.buffer);
  return zip.toBuffer();
}

function articlePayload(externalId: string, title: string, imageChecksum: string) {
  return {
    schema_version: "article.v1",
    external_id: externalId,
    title,
    slug: externalId,
    summary: "ingestion test summary",
    content_blocks: [
      { type: "text", text: "ingested body text" },
      { type: "image", media_key: "fig1" },
    ],
    taxonomy: { major: ["computer-engineering"], tags: ["ingestion-test"] },
    assets: [
      { media_key: "fig1", filename: "fig1.png", mime_type: "image/png", checksum: `sha256:${imageChecksum}` },
    ],
    provenance: { producer_type: "human", source_artifact: "ingestion-e2e-test" },
    review_status: "approved",
  };
}

function questionPayload(externalId: string, correctOption: number) {
  return {
    schema_version: "question.v1",
    external_id: externalId,
    exam: { degree: "master", major: "computer-engineering", year: 1405 },
    subject_code: "algorithms",
    topic_codes: ["asymptotic-analysis"],
    stem_blocks: [{ type: "text", text: "ingested question stem" }],
    options: [
      { number: 1, blocks: [{ type: "text", text: "A" }] },
      { number: 2, blocks: [{ type: "text", text: "B" }] },
      { number: 3, blocks: [{ type: "text", text: "C" }] },
      { number: 4, blocks: [{ type: "text", text: "D" }] },
    ],
    correct_option: correctOption,
    solution_blocks: [{ type: "text", text: "ingested solution" }],
    provenance: { producer_type: "external_ai", source_artifact: "ingestion-e2e-test" },
  };
}

describe("Ingestion pipeline (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;

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

    await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({ phone: SEED_ADMIN_PHONE })
      .expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const verifyRes = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone: SEED_ADMIN_PHONE, code })
      .expect(200);
    adminCookie = verifyRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects import uploads from a plain student", async () => {
    const phone = randomPhone();
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    const studentCookie = res.headers["set-cookie"][0];

    const zip = buildZip(questionPayload(`q-forbidden-${Date.now()}`, 2));
    await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", studentCookie)
      .attach("file", zip, "import.zip")
      .expect(403);
  });

  it("runs the full article pipeline: receive -> stage -> review -> publish -> visible on the portal", async () => {
    const externalId = `ingest-article-${Date.now()}`;
    const imageBuf = Buffer.from("fake-png-bytes-for-testing");
    const zip = buildZip(articlePayload(externalId, "Ingested Title v1", sha256(imageBuf)), [
      { name: "fig1.png", buffer: imageBuf },
    ]);

    const jobRes = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);
    expect(jobRes.body.status).toBe("STAGED");
    const jobId = jobRes.body.id;

    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobId}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(itemsRes.body).toHaveLength(1);
    const item = itemsRes.body[0];
    expect(item.status).toBe("VALID");
    expect(item.dedupeStatus).toBe("NEW");

    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [item.id], decision: "APPROVE" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/import/${jobId}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const article = await prisma.article.findUnique({ where: { externalId } });
    expect(article).not.toBeNull();
    expect(article!.reviewStatus).toBe("PUBLISHED");
    expect(article!.version).toBe(1);

    const publicRes = await request(app.getHttpServer()).get(`/articles/${externalId}`).expect(200);
    expect(publicRes.body.title).toBe("Ingested Title v1");

    const sourceArtifact = await prisma.sourceArtifact.findFirst({ where: { filename: "fig1.png" } });
    expect(sourceArtifact).not.toBeNull();

    const versions = await prisma.contentVersion.findMany({
      where: { entityType: "ARTICLE", entityId: article!.id },
    });
    expect(versions).toHaveLength(1);
  });

  it("is idempotent: re-uploading the exact same zip returns the same job, no reprocessing", async () => {
    const externalId = `ingest-idempotent-${Date.now()}`;
    const zip = buildZip(questionPayload(externalId, 2));

    const first = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    const second = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    const jobs = await prisma.importJob.findMany({ where: { id: first.body.id } });
    expect(jobs).toHaveLength(1);
  });

  it("rejects a schema-invalid item (missing required field) with recorded errors", async () => {
    const bad = { schema_version: "article.v1", external_id: "bad-article", title: "no summary" };
    const zip = buildZip(bad);

    const jobRes = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(itemsRes.body[0].status).toBe("INVALID");
    expect(itemsRes.body[0].validationErrors.length).toBeGreaterThan(0);
  });

  it("rejects an item whose asset checksum doesn't match the zipped file", async () => {
    const externalId = `ingest-bad-asset-${Date.now()}`;
    const realImage = Buffer.from("real-bytes");
    const wrongChecksum = sha256(Buffer.from("different-bytes"));
    const zip = buildZip(articlePayload(externalId, "Bad asset article", wrongChecksum), [
      { name: "fig1.png", buffer: realImage },
    ]);

    const jobRes = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(itemsRes.body[0].status).toBe("INVALID");
    expect(itemsRes.body[0].validationErrors.join(" ")).toMatch(/checksum mismatch/);
  });

  it("supports batch approval of multiple items in one job", async () => {
    const suffix = Date.now();
    const zip = buildZip({
      items: [questionPayload(`batch-q1-${suffix}`, 1), questionPayload(`batch-q2-${suffix}`, 3)],
    });

    const jobRes = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    const itemsRes = await request(app.getHttpServer())
      .get(`/admin/import/${jobRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(itemsRes.body).toHaveLength(2);
    const itemIds = itemsRes.body.map((i: any) => i.id);

    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds, decision: "APPROVE" })
      .expect(201);

    const publishRes = await request(app.getHttpServer())
      .post(`/admin/import/${jobRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);
    expect(publishRes.body).toHaveLength(2);

    const jobAfter = await prisma.importJob.findUnique({ where: { id: jobRes.body.id } });
    expect(jobAfter!.status).toBe("PUBLISHED");
  });

  it("republishing a changed external_id bumps the version, and rollback restores an old one without losing history", async () => {
    const externalId = `ingest-versioned-${Date.now()}`;
    const imageBuf = Buffer.from("fake-png-v1");

    // v1
    const zip1 = buildZip(articlePayload(externalId, "Versioned Title v1", sha256(imageBuf)), [
      { name: "fig1.png", buffer: imageBuf },
    ]);
    const job1 = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip1, "import.zip")
      .expect(201);
    const items1 = await request(app.getHttpServer())
      .get(`/admin/import/${job1.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [items1.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/import/${job1.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const articleV1 = await prisma.article.findUniqueOrThrow({ where: { externalId } });
    expect(articleV1.version).toBe(1);

    // v2: same external_id, different title -> a genuinely different zip
    const zip2 = buildZip(articlePayload(externalId, "Versioned Title v2 (edited)", sha256(imageBuf)), [
      { name: "fig1.png", buffer: imageBuf },
    ]);
    const job2 = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip2, "import.zip")
      .expect(201);
    const items2 = await request(app.getHttpServer())
      .get(`/admin/import/${job2.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(items2.body[0].dedupeStatus).toBe("CONFLICT");

    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [items2.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/import/${job2.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const articleV2 = await prisma.article.findUniqueOrThrow({ where: { externalId } });
    expect(articleV2.version).toBe(2);
    expect(articleV2.title).toBe("Versioned Title v2 (edited)");

    // Rollback to version 1: creates version 3 with v1's content, history intact.
    const rollbackRes = await request(app.getHttpServer())
      .post("/admin/content/rollback")
      .set("Cookie", adminCookie)
      .send({ entityType: "ARTICLE", entityId: articleV2.id, toVersion: 1 })
      .expect(201);
    expect(rollbackRes.body.newVersion).toBe(3);

    const articleAfterRollback = await prisma.article.findUniqueOrThrow({ where: { id: articleV2.id } });
    expect(articleAfterRollback.title).toBe("Versioned Title v1");
    expect(articleAfterRollback.version).toBe(3);

    const versions = await prisma.contentVersion.findMany({
      where: { entityType: "ARTICLE", entityId: articleV2.id },
      orderBy: { version: "asc" },
    });
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
  });
});
