import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
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

function randomPhone(): string {
  const suffix = Math.floor(1_000_000 + Math.random() * 8_999_999);
  return `+9896${suffix}`;
}

describe("Student test builder (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const suffix = Date.now();
  const subjectCode = `practice-subject-${suffix}`;
  // Ten questions: q0..q3 are public samples, q0..q4 carry topic t-a,
  // q5..q9 carry topic t-b. Correct option is always 2.
  const questionIds: string[] = [];
  let bankProductId: string;

  async function login(phone = randomPhone()): Promise<{ cookie: string; userId: string }> {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return { cookie: res.headers["set-cookie"][0] as string, userId: res.body.user.id as string };
  }

  async function examReadyStudent() {
    const student = await login();
    await request(app.getHttpServer())
      .patch("/me/profile")
      .set("Cookie", student.cookie)
      .send({
        firstName: "دانشجو",
        lastName: "آزمایشی",
        educationStatus: "BACHELOR_STUDENT",
        universityName: "دانشگاه آزمایشی",
        fieldOfStudy: "مهندسی کامپیوتر",
        targetDegree: "MASTER",
        targetField: "computer-engineering",
      })
      .expect(200);
    return student;
  }

  async function grantBank(userId: string) {
    await request(app.getHttpServer())
      .post("/admin/entitlements/grant")
      .set("Cookie", adminCookie)
      .send({ userId, productId: bankProductId, grantedVia: "MANUAL", reason: "e2e practice grant" })
      .expect(201);
  }

  async function authorAndPublishQuestion(externalId: string, topic: string): Promise<string> {
    const jobRes = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send({
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: subjectCode,
        topic_codes: [topic],
        stem_blocks: [{ type: "text", text: `stem for ${externalId}` }],
        options: [1, 2, 3, 4].map((number) => ({ number, blocks: [{ type: "text", text: `o${number}` }] })),
        correct_option: 2,
        solution_blocks: [{ type: "text", text: "solution" }],
      })
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
    await request(app.getHttpServer()).post(`/admin/import/${jobRes.body.id}/publish`).set("Cookie", adminCookie).expect(201);
    return (await prisma.question.findUniqueOrThrow({ where: { externalId } })).id;
  }

  async function build(cookie: string, body: Record<string, unknown>, status = 201) {
    return request(app.getHttpServer()).post("/me/practice").set("Cookie", cookie).send(body).expect(status);
  }

  beforeAll(async () => {
    otpProvider = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otpProvider)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await seed();
    adminCookie = (await login(SEED_ADMIN_PHONE)).cookie;

    for (let i = 0; i < 10; i++) {
      questionIds.push(await authorAndPublishQuestion(`practice-q${i}-${suffix}`, i < 5 ? `t-a-${suffix}` : `t-b-${suffix}`));
    }
    for (const id of questionIds.slice(0, 4)) {
      await request(app.getHttpServer())
        .post(`/admin/questions/${id}/sample`)
        .set("Cookie", adminCookie)
        .send({ isSample: true })
        .expect(201);
    }
    const productRes = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: `practice-bank-${suffix}`,
        title: "Practice bank",
        description: "bank access",
        kind: "QUESTION_BANK",
        questionBankSubjectCodes: [subjectCode],
      })
      .expect(201);
    bankProductId = productRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a signed-in student", async () => {
    await request(app.getHttpServer()).get("/me/practice/options").expect(401);
    await request(app.getHttpServer()).post("/me/practice").send({ subjectCode, questionCount: 3 }).expect(401);
  });

  it("offers real pool counts: samples only without bank access, everything with it", async () => {
    const student = await examReadyStudent();
    const before = await request(app.getHttpServer()).get("/me/practice/options").set("Cookie", student.cookie).expect(200);
    const subject = before.body.find((s: any) => s.code === subjectCode);
    expect(subject).toMatchObject({ total: 10, available: 4, hasBankAccess: false });
    const topicA = subject.topics.find((t: any) => t.code === `t-a-${suffix}`);
    const topicB = subject.topics.find((t: any) => t.code === `t-b-${suffix}`);
    expect(topicA).toMatchObject({ total: 5, available: 4 });
    expect(topicB).toMatchObject({ total: 5, available: 0 });

    const preview = await request(app.getHttpServer())
      .post("/me/practice/preview")
      .set("Cookie", student.cookie)
      .send({ subjectCode, topicCodes: [`t-a-${suffix}`, `t-b-${suffix}`] })
      .expect(200);
    expect(preview.body).toEqual({ available: 4, hasBankAccess: false });

    await grantBank(student.userId);
    const previewAfter = await request(app.getHttpServer())
      .post("/me/practice/preview")
      .set("Cookie", student.cookie)
      .send({ subjectCode, topicCodes: [`t-a-${suffix}`, `t-b-${suffix}`], source: "UNSEEN" })
      .expect(200);
    expect(previewAfter.body).toEqual({ available: 10, hasBankAccess: true });
    const after = await request(app.getHttpServer()).get("/me/practice/options").set("Cookie", student.cookie).expect(200);
    expect(after.body.find((s: any) => s.code === subjectCode)).toMatchObject({ total: 10, available: 10, hasBankAccess: true });
  });

  it("draws only public samples for a student without bank access, and never leaks the key mid-attempt", async () => {
    const student = await examReadyStudent();
    const res = await build(student.cookie, { subjectCode, questionCount: 4 });
    const drawn: string[] = res.body.attempt.items.map((item: any) => item.questionId);
    expect(new Set(drawn)).toEqual(new Set(questionIds.slice(0, 4)));
    for (const item of res.body.attempt.items) {
      expect(item.question.correctOption).toBeUndefined();
      expect(item.question.solutionBlocks).toBeUndefined();
    }

    // A fifth question would have to be a paid one: refused, with the count.
    const refused = await build(student.cookie, { subjectCode, questionCount: 5 }, 400);
    expect(refused.body).toMatchObject({ available: 4, hasBankAccess: false });
  });

  it("builds from the whole subject with bank access, filtered by topic, and runs through to a report", async () => {
    const student = await examReadyStudent();
    await grantBank(student.userId);
    const res = await build(student.cookie, { subjectCode, topicCodes: [`t-b-${suffix}`], questionCount: 5 });
    const attempt = res.body.attempt;
    expect(attempt.items.map((item: any) => item.questionId).sort()).toEqual(questionIds.slice(5).sort());
    // Default time: 1.5 minutes per question, rounded up.
    const exam = await prisma.exam.findUniqueOrThrow({ where: { id: res.body.examId } });
    expect(exam).toMatchObject({ durationMinutes: 8, isPractice: true, isPublished: false, ownerUserId: student.userId });

    for (const [index, item] of attempt.items.entries()) {
      await request(app.getHttpServer())
        .put(`/attempts/${attempt.id}/answers/${item.questionId}`)
        .set("Cookie", student.cookie)
        .send({ selectedOption: index < 3 ? 2 : 1 })
        .expect(200);
    }
    const submitted = await request(app.getHttpServer())
      .post(`/attempts/${attempt.id}/submit`)
      .set("Cookie", student.cookie)
      .expect(201);
    expect(submitted.body).toMatchObject({ correctCount: 3, wrongCount: 2 });

    const report = await request(app.getHttpServer())
      .get(`/attempts/${attempt.id}/report`)
      .set("Cookie", student.cookie)
      .expect(200);
    expect(report.body.items).toHaveLength(5);
    expect(report.body.isPractice).toBe(true);
    await request(app.getHttpServer()).get(`/attempts/${attempt.id}/standing`).set("Cookie", student.cookie).expect(404);

    // Its own list shows it; its attempt carries no standing (one participant).
    const list = await request(app.getHttpServer()).get("/me/practice").set("Cookie", student.cookie).expect(200);
    expect(list.body[0]).toMatchObject({ id: res.body.examId, attemptCount: 1, latestAttempt: { status: "SUBMITTED" } });
    const attempts = await request(app.getHttpServer()).get("/me/attempts").set("Cookie", student.cookie).expect(200);
    const row = attempts.body.find((a: any) => a.id === attempt.id);
    expect(row.exam.isPractice).toBe(true);
    expect(row.standing).toBeNull();

    // Mistakes mode draws exactly the two answered wrong; unseen draws the
    // five of topic a it has never met.
    const mistakes = await build(student.cookie, { subjectCode, questionCount: 2, source: "MISTAKES" });
    const wrongIds = attempt.items.slice(3).map((item: any) => item.questionId).sort();
    expect(mistakes.body.attempt.items.map((item: any) => item.questionId).sort()).toEqual(wrongIds);
    await build(student.cookie, { subjectCode, questionCount: 3, source: "MISTAKES" }, 400);

    const unseen = await build(student.cookie, { subjectCode, questionCount: 5, source: "UNSEEN" });
    expect(unseen.body.attempt.items.map((item: any) => item.questionId).sort()).toEqual(questionIds.slice(0, 5).sort());
  });

  it("keeps a practice exam private to its owner and out of the catalog and admin list", async () => {
    const owner = await examReadyStudent();
    const res = await build(owner.cookie, { subjectCode, questionCount: 3 });
    const other = await examReadyStudent();
    await request(app.getHttpServer()).post(`/exams/${res.body.examId}/start`).set("Cookie", other.cookie).expect(404);
    await request(app.getHttpServer()).get(`/attempts/${res.body.attempt.id}`).set("Cookie", other.cookie).expect(403);

    const catalog = await request(app.getHttpServer()).get("/exams").expect(200);
    expect(catalog.body.some((exam: any) => exam.id === res.body.examId)).toBe(false);
    const adminList = await request(app.getHttpServer()).get("/admin/exams").set("Cookie", adminCookie).expect(200);
    expect(adminList.body.some((exam: any) => exam.id === res.body.examId)).toBe(false);
    await request(app.getHttpServer()).post(`/admin/exams/${res.body.examId}/publish`).set("Cookie", adminCookie).expect(404);

    // Owner resumes the same attempt rather than opening a second one.
    const resumed = await request(app.getHttpServer())
      .post(`/exams/${res.body.examId}/start`)
      .set("Cookie", owner.cookie)
      .expect(201);
    expect(resumed.body.id).toBe(res.body.attempt.id);
  });

  it("refuses a retake once the bank access the form was drawn under has ended", async () => {
    const student = await examReadyStudent();
    await grantBank(student.userId);
    const res = await build(student.cookie, { subjectCode, topicCodes: [`t-b-${suffix}`], questionCount: 3 });
    await request(app.getHttpServer()).post(`/attempts/${res.body.attempt.id}/submit`).set("Cookie", student.cookie).expect(201);

    await prisma.entitlement.updateMany({ where: { userId: student.userId }, data: { revokedAt: new Date() } });
    await request(app.getHttpServer()).post(`/exams/${res.body.examId}/start`).set("Cookie", student.cookie).expect(403);
  });

  it("rejects answers to a question that is not on the attempt", async () => {
    const student = await examReadyStudent();
    const res = await build(student.cookie, { subjectCode, questionCount: 3 });
    const onForm = new Set(res.body.attempt.items.map((item: any) => item.questionId));
    const offForm = questionIds.find((id) => !onForm.has(id))!;
    await request(app.getHttpServer())
      .put(`/attempts/${res.body.attempt.id}/answers/${offForm}`)
      .set("Cookie", student.cookie)
      .send({ selectedOption: 2 })
      .expect(404);
  });

  it("validates the request and requires a completed profile", async () => {
    const student = await examReadyStudent();
    await build(student.cookie, { subjectCode, questionCount: 0 }, 400);
    await build(student.cookie, { subjectCode, questionCount: 101 }, 400);
    await build(student.cookie, { subjectCode, questionCount: 3, source: "RANDOM" }, 400);
    await build(student.cookie, { subjectCode: `missing-${suffix}`, questionCount: 3 }, 404);

    const bare = await login();
    const res = await request(app.getHttpServer())
      .post("/me/practice")
      .set("Cookie", bare.cookie)
      .send({ subjectCode, questionCount: 3 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.exam.count({ where: { ownerUserId: bare.userId } })).toBe(0);
  });
});
