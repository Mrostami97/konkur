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
  return `+9893${suffix}`;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

describe("Instructors + paid consultations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;
  let instructorCookie: string;
  let outsiderCookie: string;

  let instructorProfileId: string;
  let instructorSlug: string;
  let courseId: string;

  const suffix = Date.now();

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return res.headers["set-cookie"][0] as string;
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
    studentCookie = await login(randomPhone());
    outsiderCookie = await login(randomPhone());

    // An instructor is a ContributorProfile linked to a real account.
    const instructorPhone = randomPhone();
    instructorCookie = await login(instructorPhone);
    const instructorUser = await prisma.user.findUniqueOrThrow({ where: { phone: instructorPhone } });

    instructorSlug = `taghavi-${suffix}`;
    const profile = await prisma.contributorProfile.create({
      data: {
        userId: instructorUser.id,
        slug: instructorSlug,
        displayName: "Test Instructor",
        roleTitle: "Logic Circuits",
        isPublished: true,
      },
    });
    instructorProfileId = profile.id;

    const course = await prisma.course.create({
      data: {
        slug: `logic-circuits-${suffix}`,
        title: "Logic Circuits",
        description: "Test course",
        isPublished: true,
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // --- instructor <-> course --------------------------------------------------

  it("refuses a revenue share above 100% across a course's instructors", async () => {
    await request(app.getHttpServer())
      .post(`/admin/courses/${courseId}/instructors`)
      .set("Cookie", adminCookie)
      .send({ contributorProfileId: instructorProfileId, revenueShareBp: 4000 })
      .expect(201);

    const second = await prisma.contributorProfile.create({
      data: { slug: `co-teacher-${suffix}`, displayName: "Co Teacher", isPublished: true },
    });

    await request(app.getHttpServer())
      .post(`/admin/courses/${courseId}/instructors`)
      .set("Cookie", adminCookie)
      .send({ contributorProfileId: second.id, revenueShareBp: 7000 })
      .expect(400);

    // The rejected write left the existing share untouched.
    const rows = await prisma.courseInstructor.findMany({ where: { courseId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].revenueShareBp).toBe(4000);
  });

  it("attributes a paid order to the instructor and applies their share", async () => {
    const product = await prisma.product.create({
      data: {
        slug: `logic-course-product-${suffix}`,
        title: "Logic Circuits course",
        description: "Test product",
        kind: "COURSE",
        courseId,
        prices: { create: [{ amountRial: 1_000_000, isActive: true }] },
      },
      include: { prices: true },
    });

    await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", studentCookie)
      .send({ productId: product.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get("/me/instructor/sales")
      .set("Cookie", instructorCookie)
      .expect(200);

    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0].courseId).toBe(courseId);
    expect(res.body.totals.grossRial).toBe(1_000_000);
    // 40% of the gross, and nothing rounded up.
    expect(res.body.totals.shareRial).toBe(400_000);
    expect(res.body.totals.students).toBe(1);
  });

  it("shows an instructor nothing but their own figures", async () => {
    await request(app.getHttpServer()).get("/me/instructor/sales").expect(401);

    // A signed-in account with no contributor profile is not an instructor,
    // whatever roles it holds.
    await request(app.getHttpServer())
      .get("/me/instructor/sales")
      .set("Cookie", outsiderCookie)
      .expect(403);

    // Sales figures are not a public endpoint, and a plain student cannot read
    // another person's through the admin path either.
    await request(app.getHttpServer())
      .get(`/admin/instructors/${instructorProfileId}/sales`)
      .set("Cookie", studentCookie)
      .expect(403);
  });

  it("puts the instructor's published courses on their public page", async () => {
    const res = await request(app.getHttpServer()).get(`/contributors/${instructorSlug}`).expect(200);
    expect(res.body.taughtCourses).toHaveLength(1);
    expect(res.body.taughtCourses[0].href).toBe(`/courses/logic-circuits-${suffix}`);
  });

  // --- paid consultation ------------------------------------------------------

  describe("booking a consultation", () => {
    let offeringId: string;
    let productId: string;

    it("creates an offering with its product and price in one step", async () => {
      const res = await request(app.getHttpServer())
        .post("/admin/consultations/offerings")
        .set("Cookie", adminCookie)
        .send({
          instructorProfileId,
          slug: `annual-consult-${suffix}`,
          kind: "PACKAGE",
          sessionQuota: 2,
          durationMinutes: 45,
          amountRial: 5_000_000,
          validUntil: inDays(200),
          headline: "Annual consultation until konkur",
          description: "Two planning sessions running to the exam date.",
        })
        .expect(201);

      offeringId = res.body.id;
      productId = res.body.productId;
      expect(res.body.product.prices[0].amountRial).toBe(5_000_000);

      const publicList = await request(app.getHttpServer())
        .get(`/consultations?instructor=${instructorSlug}`)
        .expect(200);
      expect(publicList.body).toHaveLength(1);
      expect(publicList.body[0].amountRial).toBe(5_000_000);
      // The public catalogue carries the price, never anyone's bookings.
      expect(publicList.body[0]).not.toHaveProperty("bookings");
    });

    it("refuses to book without having paid", async () => {
      await request(app.getHttpServer())
        .post("/me/consultations/bookings")
        .set("Cookie", studentCookie)
        .send({ offeringId, requestedSlots: [inDays(3)] })
        .expect(403);
    });

    it("carries the package deadline onto the entitlement at checkout", async () => {
      await request(app.getHttpServer())
        .post("/checkout")
        .set("Cookie", studentCookie)
        .send({ productId })
        .expect(201);

      const entitlement = await prisma.entitlement.findFirstOrThrow({
        where: { productId },
        orderBy: { createdAt: "desc" },
      });
      expect(entitlement.endAt).not.toBeNull();
    });

    it("spends the quota, refuses to overspend it, and returns it on cancel", async () => {
      const book = (slot: string) =>
        request(app.getHttpServer())
          .post("/me/consultations/bookings")
          .set("Cookie", studentCookie)
          .send({ offeringId, requestedSlots: [slot] });

      const first = await book(inDays(3)).expect(201);
      await book(inDays(4)).expect(201);

      // The package covered two sessions and both are spent.
      await book(inDays(5)).expect(400);

      const access = await request(app.getHttpServer())
        .get("/me/consultations/access")
        .set("Cookie", studentCookie)
        .expect(200);
      expect(access.body[0].sessionsRemaining).toBe(0);
      expect(access.body[0].isBookable).toBe(false);

      // A session called off was never delivered, so it comes back.
      await request(app.getHttpServer())
        .post(`/me/consultations/bookings/${first.body.id}/cancel`)
        .set("Cookie", studentCookie)
        .send({ reason: "clashes with an exam" })
        .expect(201);

      const afterCancel = await request(app.getHttpServer())
        .get("/me/consultations/access")
        .set("Cookie", studentCookie)
        .expect(200);
      expect(afterCancel.body[0].sessionsRemaining).toBe(1);

      await book(inDays(6)).expect(201);
    });

    it("keeps a booking between its two participants", async () => {
      const booking = await prisma.consultationBooking.findFirstOrThrow({
        where: { offeringId, status: "REQUESTED" },
      });

      // A third party is told the booking does not exist rather than that it
      // is not theirs.
      await request(app.getHttpServer())
        .post(`/me/consultations/bookings/${booking.id}/cancel`)
        .set("Cookie", outsiderCookie)
        .send({ reason: "not mine" })
        .expect(404);

      // ... and cannot schedule it either.
      await request(app.getHttpServer())
        .post(`/me/instructor/consultations/${booking.id}/confirm`)
        .set("Cookie", outsiderCookie)
        .send({ scheduledAt: inDays(7) })
        .expect(403);
    });

    it("lets the instructor schedule and close out their own sessions", async () => {
      const queue = await request(app.getHttpServer())
        .get("/me/instructor/consultations?status=REQUESTED")
        .set("Cookie", instructorCookie)
        .expect(200);
      expect(queue.body.length).toBeGreaterThan(0);
      // The queue is actionable: the instructor can reach the student.
      expect(queue.body[0].student.phone).toBeDefined();

      const bookingId = queue.body[0].id;

      const confirmed = await request(app.getHttpServer())
        .post(`/me/instructor/consultations/${bookingId}/confirm`)
        .set("Cookie", instructorCookie)
        .send({ scheduledAt: inDays(7), meetingUrl: "https://example.org/room/1" })
        .expect(201);
      expect(confirmed.body.status).toBe("CONFIRMED");

      const completed = await request(app.getHttpServer())
        .post(`/me/instructor/consultations/${bookingId}/complete`)
        .set("Cookie", instructorCookie)
        .send({ instructorNote: "covered the study plan" })
        .expect(201);
      expect(completed.body.status).toBe("COMPLETED");

      // A completed session is closed: it cannot be cancelled back open.
      await request(app.getHttpServer())
        .post(`/me/consultations/bookings/${bookingId}/cancel`)
        .set("Cookie", studentCookie)
        .send({ reason: "changed my mind" })
        .expect(400);
    });

    it("stops selling a consultation once its offering is switched off", async () => {
      await request(app.getHttpServer())
        .patch(`/admin/consultations/offerings/${offeringId}`)
        .set("Cookie", adminCookie)
        .send({
          headline: "Annual consultation until konkur",
          description: "Two planning sessions running to the exam date.",
          durationMinutes: 45,
          isActive: false,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post("/checkout")
        .set("Cookie", outsiderCookie)
        .send({ productId })
        .expect(404);

      const publicList = await request(app.getHttpServer())
        .get(`/consultations?instructor=${instructorSlug}`)
        .expect(200);
      expect(publicList.body).toHaveLength(0);
    });
  });
});
