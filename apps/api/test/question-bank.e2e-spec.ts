import "reflect-metadata";
import { createHash } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { purchaseProduct } from "./helpers/purchase";
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

function pngFixture(label: string): Buffer {
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  return Buffer.concat([image, Buffer.from(label)]);
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

    // Freshly authored questions are not samples, so an anonymous permalink
    // request gets locked metadata only -- no stem, no options, no key.
    const publicRes = await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(200);
    expect(publicRes.body.correctOption).toBeUndefined();
    expect(publicRes.body.solutionBlocks).toBeUndefined();
    expect(publicRes.body.options).toBeUndefined();
    expect(publicRes.body.stemBlocks).toBeUndefined();
    expect(publicRes.body.subjectCode).toBe("algorithms");

    const versionsRes = await request(app.getHttpServer())
      .get(`/admin/content/QUESTION/${question.id}/versions`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(versionsRes.body).toHaveLength(1);
  });

  it("never leaks non-sample question content to anonymous or unentitled callers", async () => {
    const externalId = `no-leak-${Date.now()}`;
    // Repeated suites share the disposable DB. Public samples from another
    // case are intentionally readable, so isolate this locked fixture.
    const subjectCode = `no-leak-subject-${externalId}`;
    const jobRes = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send(questionDto(externalId, subjectCode, 1405))
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
    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });

    // Anonymous: neither getById nor list returns this locked answer key.
    const anonById = await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(200);
    expect(anonById.body.correctOption).toBeUndefined();
    expect(anonById.body.solutionBlocks).toBeUndefined();

    const anonList = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${subjectCode}`)
      .expect(200);
    expect(anonList.body.items).toHaveLength(1);
    expect(anonList.body.items[0].id).toBe(question.id);
    for (const item of anonList.body.items) {
      expect(item.correctOption).toBeUndefined();
      expect(item.solutionBlocks).toBeUndefined();
      expect(item.isSample).toBe(false);
      expect(item.stemBlocks).toBeUndefined();
      expect(item.options).toBeUndefined();
    }

    // Logged-in but with no entitlement model to grant access: same result.
    const unentitledCookie = await (async () => {
      const phone = randomPhone();
      await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
      const code = otpProvider.sent[otpProvider.sent.length - 1].code;
      const res = await request(app.getHttpServer())
        .post("/auth/otp/verify")
        .send({ phone, code })
        .expect(200);
      return res.headers["set-cookie"][0] as string;
    })();

    const studentById = await request(app.getHttpServer())
      .get(`/questions/${question.id}`)
      .set("Cookie", unentitledCookie)
      .expect(200);
    expect(studentById.body.correctOption).toBeUndefined();
    expect(studentById.body.solutionBlocks).toBeUndefined();

    const studentList = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${subjectCode}`)
      .set("Cookie", unentitledCookie)
      .expect(200);
    expect(studentList.body.items).toHaveLength(1);
    expect(studentList.body.items[0].id).toBe(question.id);
    for (const item of studentList.body.items) {
      expect(item.correctOption).toBeUndefined();
      expect(item.solutionBlocks).toBeUndefined();
      expect(item.isSample).toBe(false);
      expect(item.stemBlocks).toBeUndefined();
      expect(item.options).toBeUndefined();
    }
  });

  it("gates the answer key by subject bank access: sample vs locked, across anonymous/unentitled/subject-entitled/course-purchase-derived callers", async () => {
    const suffix = Date.now();
    const bankSubject = `bank-subject-${suffix}`;
    const courseSubject = `bank-course-subject-${suffix}`;

    async function authorPublish(externalId: string, subjectCode: string) {
      const jobRes = await request(app.getHttpServer())
        .post("/admin/questions")
        .set("Cookie", adminCookie)
        .send(questionDto(externalId, subjectCode, 1405))
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
      return prisma.question.findUniqueOrThrow({ where: { externalId } });
    }

    async function login() {
      const phone = randomPhone();
      await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
      const code = otpProvider.sent[otpProvider.sent.length - 1].code;
      const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
      return { cookie: res.headers["set-cookie"][0] as string, userId: res.body.user.id as string };
    }

    // Admin flags a sample the same way the doc says it must happen today:
    // a direct DB write, since there is no admin UI for it yet.
    const sample = await authorPublish(`bank-sample-${suffix}`, bankSubject);
    await prisma.question.update({ where: { id: sample.id }, data: { isSample: true } });
    const locked = await authorPublish(`bank-locked-${suffix}`, bankSubject);
    const lockedViaCourse = await authorPublish(`bank-locked-course-${suffix}`, courseSubject);

    // --- Anonymous ------------------------------------------------------
    const anonSample = await request(app.getHttpServer()).get(`/questions/${sample.id}`).expect(200);
    expect(anonSample.body.correctOption).toBe(2);
    expect(anonSample.body.solutionBlocks).toBeDefined();

    const anonLocked = await request(app.getHttpServer()).get(`/questions/${locked.id}`).expect(200);
    expect(anonLocked.body.correctOption).toBeUndefined();
    expect(anonLocked.body.solutionBlocks).toBeUndefined();
    // The permalink is not a way around the gate: a non-sample question the
    // caller has no bank access to carries no stem or options either, only
    // locked metadata. The question text itself is the paid asset.
    expect(anonLocked.body.options).toBeUndefined();
    expect(anonLocked.body.stemBlocks).toBeUndefined();

    const anonList = await request(app.getHttpServer()).get(`/questions?subjectCode=${bankSubject}`).expect(200);
    const anonLockedItem = anonList.body.items.find((item: any) => item.id === locked.id);
    expect(anonLockedItem.correctOption).toBeUndefined();
    expect(anonLockedItem.solutionBlocks).toBeUndefined();
    // list browsing of a locked item carries no stem/options either --
    // browsing many stems at once is "full bank browsing", which the bank
    // access model gates; the row still appears (locked metadata) rather
    // than being silently dropped, so a UI can show it as a locked row.
    expect(anonLockedItem.stemBlocks).toBeUndefined();
    expect(anonLockedItem.options).toBeUndefined();
    expect(anonLockedItem.subjectCode).toBe(bankSubject);
    const anonSampleItem = anonList.body.items.find((item: any) => item.id === sample.id);
    expect(anonSampleItem.correctOption).toBe(2);
    expect(anonSampleItem.stemBlocks).toBeDefined();

    // --- Logged in, no entitlement: identical outcome to anonymous ------
    const unentitled = await login();
    const unentitledLocked = await request(app.getHttpServer())
      .get(`/questions/${locked.id}`)
      .set("Cookie", unentitled.cookie)
      .expect(200);
    expect(unentitledLocked.body.correctOption).toBeUndefined();
    expect(unentitledLocked.body.solutionBlocks).toBeUndefined();

    // --- Subject-entitled: standalone QUESTION_BANK product, manually
    // granted (stands in for a completed purchase) -----------------------
    const bankProductRes = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: `bank-product-${suffix}`,
        title: "Bank product",
        description: "bank access",
        kind: "QUESTION_BANK",
        questionBankSubjectCodes: [bankSubject],
      })
      .expect(201);

    const bankStudent = await login();
    await request(app.getHttpServer())
      .post("/admin/entitlements/grant")
      .set("Cookie", adminCookie)
      .send({
        userId: bankStudent.userId,
        productId: bankProductRes.body.id,
        grantedVia: "MANUAL",
        reason: "e2e subject grant",
      })
      .expect(201);

    const entitledLocked = await request(app.getHttpServer())
      .get(`/questions/${locked.id}`)
      .set("Cookie", bankStudent.cookie)
      .expect(200);
    expect(entitledLocked.body.correctOption).toBe(2);
    expect(entitledLocked.body.solutionBlocks).toBeDefined();

    const entitledList = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${bankSubject}`)
      .set("Cookie", bankStudent.cookie)
      .expect(200);
    const entitledLockedItem = entitledList.body.items.find((item: any) => item.id === locked.id);
    expect(entitledLockedItem.correctOption).toBe(2);
    expect(entitledLockedItem.stemBlocks).toBeDefined();

    // The grant is subject-scoped -- it does not unlock a different subject.
    const entitledCrossSubject = await request(app.getHttpServer())
      .get(`/questions/${lockedViaCourse.id}`)
      .set("Cookie", bankStudent.cookie)
      .expect(200);
    expect(entitledCrossSubject.body.correctOption).toBeUndefined();

    // --- The bank is sold separately from courses (owner, 2026-10-06): a
    // COURSE product cannot carry it, buying the course alone does not open
    // it, and a course sold with its bank is a BUNDLE --------------------
    const courseRes = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `bank-course-${suffix}`, title: "Course", description: "d" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/courses/${courseRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: `bank-course-product-refused-${suffix}`,
        title: "Course + bank",
        description: "d",
        kind: "COURSE",
        courseId: courseRes.body.id,
        questionBankSubjectCodes: [courseSubject],
      })
      .expect(400);

    const courseProductRes = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({ slug: `bank-course-product-${suffix}`, title: "Course", description: "d", kind: "COURSE", courseId: courseRes.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/products/${courseProductRes.body.id}/prices`)
      .set("Cookie", adminCookie)
      .send({ amountRial: 100000 })
      .expect(201);

    const courseStudent = await login();
    await purchaseProduct(app, {
      buyerCookie: courseStudent.cookie,
      adminCookie,
      productId: courseProductRes.body.id,
    });
    const courseOnlyAnswer = await request(app.getHttpServer())
      .get(`/questions/${lockedViaCourse.id}`)
      .set("Cookie", courseStudent.cookie)
      .expect(200);
    expect(courseOnlyAnswer.body.correctOption).toBeUndefined();

    const bundleRes = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: `bank-course-bundle-${suffix}`,
        title: "Course and its bank",
        description: "d",
        kind: "BUNDLE",
        courseIds: [courseRes.body.id],
        questionBankSubjectCodes: [courseSubject],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/products/${bundleRes.body.id}/prices`)
      .set("Cookie", adminCookie)
      .send({ amountRial: 150000 })
      .expect(201);

    const bundleStudent = await login();
    await purchaseProduct(app, { buyerCookie: bundleStudent.cookie, adminCookie, productId: bundleRes.body.id });
    const bundleAnswer = await request(app.getHttpServer())
      .get(`/questions/${lockedViaCourse.id}`)
      .set("Cookie", bundleStudent.cookie)
      .expect(200);
    expect(bundleAnswer.body.correctOption).toBe(2);

    // The bundle does not grant the unrelated bank-only subject.
    const bundleStudentOtherSubject = await request(app.getHttpServer())
      .get(`/questions/${locked.id}`)
      .set("Cookie", bundleStudent.cookie)
      .expect(200);
    expect(bundleStudentOtherSubject.body.correctOption).toBeUndefined();
  });

  it("denies anonymous media access to an artifact not (yet) part of any public content", async () => {
    const externalId = `staged-only-${Date.now()}`;
    const imageBuf = pngFixture(`staged-${externalId}`);
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
        provenance: { producer_type: "human", source_artifact: "staged-only-test" },
      },
      [{ name: "fig1.png", buffer: imageBuf }],
    );

    // Stage the artifact but never approve/publish it, so no Question or
    // Article row references its checksum in `assets` yet.
    await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", adminCookie)
      .attach("file", zip, "import.zip")
      .expect(201);

    const anonRes = await request(app.getHttpServer()).get(`/media/${checksum}`).redirects(0);
    expect(anonRes.status).toBe(404);

    // Content staff can preview staged files; an ordinary student cannot.
    await request(app.getHttpServer()).get(`/media/${checksum}`).set("Cookie", studentCookie).expect(404);
    const authedRes = await request(app.getHttpServer())
      .get(`/media/${checksum}`)
      .set("Cookie", adminCookie)
      .redirects(0);
    expect(authedRes.status).toBe(200);
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

    // "Only with a worked solution": a checked question still waiting for its solution (SILVER) drops out.
    await prisma.question.update({ where: { externalId: `search-q1-${suffix}` }, data: { qualityTier: "SILVER", solutionBlocks: [] } });
    const solved = await request(app.getHttpServer())
      .get(`/questions?subjectCode=${subjectCode}&solved=true`)
      .expect(200);
    expect(solved.body.total).toBe(1);
    expect(solved.body.items[0].examYear).toBe(1405);
    const all = await request(app.getHttpServer()).get(`/questions?subjectCode=${subjectCode}`).expect(200);
    expect(all.body.total).toBe(2);
  });

  it("serves «۱۰ تست امروز» from readable questions only, and counts the day's answers and the streak", async () => {
    const suffix = Date.now();
    const subjectCode = `today-subject-${suffix}`;
    async function publish(externalId: string) {
      const job = await request(app.getHttpServer()).post("/admin/questions").set("Cookie", adminCookie).send(questionDto(externalId, subjectCode, 1405)).expect(201);
      const items = await request(app.getHttpServer()).get(`/admin/import/${job.body.id}/items`).set("Cookie", adminCookie).expect(200);
      await request(app.getHttpServer()).post("/admin/import/items/review").set("Cookie", adminCookie).send({ itemIds: [items.body[0].id], decision: "APPROVE" }).expect(201);
      await request(app.getHttpServer()).post(`/admin/import/${job.body.id}/publish`).set("Cookie", adminCookie).expect(201);
      return prisma.question.findUniqueOrThrow({ where: { externalId } });
    }
    const sample = await publish(`today-sample-${suffix}`);
    await prisma.question.update({ where: { id: sample.id }, data: { isSample: true } });
    const locked = await publish(`today-locked-${suffix}`);

    await request(app.getHttpServer()).get("/questions/today").expect(401);

    const phone = randomPhone();
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const login = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    const cookie = login.headers["set-cookie"][0] as string;

    const before = await request(app.getHttpServer()).get("/questions/today").set("Cookie", cookie).expect(200);
    expect(before.body).toMatchObject({ goal: 10, answeredToday: 0, streak: 0 });
    const ids = before.body.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(locked.id);
    // Every question served is whole: a locked one would arrive without its key.
    for (const item of before.body.items) expect(item.correctOption).toBeDefined();

    await request(app.getHttpServer()).post(`/questions/${sample.id}/practice`).set("Cookie", cookie).send({ selectedOption: 2 }).expect(201);
    const after = await request(app.getHttpServer()).get("/questions/today").set("Cookie", cookie).expect(200);
    expect(after.body).toMatchObject({ answeredToday: 1, streak: 1 });
    expect(after.body.items.map((item: { id: string }) => item.id)).not.toContain(sample.id);

    const samplesOnly = await request(app.getHttpServer()).get(`/questions?subjectCode=${subjectCode}&sample=true`).expect(200);
    expect(samplesOnly.body.items.map((item: { id: string }) => item.id)).toEqual([sample.id]);
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

  it("serves an ingested media asset once public content uses it", async () => {
    const externalId = `media-question-${Date.now()}`;
    const subjectCode = `media-subject-${externalId}`;
    const imageBuf = pngFixture(`sample-${externalId}`);
    const checksum = sha256(imageBuf);
    const zip = buildZip(
      {
        schema_version: "question.v1",
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: subjectCode,
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

    // Non-sample bank media requires a grant even after publication.
    await request(app.getHttpServer()).get(`/media/${checksum}`).expect(404);
    const published = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    await request(app.getHttpServer()).post(`/admin/questions/${published.id}/sample`)
      .set("Cookie", adminCookie).send({ isSample: true }).expect(201);

    // Served by the API itself: storage is never reachable from a browser.
    const res = await request(app.getHttpServer()).get(`/media/${checksum}`).redirects(0);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^image\//);
    expect(res.headers["accept-ranges"]).toBe("bytes");

    // Return the sample fixture to locked state and verify that a fresh
    // media request observes the revoked public access.
    await request(app.getHttpServer()).post(`/admin/questions/${published.id}/sample`)
      .set("Cookie", adminCookie).send({ isSample: false }).expect(201);
    await request(app.getHttpServer()).get(`/media/${checksum}`).expect(404);
  });
it("retires a question out of the bank without destroying it, and can restore it", async () => {
    const externalId = `retire-${Date.now()}`;
    const jobRes = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send(questionDto(externalId, "algorithms", 1405))
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
    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });

    // Visible in the bank before retirement.
    await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(200);

    await request(app.getHttpServer())
      .post(`/admin/questions/${question.id}/retire`)
      .set("Cookie", adminCookie)
      .send({ reason: "پاسخ نادرست بود" })
      .expect(201);

    // Gone from every public path -- list and the permalink alike.
    await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(404);
    const publicList = await request(app.getHttpServer()).get("/questions?subjectCode=algorithms").expect(200);
    expect(publicList.body.items.some((item: any) => item.id === question.id)).toBe(false);

    // The row survives, so a past attempt report still has something to read.
    const retired = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(retired.retiredAt).not.toBeNull();
    expect(retired.retiredReason).toBe("پاسخ نادرست بود");
    expect(retired.isSample).toBe(false);

    // Admin can still see it when asking for retired rows.
    const adminList = await request(app.getHttpServer())
      .get("/admin/questions?includeRetired=true&subjectCode=algorithms")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(adminList.body.items.some((item: any) => item.id === question.id)).toBe(true);

    // A retired question cannot be made a public sample.
    await request(app.getHttpServer())
      .post(`/admin/questions/${question.id}/sample`)
      .set("Cookie", adminCookie)
      .send({ isSample: true })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/admin/questions/${question.id}/restore`)
      .set("Cookie", adminCookie)
      .expect(201);
    await request(app.getHttpServer()).get(`/questions/${question.id}`).expect(200);
  });
});
