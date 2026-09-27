import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { weekStartOf } from "../src/modules/instructors/weekly-reports.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { PrismaService } from "../src/prisma/prisma.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";
import { purchaseProduct } from "./helpers/purchase";

class CapturingOtpProvider implements OtpProvider {
  sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
}

/** The annual consultation plan: the consultation alone, and a weekly report the consultant reviews. */
describe("Annual consultation plan (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  let suffix: string;

  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otp)
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

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent.at(-1)!.code;
    const response = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return response.headers["set-cookie"][0] as string;
  }

  async function signUp() {
    const phone = `0917${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const cookie = await login(phone);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    return { cookie, id: user.id };
  }

  it("sells the consultation alone, with a weekly report the consultant can answer", async () => {
    // The consultant: an account linked to an instructor profile.
    const consultant = await signUp();
    const profile = await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({ userId: consultant.id, slug: `consultant-${suffix}`, displayName: "Consultant", isPublished: true })
      .expect(201);

    // A paid course: the plan does not include it (owner decision); it is bought separately.
    const course = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `annual-course-${suffix}`, title: "Paid course", description: "Opened by the annual plan." })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/courses/${course.body.id}/publish`).set("Cookie", adminCookie).expect(201);

    const offering = await request(app.getHttpServer())
      .post("/admin/consultations/offerings")
      .set("Cookie", adminCookie)
      .send({
        instructorProfileId: profile.body.id,
        slug: `annual-plan-${suffix}`,
        kind: "PACKAGE",
        sessionQuota: 40,
        durationMinutes: 45,
        amountRial: 150_000_000,
        headline: "Annual plan",
        description: "Weekly sessions, a weekly plan and weekly report reviews.",
      })
      .expect(201);
    const catalogue = await request(app.getHttpServer()).get(`/consultations?instructor=consultant-${suffix}`).expect(200);
    expect(catalogue.body[0]).toMatchObject({ kind: "PACKAGE", amountRial: 150_000_000 });
    expect(catalogue.body[0]).not.toHaveProperty("includesAllAccess");

    const student = await signUp();
    await purchaseProduct(app, { buyerCookie: student.cookie, adminCookie, productId: offering.body.productId });

    // Courses, handouts and the bank stay separate purchases.
    const library = await request(app.getHttpServer()).get("/me/library").set("Cookie", student.cookie).expect(200);
    expect(library.body).not.toHaveProperty("allAccess");
    expect(library.body.courses.map((row: { id: string }) => row.id)).not.toContain(course.body.id);
    expect(library.body.questionBankSubjects).toEqual([]);

    // The consultant sees the buyer before any session is booked.
    const students = await request(app.getHttpServer()).get("/me/instructor/students").set("Cookie", consultant.cookie).expect(200);
    expect(students.body.map((row: { student: { id: string } }) => row.student.id)).toContain(student.id);

    // The week's report: a draft first, then sent.
    const empty = await request(app.getHttpServer()).get("/me/weekly-reports").set("Cookie", student.cookie).expect(200);
    expect(new Date(empty.body.currentWeekStart).getTime()).toBe(weekStartOf(new Date()).getTime());
    expect(empty.body.weeks).toHaveLength(12);
    expect(empty.body.weeks[0].report).toBeNull();

    await request(app.getHttpServer())
      .put("/me/weekly-reports/current")
      .set("Cookie", student.cookie)
      .send({ testsSolved: 120, submit: true })
      .expect(400);
    const sent = await request(app.getHttpServer())
      .put("/me/weekly-reports/current")
      .set("Cookie", student.cookie)
      .send({ testsSolved: 120, energy: 4, wentWell: "Finished graphs", obstacles: "Dynamic programming", questions: "More DP?", submit: true })
      .expect(200);
    expect(sent.body.submittedAt).toBeTruthy();

    // Another consultant cannot read it; theirs can, and answers.
    const stranger = await signUp();
    await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({ userId: stranger.id, slug: `stranger-${suffix}`, displayName: "Stranger" })
      .expect(201);
    await request(app.getHttpServer()).get(`/me/instructor/students/${student.id}/weekly-reports`).set("Cookie", stranger.cookie).expect(404);
    await request(app.getHttpServer()).put(`/me/instructor/weekly-reports/${sent.body.id}/review`).set("Cookie", stranger.cookie).send({ coachNote: "No" }).expect(404);

    const seen = await request(app.getHttpServer()).get(`/me/instructor/students/${student.id}/weekly-reports`).set("Cookie", consultant.cookie).expect(200);
    expect(seen.body[0].report).toMatchObject({ testsSolved: 120, obstacles: "Dynamic programming" });
    await request(app.getHttpServer())
      .put(`/me/instructor/weekly-reports/${sent.body.id}/review`)
      .set("Cookie", consultant.cookie)
      .send({ coachNote: "Two DP sets this week." })
      .expect(200);
    const answered = await request(app.getHttpServer()).get("/me/weekly-reports").set("Cookie", student.cookie).expect(200);
    expect(answered.body.weeks[0].report).toMatchObject({ coachNote: "Two DP sets this week.", reviewedBy: { displayName: "Consultant" } });
  });

  it("starts weeks on Saturday in Tehran time", () => {
    // Friday 23:00 Tehran (19:30 UTC) is still the week that began the Saturday before.
    expect(weekStartOf(new Date("2026-10-02T19:30:00Z")).toISOString().slice(0, 10)).toBe("2026-09-26");
    // Saturday 00:30 Tehran (Friday 21:00 UTC) starts a new week.
    expect(weekStartOf(new Date("2026-10-02T21:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-03");
  });
});
