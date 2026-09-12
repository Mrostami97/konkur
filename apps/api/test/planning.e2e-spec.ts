import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { PlanningService } from "../src/modules/planning/planning.service";
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

  it("serializes concurrent fresh replans and rolls a failed replacement back atomically", async () => {
    const phone = randomPhone();
    const studentCookie = await login(phone);
    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({
        degree: "MASTER",
        field: `phase16-atomic-${Date.now()}`,
        weeklyHours: 4,
        selfReportedLevel: "INTERMEDIATE",
      })
      .expect(200);
    const initial = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({ reasonCode: "MANUAL_REQUEST" })
      .expect(201);
    const student = await prisma.user.findUniqueOrThrow({ where: { phone } });

    const planning = app.get(PlanningService);
    const buildSpy = jest
      .spyOn(planning as any, "buildTasksForNewPlan")
      .mockRejectedValueOnce(new Error("phase16 forced task-build failure"));
    await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({ reasonCode: "GOAL_CHANGED" })
      .expect(500);
    buildSpy.mockRestore();

    const afterFailure = await prisma.plan.findMany({ where: { userId: student.id } });
    expect(afterFailure).toHaveLength(1);
    expect(afterFailure[0]).toMatchObject({ id: initial.body.id, status: "ACTIVE", version: 1 });

    await Promise.all([
      request(app.getHttpServer())
        .post("/me/plan/replan")
        .set("Cookie", studentCookie)
        .send({ reasonCode: "MANUAL_REQUEST", note: "concurrent a" })
        .expect(201),
      request(app.getHttpServer())
        .post("/me/plan/replan")
        .set("Cookie", studentCookie)
        .send({ reasonCode: "MANUAL_REQUEST", note: "concurrent b" })
        .expect(201),
    ]);

    const plans = await prisma.plan.findMany({
      where: { userId: student.id },
      orderBy: { version: "asc" },
    });
    expect(plans.map((plan) => plan.version)).toEqual([1, 2, 3]);
    expect(plans.filter((plan) => plan.status === "ACTIVE")).toHaveLength(1);
    expect(plans.at(-1)?.status).toBe("ACTIVE");
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
    expect(planRes.body.tasks.some((t: any) => t.topicCode === topicCode)).toBe(true);

    const masteryRes = await request(app.getHttpServer())
      .get("/me/mastery")
      .set("Cookie", studentCookie)
      .expect(200);
    const topicMastery = masteryRes.body.find((m: any) => m.topicCode === topicCode);
    expect(topicMastery).toBeDefined();
    expect(topicMastery.masteryScore).toBeLessThan(0.6);

    const plannedTarget = planRes.body.tasks.find((task: any) => task.topicCode === topicCode);
    expect(plannedTarget).toBeDefined();
    // A task may be completed today even when it was originally overdue. Its
    // completion belongs to today's progress, but it must not remain pending.
    await prisma.task.update({
      where: { id: plannedTarget.id },
      data: {
        scheduledFor: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        priority: 0,
      },
    });
    const todayRes = await request(app.getHttpServer())
      .get("/me/plan/today")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(todayRes.body.tasks.length).toBeGreaterThan(0);
    expect(todayRes.body.tasks.length).toBeLessThanOrEqual(3);

    const targetTask = todayRes.body.tasks.find((task: any) => task.topicCode === topicCode);
    expect(targetTask).toBeDefined();
    const taskId = targetTask.id;
    const completeRes = await request(app.getHttpServer())
      .post(`/me/plan/tasks/${taskId}/complete`)
      .set("Cookie", studentCookie)
      .send({ actualMinutes: 27 })
      .expect(201);
    expect(completeRes.body.status).toBe("DONE");

    const studySessions = await prisma.studySession.findMany({ where: { taskId } });
    expect(studySessions).toHaveLength(1);
    expect(studySessions[0].minutes).toBe(27);
    expect(studySessions[0].source).toBe("TASK_ACTUAL");

    const afterCompletion = await request(app.getHttpServer())
      .get("/me/plan/today")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(afterCompletion.body.tasks.some((task: any) => task.id === taskId)).toBe(false);
    expect(afterCompletion.body.summary.completedTasks).toBe(1);
    expect(afterCompletion.body.summary.completedMinutes).toBe(27);
    expect(afterCompletion.body.summary.totalTasks).toBe(afterCompletion.body.tasks.length + 1);
    expect(afterCompletion.body.summary.progressPercent).toBe(
      Math.round(100 / afterCompletion.body.summary.totalTasks),
    );
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
    const tehranDate = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
    expect(tehranDate(new Date(updatedTask.scheduledFor))).toBe(tehranDate(new Date()));

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

  it("builds an honest cold-start path from published lessons and preserves its goal snapshot", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const studentCookie = await login(randomPhone());
    const prerequisite = await prisma.subject.create({
      data: {
        code: `phase16-prerequisite-${stamp}`,
        slug: `phase16-prerequisite-${stamp}`,
        title: "پیش‌نیاز آزمون فاز شانزده",
      },
    });
    const subject = await prisma.subject.create({
      data: {
        code: `phase16-subject-${stamp}`,
        slug: `phase16-subject-${stamp}`,
        title: "درس آزمون فاز شانزده",
        metadata: { examImportance: { MASTER: 4 } },
        prerequisites: { create: { prerequisiteId: prerequisite.id } },
      },
    });
    const course = await prisma.course.create({
      data: {
        slug: `phase16-course-${stamp}`,
        title: "مسیر واقعی آزمون فاز شانزده",
        description: "fixture for personal learning path",
        isPublished: true,
        accessMode: "PUBLIC",
        subjectId: subject.id,
        degreeTargets: ["MASTER"],
        fieldTargets: [`phase16-field-${stamp}`],
        modules: {
          create: {
            title: "فصل نخست",
            order: 1,
            lessons: {
              create: [1, 2, 3].map((order) => ({
                title: `درس واقعی ${order}`,
                order,
                contentBlocks: [{ type: "text", text: `lesson ${order}` }],
              })),
            },
          },
        },
      },
      include: { modules: { include: { lessons: true } } },
    });

    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({
        degree: "MASTER",
        field: `phase16-field-${stamp}`,
        weeklyHours: 6,
        selfReportedLevel: "BEGINNER",
      })
      .expect(200);
    const planResponse = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({})
      .expect(201);
    expect(planResponse.body.goalSelfReportedLevel).toBe("BEGINNER");

    const today = await request(app.getHttpServer())
      .get("/me/plan/today")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(today.body.tasks).toHaveLength(3);
    expect(today.body.tasks.every((task: any) => typeof task.reason === "string" && task.reason.length > 0)).toBe(true);
    expect(today.body.tasks.some((task: any) => task.reasonCode === "SUBJECT_PREREQUISITE")).toBe(true);
    expect(today.body.tasks.some((task: any) => task.reasonCode === "EXAM_IMPORTANCE")).toBe(true);
    expect(today.body.summary.progressPercent).toBe(0);

    const firstLesson = course.modules[0].lessons[0];
    await request(app.getHttpServer()).get(`/lessons/${firstLesson.id}`).set("Cookie", studentCookie).expect(200);
    await request(app.getHttpServer()).post(`/lessons/${firstLesson.id}/complete`).set("Cookie", studentCookie).expect(201);
    const linkedFirstTask = await prisma.task.findFirstOrThrow({
      where: { planId: planResponse.body.id, lessonId: firstLesson.id },
    });
    expect(linkedFirstTask.status).toBe("DONE");

    const secondLesson = course.modules[0].lessons[1];
    const linkedSecondTask = await prisma.task.findFirstOrThrow({
      where: { planId: planResponse.body.id, lessonId: secondLesson.id },
    });
    await request(app.getHttpServer())
      .post(`/me/plan/tasks/${linkedSecondTask.id}/complete`)
      .set("Cookie", studentCookie)
      .send({ actualMinutes: 19 })
      .expect(201);
    const planOwner = await prisma.plan.findUniqueOrThrow({
      where: { id: planResponse.body.id },
      select: { userId: true },
    });
    const secondProgress = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: planOwner.userId, lessonId: secondLesson.id } },
    });
    expect(secondProgress.completedAt).not.toBeNull();
    const learningProgress = await request(app.getHttpServer())
      .get("/me/learning-progress")
      .set("Cookie", studentCookie)
      .expect(200);
    expect(learningProgress.body.basis).toBe("LESSON_ACTIVITY");
    const courseProgress = learningProgress.body.courses.find((item: any) => item.course.slug === course.slug);
    expect(courseProgress.completedLessons).toBe(2);
    expect(courseProgress.totalLessons).toBe(3);
    const actualSession = await prisma.studySession.findFirstOrThrow({ where: { taskId: linkedSecondTask.id } });
    expect(actualSession.minutes).toBe(19);
    expect(actualSession.source).toBe("TASK_ACTUAL");

    const mastery = await request(app.getHttpServer()).get("/me/mastery").set("Cookie", studentCookie).expect(200);
    expect(mastery.body).toEqual([]);

    const thirdLesson = course.modules[0].lessons[2];
    const staleThirdTask = await prisma.task.findFirstOrThrow({
      where: { planId: planResponse.body.id, lessonId: thirdLesson.id },
    });
    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({
        degree: "MASTER",
        field: `phase16-field-${stamp}`,
        weeklyHours: 10,
        selfReportedLevel: "ADVANCED",
      })
      .expect(200);
    const replacement = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({ reasonCode: "GOAL_CHANGED" })
      .expect(201);
    expect(replacement.body.id).not.toBe(planResponse.body.id);
    expect(replacement.body.tasks.some((task: any) => task.lessonId === thirdLesson.id)).toBe(true);
    await request(app.getHttpServer())
      .post(`/me/plan/tasks/${staleThirdTask.id}/complete`)
      .set("Cookie", studentCookie)
      .send({ actualMinutes: 11 })
      .expect(400);
    const currentThirdTask = await prisma.task.findFirstOrThrow({
      where: { planId: replacement.body.id, lessonId: thirdLesson.id },
    });
    expect(currentThirdTask.status).toBe("PENDING");
    const history = await request(app.getHttpServer())
      .get("/me/study-history")
      .set("Cookie", studentCookie)
      .expect(200);
    const historicalPlan = history.body.plans.find((item: any) => item.id === planResponse.body.id);
    expect(historicalPlan.goalSnapshot).toMatchObject({
      field: `phase16-field-${stamp}`,
      weeklyHours: 6,
      selfReportedLevel: "BEGINNER",
    });
  });

  it("saves a published resource and turns it into a user-selected plan action", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const studentCookie = await login(randomPhone());
    const resource = await prisma.resource.create({
      data: {
        slug: `phase16-resource-${stamp}`,
        title: "منبع واقعی آزمون فاز شانزده",
        summary: "fixture for saved resources",
        kind: "VIDEO",
        accessMode: "PUBLIC",
        hostingMode: "METADATA_ONLY",
        contentBlocks: [{ type: "text", text: "resource" }],
        subjectCodes: [`phase16-resource-subject-${stamp}`],
        metadata: { estimatedMinutes: 25 },
        reviewStatus: "PUBLISHED",
        publishedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({ degree: "PHD", field: "computer-science", weeklyHours: 5, selfReportedLevel: "INTERMEDIATE" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/me/resources/saved")
      .set("Cookie", studentCookie)
      .send({ resourceSlug: resource.slug })
      .expect(201);
    const saved = await request(app.getHttpServer()).get("/me/resources/saved").set("Cookie", studentCookie).expect(200);
    expect(saved.body.items.some((item: any) => item.resource.slug === resource.slug)).toBe(true);

    const planned = await request(app.getHttpServer())
      .post(`/me/plan/resources/${resource.slug}`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(planned.body.tasks.some((task: any) => task.resource?.slug === resource.slug)).toBe(true);
    const resourceTasks = await prisma.task.findMany({ where: { resourceId: resource.id } });
    expect(resourceTasks).toHaveLength(1);
    expect(resourceTasks[0].reasonCode).toBe("USER_ADDED_RESOURCE");

    await request(app.getHttpServer())
      .post(`/me/plan/tasks/${resourceTasks[0].id}/complete`)
      .set("Cookie", studentCookie)
      .send({ actualMinutes: 23 })
      .expect(201);
    const completedSave = await prisma.savedResource.findFirstOrThrow({
      where: { resourceId: resource.id },
    });
    expect(completedSave.completedAt).not.toBeNull();

    const fresh = await request(app.getHttpServer())
      .post("/me/plan/replan")
      .set("Cookie", studentCookie)
      .send({ reasonCode: "GOAL_CHANGED" })
      .expect(201);
    expect(fresh.body.tasks.some((task: any) => task.resourceId === resource.id)).toBe(false);

    const explicitlyReadded = await request(app.getHttpServer())
      .post(`/me/plan/resources/${resource.slug}`)
      .set("Cookie", studentCookie)
      .expect(201);
    expect(explicitlyReadded.body.tasks.some((task: any) => task.resource?.slug === resource.slug)).toBe(true);
    const reopenedSave = await prisma.savedResource.findFirstOrThrow({
      where: { resourceId: resource.id },
    });
    expect(reopenedSave.completedAt).toBeNull();

    await request(app.getHttpServer())
      .delete("/me/resources/saved")
      .set("Cookie", studentCookie)
      .send({ resourceSlug: resource.slug })
      .expect(200);
    const afterRemoval = await request(app.getHttpServer()).get("/me/resources/saved").set("Cookie", studentCookie).expect(200);
    expect(afterRemoval.body.items.some((item: any) => item.resource.slug === resource.slug)).toBe(false);
  });

  it("paginates the complete cross-year study and plan history with independent opaque cursors", async () => {
    const phone = randomPhone();
    const studentCookie = await login(phone);
    await request(app.getHttpServer())
      .put("/me/goal")
      .set("Cookie", studentCookie)
      .send({
        degree: "PHD",
        field: "computer-science",
        weeklyHours: 8,
        selfReportedLevel: "INTERMEDIATE",
      })
      .expect(200);
    const student = await prisma.user.findUniqueOrThrow({ where: { phone } });
    const goal = await prisma.goal.findUniqueOrThrow({ where: { userId: student.id } });
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    await prisma.studySession.createMany({
      data: [0, 1, 2, 3, 4].map((index) => ({
        userId: student.id,
        subjectCode: `phase16-history-${stamp}-${index}`,
        minutes: 10 + index,
        loggedAt: new Date(Date.UTC(2020 + index, 0, 2)),
      })),
    });
    await prisma.plan.createMany({
      data: [0, 1, 2, 3, 4].map((index) => ({
        goalId: goal.id,
        userId: student.id,
        status: "ARCHIVED",
        version: index + 1,
        goalDegree: goal.degree,
        goalField: goal.field,
        goalWeeklyHours: goal.weeklyHours,
        goalTargetExamDate: goal.targetExamDate,
        goalSelfReportedLevel: goal.selfReportedLevel,
        createdAt: new Date(Date.UTC(2020 + index, 0, 1)),
      })),
    });

    const sessionIds = new Set<string>();
    let sessionsCursor: string | null = null;
    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      const query: Record<string, string | number> = { limit: 2, section: "sessions" };
      if (sessionsCursor) query.sessionsCursor = sessionsCursor;
      const page = await request(app.getHttpServer())
        .get("/me/study-history")
        .set("Cookie", studentCookie)
        .query(query)
        .expect(200);
      expect(page.body.plans).toEqual([]);
      for (const session of page.body.sessions) {
        expect(sessionIds.has(session.id)).toBe(false);
        sessionIds.add(session.id);
      }
      sessionsCursor = page.body.pagination.sessions.nextCursor;
      if (!sessionsCursor) break;
    }
    expect(sessionIds.size).toBe(5);
    expect(sessionsCursor).toBeNull();

    const planIds = new Set<string>();
    let plansCursor: string | null = null;
    for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      const query: Record<string, string | number> = { limit: 2, section: "plans" };
      if (plansCursor) query.plansCursor = plansCursor;
      const page = await request(app.getHttpServer())
        .get("/me/study-history")
        .set("Cookie", studentCookie)
        .query(query)
        .expect(200);
      expect(page.body.sessions).toEqual([]);
      for (const plan of page.body.plans) {
        expect(planIds.has(plan.id)).toBe(false);
        expect(plan.goalSnapshot.field).toBe("computer-science");
        planIds.add(plan.id);
      }
      plansCursor = page.body.pagination.plans.nextCursor;
      if (!plansCursor) break;
    }
    expect(planIds.size).toBe(5);
    expect(plansCursor).toBeNull();

    await request(app.getHttpServer())
      .get("/me/study-history")
      .set("Cookie", studentCookie)
      .query({ sessionsCursor: "not-a-valid-cursor" })
      .expect(400);
  });
});
