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
  return `+9895${suffix}`;
}

describe("Assessment engine (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const subjectCode = `assessment-subject-${Date.now()}`;
  const questionIds: string[] = [];

  async function login(phone: string): Promise<string> {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  async function authorAndPublishQuestion(externalId: string, correctOption: number): Promise<string> {
    const jobRes = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send({
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: subjectCode,
        topic_codes: ["t1"],
        stem_blocks: [{ type: "text", text: `stem for ${externalId}` }],
        options: [
          { number: 1, blocks: [{ type: "text", text: "A" }] },
          { number: 2, blocks: [{ type: "text", text: "B" }] },
          { number: 3, blocks: [{ type: "text", text: "C" }] },
          { number: 4, blocks: [{ type: "text", text: "D" }] },
        ],
        correct_option: correctOption,
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
    await request(app.getHttpServer())
      .post(`/admin/import/${jobRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);
    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    return question.id;
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
    prisma = app.get(PrismaService);
    await seed();

    adminCookie = await login(SEED_ADMIN_PHONE);

    // Q1 correct=2, Q2 correct=3, Q3 correct=1, Q4 correct=4, Q5 correct=2
    const correctAnswers = [2, 3, 1, 4, 2];
    for (let i = 0; i < correctAnswers.length; i++) {
      const id = await authorAndPublishQuestion(`assessment-q${i + 1}-${Date.now()}`, correctAnswers[i]);
      questionIds.push(id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies exam authoring to a plain student", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", studentCookie)
      .send({ slug: `forbidden-${Date.now()}`, title: "x", description: "x", mode: "STATIC", durationMinutes: 10 })
      .expect(403);
  });

  it("runs the full STATIC exam flow: build -> start -> answer -> submit -> report", async () => {
    const slug = `static-exam-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Static Test Exam", description: "...", mode: "STATIC", durationMinutes: 30 })
      .expect(201);
    const examId = examRes.body.id;

    await request(app.getHttpServer())
      .post(`/admin/exams/${examId}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[0], order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examId}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[1], order: 1 })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/exams/${examId}/publish`).set("Cookie", adminCookie).expect(201);

    const studentCookie = await login(randomPhone());

    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examId}/start`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(startRes.body.items).toHaveLength(2);
    // The answer key must never leak while in progress.
    expect(startRes.body.items[0].question.correctOption).toBeUndefined();
    expect(startRes.body.items[0].question.solutionBlocks).toBeUndefined();
    const attemptId = startRes.body.id;

    // Answer Q1 correctly (2), leave Q2 wrong (1, correct is 3).
    await request(app.getHttpServer())
      .put(`/attempts/${attemptId}/answers/${questionIds[0]}`)
      .set("Cookie", studentCookie)
      .send({ selectedOption: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/attempts/${attemptId}/answers/${questionIds[1]}`)
      .set("Cookie", studentCookie)
      .send({ selectedOption: 1 })
      .expect(200);

    // Resume before submitting shows saved answers.
    const resumeRes = await request(app.getHttpServer())
      .get(`/attempts/${attemptId}`)
      .set("Cookie", studentCookie)
      .expect(200);
    expect(resumeRes.body.status).toBe("IN_PROGRESS");
    const savedSelections = resumeRes.body.items.map((i: any) => i.selectedOption);
    expect(savedSelections.sort()).toEqual([1, 2]);

    const submitRes = await request(app.getHttpServer())
      .post(`/attempts/${attemptId}/submit`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(submitRes.body.correctCount).toBe(1);
    expect(submitRes.body.wrongCount).toBe(1);
    expect(submitRes.body.unansweredCount).toBe(0);

    const reportRes = await request(app.getHttpServer())
      .get(`/attempts/${attemptId}/report`)
      .set("Cookie", studentCookie)
      .expect(200);
    expect(reportRes.body.score.correctCount).toBe(1);
    // Answer key is now revealed post-submission.
    expect(reportRes.body.items[0].question.correctOption).toBeDefined();
  });

  it("prevents answering or double-submitting after submission, and cannot access another student's attempt", async () => {
    const slug = `static-exam-2-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Static Exam 2", description: "...", mode: "STATIC", durationMinutes: 30 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[2], order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const studentA = await login(randomPhone());
    const studentB = await login(randomPhone());

    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examRes.body.id}/start`)
      .set("Cookie", studentA)
      .expect(201);
    const attemptId = startRes.body.id;

    await request(app.getHttpServer())
      .get(`/attempts/${attemptId}`)
      .set("Cookie", studentB)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/attempts/${attemptId}/submit`)
      .set("Cookie", studentA)
      .expect(201);

    await request(app.getHttpServer())
      .put(`/attempts/${attemptId}/answers/${questionIds[2]}`)
      .set("Cookie", studentA)
      .send({ selectedOption: 1 })
      .expect(403);
  });

  it("handles two simultaneous submits safely: exactly one score, both callers see it", async () => {
    const slug = `concurrent-exam-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Concurrent Exam", description: "...", mode: "STATIC", durationMinutes: 30 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[3], order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const studentCookie = await login(randomPhone());
    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examRes.body.id}/start`)
      .set("Cookie", studentCookie)
      .expect(201);
    const attemptId = startRes.body.id;
    await request(app.getHttpServer())
      .put(`/attempts/${attemptId}/answers/${questionIds[3]}`)
      .set("Cookie", studentCookie)
      .send({ selectedOption: 4 })
      .expect(200);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/attempts/${attemptId}/submit`).set("Cookie", studentCookie),
      request(app.getHttpServer()).post(`/attempts/${attemptId}/submit`).set("Cookie", studentCookie),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.correctCount).toBe(second.body.correctCount);

    const scores = await prisma.score.findMany({ where: { attemptId } });
    expect(scores).toHaveLength(1);
    expect(scores[0].correctCount).toBe(1);
  });

  it("auto-expires an attempt past its deadline and scores it from saved answers", async () => {
    const slug = `expiry-exam-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Expiry Exam", description: "...", mode: "STATIC", durationMinutes: 30 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[4], order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const studentCookie = await login(randomPhone());
    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examRes.body.id}/start`)
      .set("Cookie", studentCookie)
      .expect(201);
    const attemptId = startRes.body.id;
    await request(app.getHttpServer())
      .put(`/attempts/${attemptId}/answers/${questionIds[4]}`)
      .set("Cookie", studentCookie)
      .send({ selectedOption: 2 })
      .expect(200);

    // Simulate time passing without needing to actually wait.
    await prisma.attempt.update({ where: { id: attemptId }, data: { deadlineAt: new Date(Date.now() - 1000) } });

    const resumeRes = await request(app.getHttpServer())
      .get(`/attempts/${attemptId}`)
      .set("Cookie", studentCookie)
      .expect(200);
    expect(resumeRes.body.status).toBe("EXPIRED");

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(attempt.status).toBe("EXPIRED");
    const score = await prisma.score.findUnique({ where: { attemptId } });
    expect(score?.correctCount).toBe(1);
  });

  it("runs a DYNAMIC exam: random form drawn from the subject, still scores correctly", async () => {
    const slug = `dynamic-exam-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({
        slug,
        title: "Dynamic Exam",
        description: "...",
        mode: "DYNAMIC",
        durationMinutes: 30,
        subjectCode,
        questionCount: 3,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const studentCookie = await login(randomPhone());
    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examRes.body.id}/start`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(startRes.body.items).toHaveLength(3);

    for (const item of startRes.body.items) {
      await request(app.getHttpServer())
        .put(`/attempts/${startRes.body.id}/answers/${item.questionId}`)
        .set("Cookie", studentCookie)
        .send({ selectedOption: 1 })
        .expect(200);
    }

    const submitRes = await request(app.getHttpServer())
      .post(`/attempts/${startRes.body.id}/submit`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(submitRes.body.correctCount + submitRes.body.wrongCount).toBe(3);
  });

  it("reports basic psychometrics across submitted attempts", async () => {
    const slug = `psychometrics-exam-${Date.now()}`;
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Psychometrics Exam", description: "...", mode: "STATIC", durationMinutes: 30 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: questionIds[0], order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    for (const selected of [2, 2, 1]) {
      const studentCookie = await login(randomPhone());
      const startRes = await request(app.getHttpServer())
        .post(`/exams/${examRes.body.id}/start`)
        .set("Cookie", studentCookie)
        .expect(201);
      await request(app.getHttpServer())
        .put(`/attempts/${startRes.body.id}/answers/${questionIds[0]}`)
        .set("Cookie", studentCookie)
        .send({ selectedOption: selected })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/attempts/${startRes.body.id}/submit`)
        .set("Cookie", studentCookie)
        .expect(201);
    }

    const psychometricsRes = await request(app.getHttpServer())
      .get(`/admin/exams/${examRes.body.id}/psychometrics`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(psychometricsRes.body.attemptCount).toBe(3);
    const item = psychometricsRes.body.items.find((i: any) => i.questionId === questionIds[0]);
    expect(item.sampleSize).toBe(3);
    expect(item.difficulty).toBeCloseTo(2 / 3, 5);
  });
});
