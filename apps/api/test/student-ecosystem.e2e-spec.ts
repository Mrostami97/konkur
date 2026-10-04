import "reflect-metadata";
// These tests rank a five-person exam; the site itself waits for 30.
process.env.EXAM_RANK_MIN_PARTICIPANTS = "5";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { konkurPercent, standingOf } from "../src/modules/assessment/assessment.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  return `+9897${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

const PROFILE = {
  firstName: "مریم",
  lastName: "احمدی",
  educationStatus: "BACHELOR_STUDENT",
  universityName: "دانشگاه تهران",
  fieldOfStudy: "مهندسی کامپیوتر",
  targetDegree: "MASTER",
  targetField: "computer-engineering",
};

/** A Monday-to-Sunday week well in the future, so "today" never matters. */
const WEEK = { startsOn: "2030-01-05", endsOn: "2030-01-11" };

describe("Student ecosystem: consultant plans, exam standing, recommendations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const suffix = `${Date.now()}`;

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  async function userIdOf(cookie: string): Promise<string> {
    const me = await request(app.getHttpServer()).get("/auth/me").set("Cookie", cookie).expect(200);
    return me.body.user.id;
  }

  async function student() {
    const phone = randomPhone();
    const cookie = await login(phone);
    await request(app.getHttpServer()).patch("/me/profile").set("Cookie", cookie).send(PROFILE).expect(200);
    return { cookie, userId: await userIdOf(cookie) };
  }

  /** An instructor account with a consultation offering. */
  async function coach(tag: string) {
    const phone = randomPhone();
    const cookie = await login(phone);
    const profile = await prisma.contributorProfile.create({
      data: { userId: await userIdOf(cookie), slug: `coach-${tag}-${suffix}`, displayName: `Coach ${tag}`, isPublished: true },
    });
    const product = await prisma.product.create({
      data: { slug: `consult-${tag}-${suffix}`, title: "Consultation", description: "…", kind: "CONSULTATION" },
    });
    const offering = await prisma.consultationOffering.create({
      data: { instructorProfileId: profile.id, productId: product.id, kind: "PACKAGE", headline: "Package", description: "…" },
    });
    return { cookie, profileId: profile.id, productId: product.id, offeringId: offering.id };
  }

  async function book(coachInfo: Awaited<ReturnType<typeof coach>>, studentUserId: string) {
    const entitlement = await prisma.entitlement.create({
      data: { userId: studentUserId, productId: coachInfo.productId, grantedVia: "MANUAL" },
    });
    await prisma.consultationBooking.create({
      data: {
        offeringId: coachInfo.offeringId,
        entitlementId: entitlement.id,
        studentUserId,
        instructorProfileId: coachInfo.profileId,
        durationMinutes: 45,
      },
    });
  }

  const planBody = (overrides: Record<string, unknown> = {}) => ({
    title: "برنامهٔ هفتهٔ اول",
    ...WEEK,
    note: "روی ساختمان داده تمرکز کن.",
    items: [
      { day: "2030-01-05", kind: "STUDY", title: "درخت AVL از جزوه", subjectSlug: "data-structures", targetMinutes: 90 },
      { day: "2030-01-06", kind: "TEST", title: "۴۰ تست درخت", targetCount: 40, href: "/questions?subject=ds" },
    ],
    ...overrides,
  });

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
    adminCookie = await login(SEED_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app.close();
  });

  // --- consultant plans --------------------------------------------------------

  it("lets a consultant plan only for students who booked them", async () => {
    const mine = await coach("a");
    const other = await coach("b");
    const advised = await student();
    const stranger = await student();
    await book(mine, advised.userId);

    const list = await request(app.getHttpServer()).get("/me/instructor/students").set("Cookie", mine.cookie).expect(200);
    expect(list.body.map((row: { student: { id: string } }) => row.student.id)).toEqual([advised.userId]);
    expect(list.body[0].student.profile.firstName).toBe("مریم");

    // Not booked by this student: indistinguishable from a student that does not exist.
    await request(app.getHttpServer())
      .post(`/me/instructor/students/${stranger.userId}/plans`)
      .set("Cookie", mine.cookie)
      .send(planBody())
      .expect(404);
    await request(app.getHttpServer())
      .post(`/me/instructor/students/${advised.userId}/plans`)
      .set("Cookie", other.cookie)
      .send(planBody())
      .expect(404);
    // A student is not a consultant at all.
    await request(app.getHttpServer()).get("/me/instructor/students").set("Cookie", advised.cookie).expect(403);
  });

  it("refuses tasks outside the plan's dates, spans over a month and outside links", async () => {
    const mine = await coach("c");
    const advised = await student();
    await book(mine, advised.userId);
    const url = `/me/instructor/students/${advised.userId}/plans`;
    await request(app.getHttpServer())
      .post(url)
      .set("Cookie", mine.cookie)
      .send(planBody({ items: [{ day: "2030-02-01", kind: "STUDY", title: "خارج از بازه" }] }))
      .expect(400);
    await request(app.getHttpServer()).post(url).set("Cookie", mine.cookie).send(planBody({ endsOn: "2030-03-01" })).expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set("Cookie", mine.cookie)
      .send(planBody({ items: [{ day: "2030-01-05", kind: "VIDEO", title: "لینک", href: "https://evil.example/x" }] }))
      .expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set("Cookie", mine.cookie)
      .send(planBody({ items: [{ day: "2030-01-05", kind: "VIDEO", title: "لینک", href: "//evil.example/x" }] }))
      .expect(400);
  });

  it("shows a plan to the student only once published, and keeps ticked tasks through edits", async () => {
    const mine = await coach("d");
    const advised = await student();
    const stranger = await student();
    await book(mine, advised.userId);

    const created = await request(app.getHttpServer())
      .post(`/me/instructor/students/${advised.userId}/plans`)
      .set("Cookie", mine.cookie)
      .send(planBody())
      .expect(201);
    expect(created.body.status).toBe("DRAFT");
    const draftView = await request(app.getHttpServer()).get("/me/coach-plans").set("Cookie", advised.cookie).expect(200);
    expect(draftView.body.plans).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/me/instructor/plans/${created.body.id}/publish`)
      .set("Cookie", mine.cookie)
      .expect(201);
    const view = await request(app.getHttpServer()).get("/me/coach-plans").set("Cookie", advised.cookie).expect(200);
    expect(view.body.plans).toHaveLength(1);
    expect(view.body.plans[0].coach.displayName).toBe("Coach d");
    const [first, second] = view.body.plans[0].items;

    // Someone else's task is not theirs to tick.
    await request(app.getHttpServer())
      .post(`/me/coach-plans/items/${first.id}/complete`)
      .set("Cookie", stranger.cookie)
      .send({ actualMinutes: 80 })
      .expect(404);
    const done = await request(app.getHttpServer())
      .post(`/me/coach-plans/items/${first.id}/complete`)
      .set("Cookie", advised.cookie)
      .send({ actualMinutes: 80, studentNote: "تمام شد" })
      .expect(201);
    expect(done.body.completedAt).not.toBeNull();

    // The consultant edits: renames the ticked task, drops the other, adds one.
    const edited = await request(app.getHttpServer())
      .put(`/me/instructor/plans/${created.body.id}`)
      .set("Cookie", mine.cookie)
      .send(
        planBody({
          items: [
            { id: first.id, day: "2030-01-05", kind: "STUDY", title: "درخت AVL و B-tree", targetMinutes: 90 },
            { day: "2030-01-07", kind: "REVIEW", title: "مرور" },
          ],
        }),
      )
      .expect(200);
    expect(edited.body.items).toHaveLength(2);
    const kept = edited.body.items.find((item: { id: string }) => item.id === first.id);
    expect(kept.title).toBe("درخت AVL و B-tree");
    expect(kept.completedAt).not.toBeNull();
    expect(kept.actualMinutes).toBe(80);
    expect(await prisma.coachPlanItem.findUnique({ where: { id: second.id } })).toBeNull();

    // A task from another plan cannot be smuggled into this one.
    await request(app.getHttpServer())
      .put(`/me/instructor/plans/${created.body.id}`)
      .set("Cookie", mine.cookie)
      .send(planBody({ items: [{ id: "00000000-0000-4000-8000-000000000000", day: "2030-01-05", kind: "STUDY", title: "x y" }] }))
      .expect(400);

    // Published plans are archived, not deleted.
    await request(app.getHttpServer()).delete(`/me/instructor/plans/${created.body.id}`).set("Cookie", mine.cookie).expect(400);
    await request(app.getHttpServer()).post(`/me/instructor/plans/${created.body.id}/archive`).set("Cookie", mine.cookie).expect(201);
    const archived = await request(app.getHttpServer()).get("/me/coach-plans").set("Cookie", advised.cookie).expect(200);
    expect(archived.body.plans).toHaveLength(0);
  });

  // --- exam standing -------------------------------------------------------------

  it("ranks on the konkur percentage, where wrong answers cost a third", () => {
    expect(konkurPercent({ correctCount: 3, wrongCount: 3, unansweredCount: 0 })).toBeCloseTo(33.33, 1);
    expect(konkurPercent({ correctCount: 0, wrongCount: 3, unansweredCount: 0 })).toBeCloseTo(-33.33, 1);

    const population = [
      { attemptId: "a1", userId: "u1", percent: 80 },
      { attemptId: "a2", userId: "u2", percent: 60 },
      { attemptId: "a3", userId: "u3", percent: 60 },
      { attemptId: "a4", userId: "u4", percent: 40 },
      { attemptId: "a5", userId: "u5", percent: 20 },
    ];
    const tied = standingOf(population, "u3", "a3", 60);
    expect(tied).toMatchObject({ participants: 5, rank: 2, percentile: 50, isOfficial: true });
    expect(tied.taraz).toBeGreaterThan(5000);
    // A retake is placed among the others without counting the student twice.
    const retake = standingOf(population, "u5", "a9", 90);
    expect(retake).toMatchObject({ participants: 5, rank: 1, isOfficial: false });
    // Too few participants: no rank, no standard score, no distribution.
    const small = standingOf(population.slice(0, 3), "u1", "a1", 80);
    expect(small).toMatchObject({ rank: null, percentile: null, taraz: null, distribution: [] });
  });

  it("gives each student their rank in an exam, and nothing about anyone else", async () => {
    const stamp = `${suffix}-rank`;
    const externalId = `rank-q-${stamp}`;
    const job = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send({
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: `rank-subject-${stamp}`,
        topic_codes: ["t1"],
        stem_blocks: [{ type: "text", text: "stem" }],
        options: [1, 2, 3, 4].map((number) => ({ number, blocks: [{ type: "text", text: String(number) }] })),
        correct_option: 2,
        solution_blocks: [{ type: "text", text: "solution" }],
      })
      .expect(201);
    const items = await request(app.getHttpServer()).get(`/admin/import/${job.body.id}/items`).set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [items.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/import/${job.body.id}/publish`).set("Cookie", adminCookie).expect(201);
    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });
    const exam = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug: `rank-exam-${stamp}`, title: "Mock exam", description: "…", mode: "STATIC", durationMinutes: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/exams/${exam.body.id}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: question.id, order: 0 })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/exams/${exam.body.id}/publish`).set("Cookie", adminCookie).expect(201);

    // Five students: two answer right, one wrong, two leave it blank.
    const answers = [2, 2, 1, null, null];
    const attempts: { cookie: string; attemptId: string }[] = [];
    for (const answer of answers) {
      const who = await student();
      const started = await request(app.getHttpServer()).post(`/exams/${exam.body.id}/start`).set("Cookie", who.cookie).expect(201);
      if (answer !== null) {
        await request(app.getHttpServer())
          .put(`/attempts/${started.body.id}/answers/${question.id}`)
          .set("Cookie", who.cookie)
          .send({ selectedOption: answer })
          .expect(200);
      }
      await request(app.getHttpServer()).post(`/attempts/${started.body.id}/submit`).set("Cookie", who.cookie).expect(201);
      attempts.push({ cookie: who.cookie, attemptId: started.body.id });
    }

    const top = await request(app.getHttpServer())
      .get(`/attempts/${attempts[0].attemptId}/standing`)
      .set("Cookie", attempts[0].cookie)
      .expect(200);
    expect(top.body).toMatchObject({ participants: 5, rank: 1, konkurPercent: 100 });
    const wrong = await request(app.getHttpServer())
      .get(`/attempts/${attempts[2].attemptId}/standing`)
      .set("Cookie", attempts[2].cookie)
      .expect(200);
    // A wrong answer (-33%) ranks below leaving it blank (0%).
    expect(wrong.body.rank).toBe(5);
    expect(JSON.stringify(top.body)).not.toMatch(/userId|attemptId|phone/);

    // Another student's attempt is a 404, not a peek.
    await request(app.getHttpServer())
      .get(`/attempts/${attempts[0].attemptId}/standing`)
      .set("Cookie", attempts[1].cookie)
      .expect(404);

    const mine = await request(app.getHttpServer()).get("/me/attempts").set("Cookie", attempts[3].cookie).expect(200);
    expect(mine.body[0].standing).toMatchObject({ rank: 3, participants: 5, konkurPercent: 0 });
  });

  // --- recommendations and library ----------------------------------------------

  it("recommends the paid course that covers a student's weak topic, and never one they own", async () => {
    const who = await student();
    const subject = await prisma.subject.create({
      data: { code: `rec-subj-${suffix}`, title: "ساختمان داده آزمایشی", slug: `rec-subj-${suffix}` },
    });
    const weakTopic = await prisma.topic.create({
      data: { code: `rec-topic-${suffix}`, title: "درخت AVL", slug: `rec-topic-${suffix}`, subjectId: subject.id },
    });

    async function paidCourse(tag: string, topicId?: string) {
      const course = await prisma.course.create({
        data: {
          slug: `rec-${tag}-${suffix}`,
          title: `Course ${tag}`,
          description: "…",
          isPublished: true,
          accessMode: "ENTITLEMENT",
          modules: {
            create: {
              title: "M",
              order: 0,
              lessons: {
                create: {
                  title: "L",
                  order: 0,
                  contentBlocks: [],
                  ...(topicId ? { topics: { create: { topicId } } } : {}),
                },
              },
            },
          },
        },
      });
      const product = await prisma.product.create({
        data: { slug: `rec-${tag}-${suffix}`, title: `Course ${tag}`, description: "…", kind: "COURSE", courseId: course.id, prices: { create: { amountRial: 5_000_000 } } },
      });
      return { course, product };
    }

    const covering = await paidCourse("covering", weakTopic.id);
    const owned = await paidCourse("owned", weakTopic.id);
    await paidCourse("unrelated");
    await prisma.entitlement.create({ data: { userId: who.userId, productId: owned.product.id, grantedVia: "GIFT" } });
    await prisma.masteryState.create({
      data: {
        userId: who.userId,
        subjectCode: subject.code,
        topicCode: weakTopic.code,
        masteryScore: 0.2,
        confidence: "LOW",
        evidenceCount: 3,
        ruleVersion: "test",
      },
    });

    const res = await request(app.getHttpServer()).get("/me/recommendations/courses").set("Cookie", who.cookie).expect(200);
    expect(res.body[0].course.slug).toBe(covering.course.slug);
    expect(res.body[0].basis).toBe("WEAK_TOPICS");
    expect(res.body[0].reasons[0]).toContain("درخت AVL");
    expect(res.body[0].price.amountRial).toBe(5_000_000);
    expect(res.body.some((row: { course: { slug: string } }) => row.course.slug === owned.course.slug)).toBe(false);
  });

  it("lists a bought handout in the library with what the dashboard needs, newest first", async () => {
    const who = await student();
    const resource = await prisma.resource.create({
      data: {
        slug: `handout-${suffix}`,
        title: "جزوهٔ ساختمان داده",
        summary: "خلاصهٔ درخت‌ها",
        kind: "PDF",
        accessMode: "ENTITLEMENT",
        hostingMode: "METADATA_ONLY",
        contentBlocks: [],
        reviewStatus: "PUBLISHED",
        publishedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    const product = await prisma.product.create({
      data: {
        slug: `handout-${suffix}`,
        title: "جزوه",
        description: "…",
        kind: "BUNDLE",
        resourceGrants: { create: { resourceId: resource.id } },
      },
    });
    await prisma.entitlement.create({ data: { userId: who.userId, productId: product.id, grantedVia: "ORDER" } });

    const library = await request(app.getHttpServer()).get("/me/library").set("Cookie", who.cookie).expect(200);
    expect(library.body.resources[0]).toMatchObject({
      slug: resource.slug,
      title: "جزوهٔ ساختمان داده",
      summary: "خلاصهٔ درخت‌ها",
      kind: "PDF",
    });
    expect(library.body.resources[0].acquiredAt).toBeTruthy();
  });
});
