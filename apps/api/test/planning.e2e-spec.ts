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

describe("Planning / Study OS (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const subjectCode = `planning-subject-${Date.now()}`;
  const topicCode = `planning-topic-${Date.now()}`;

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
        topic_codes: [topicCode],
        stem_blocks: [{ type: "text", text: `stem ${externalId}` }],
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

  async function answerWrongAndSubmit(studentCookie: string, questionId: string) {
    const examRes = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({
        slug: `planning-exam-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        title: "x",
        description: "x",
        mode: "STATIC",
        durationMinutes: 30,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId, order: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${examRes.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);

    const startRes = await request(app.getHttpServer())
      .post(`/exams/${examRes.body.id}/start`)
      .set("Cookie", studentCookie)
      .expect(201);
    await request(app.getHttpServer())
      .put(`/attempts/${startRes.body.id}/answers/${questionId}`)
      .set("Cookie", studentCookie)
      .send({ selectedOption: 4 }) // deliberately wrong (correct is set by caller separately)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/attempts/${startRes.body.id}/submit`)
      .set("Cookie", studentCookie)
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
    prisma = app.get(PrismaService);
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires a goal before replanning", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({})
      .expect(400);
  });

  it("builds a plan from weak-topic mastery, surfaces today's tasks, and completes one", async () => {
    const studentCookie = await login(randomPhone());
    const questionId = await authorAndPublishQuestion(`planning-q-${Date.now()}`, 1); // correct=1
    await answerWrongAndSubmit(studentCookie, questionId); // student answers 4 -> wrong

    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({ degree: "MASTER", field: "computer-engineering", weeklyHours: 14 })
      .expect(200);

    const planRes = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({})
      .expect(201);
    expect(planRes.body.tasks.length).toBeGreaterThan(0);
    expect(planRes.body.tasks.every((t: any) => t.topicCode === topicCode)).toBe(true);

    const masteryRes = await request(app.getHttpServer())
      .get("/me/mastery")
      .set("Cookie", studentCookie)
      .expect(200);
    const topicMastery = masteryRes.body.find((m: any) => m.topicCode === topicCode);
    expect(topicMastery).toBeDefined();
    expect(topicMastery.masteryScore).toBeLessThan(0.6);

    const todayRes = await request(app.getHttpServer())
      .get("/me/plan/today")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(todayRes.body.tasks.length).toBeGreaterThan(0);
    expect(todayRes.body.tasks.length).toBeLessThanOrEqual(3);

    const taskId = todayRes.body.tasks[0].id;
    const completeRes = await request(app.getHttpServer())
      .post(`/me/plan/tasks/${taskId}/complete`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(completeRes.body.status).toBe("DONE");

    const studySessions = await prisma.studySession.findMany({ where: { taskId } });
    expect(studySessions).toHaveLength(1);
  });

  it("reschedules overdue tasks to today on a FALLING_BEHIND replan, recording history", async () => {
    const studentCookie = await login(randomPhone());
    const questionId = await authorAndPublishQuestion(`planning-q2-${Date.now()}`, 1);
    await answerWrongAndSubmit(studentCookie, questionId);

    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({ degree: "MASTER", field: "computer-engineering", weeklyHours: 7 })
      .expect(200);
    const initialPlanRes = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({})
      .expect(201);

    const plan = await prisma.plan.findFirstOrThrow({
      where: { id: initialPlanRes.body.id },
      include: { tasks: true },
    });
    // Backdate one PENDING task to simulate falling behind, without waiting real days.
    const overdueTask = plan.tasks.find((t) => t.status === "PENDING");
    expect(overdueTask).toBeDefined();
    await prisma.task.update({
      where: { id: overdueTask!.id },
      data: { scheduledFor: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    });

    const replanRes = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({ reasonCode: "FALLING_BEHIND", note: "test" })
      .expect(201);
    const updatedTask = replanRes.body.tasks.find((t: any) => t.id === overdueTask!.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(new Date(updatedTask.scheduledFor).getTime()).toBe(today.getTime());

    const revisionsRes = await request(app.getHttpServer())
      .get("/me/plan/revisions")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(revisionsRes.body.some((r: any) => r.reasonCode === "FALLING_BEHIND")).toBe(true);
  });

  it("logs a manual study session and prevents completing another student's task", async () => {
    const studentA = await login(randomPhone());
    const studentB = await login(randomPhone());

    await request(app.getHttpServer())
      .post("/me/study-sessions")
      .set("Cookie", studentA)
      .send({ subjectCode, topicCode, minutes: 25 })
      .expect(201);

    const questionId = await authorAndPublishQuestion(`planning-q3-${Date.now()}`, 1);
    await answerWrongAndSubmit(studentA, questionId);
    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentA)
      .send({ degree: "MASTER", field: "computer-engineering", weeklyHours: 7 })
      .expect(200);
    const planRes = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentA)
      .send({})
      .expect(201);
    const taskId = planRes.body.tasks[0].id;

    await request(app.getHttpServer())
      .post(`/me/plan/tasks/${taskId}/complete`)
      .set("Cookie", studentB)
      .expect(403);
  });
});
