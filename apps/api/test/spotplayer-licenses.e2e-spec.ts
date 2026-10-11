import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";
import { purchaseProduct } from "./helpers/purchase";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  return `+9892${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

describe("SpotPlayer video licences, issued by hand (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;

  let adminCookie: string;
  let buyerCookie: string;
  let buyerPhone: string;
  let outsiderCookie: string;

  let videoCourseId: string;
  let plainCourseId: string;
  let videoProductId: string;

  const suffix = Date.now();

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await seed();

    adminCookie = await login(SEED_ADMIN_PHONE);
    buyerPhone = randomPhone();
    buyerCookie = await login(buyerPhone);
    outsiderCookie = await login(randomPhone());

    const videoCourse = await prisma.course.create({
      data: {
        slug: `video-course-${suffix}`,
        title: "Course with video",
        description: "d",
        isPublished: true,
        spotPlayerCourseId: `sp-${suffix}`,
      },
    });
    videoCourseId = videoCourse.id;

    const plainCourse = await prisma.course.create({
      data: { slug: `plain-course-${suffix}`, title: "No video", description: "d", isPublished: true },
    });
    plainCourseId = plainCourse.id;

    const product = await prisma.product.create({
      data: {
        slug: `video-product-${suffix}`,
        title: "Course with video",
        description: "d",
        kind: "COURSE",
        courseId: videoCourseId,
        courseGrants: { create: [{ courseId: videoCourseId }] },
        prices: { create: [{ amountRial: 1_200_000, isActive: true }] },
      },
    });
    videoProductId = product.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses a request from someone who has not bought the course", async () => {
    await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).set("Cookie", outsiderCookie).expect(403);
    await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).expect(401);
    const status = await request(app.getHttpServer()).get(`/courses/${videoCourseId}/video`).set("Cookie", outsiderCookie).expect(200);
    expect(status.body).toMatchObject({ hasVideo: true, hasAccess: false, license: null });
    expect(await prisma.videoLicenseRequest.count({ where: { courseId: videoCourseId } })).toBe(0);
  });

  it("says a course has no video rather than taking a request", async () => {
    const status = await request(app.getHttpServer()).get(`/courses/${plainCourseId}/video`).set("Cookie", buyerCookie).expect(200);
    expect(status.body.hasVideo).toBe(false);
    await request(app.getHttpServer()).post(`/courses/${plainCourseId}/video-license`).set("Cookie", buyerCookie).expect(404);
  });

  it("puts a buyer's request in the panel, and shows the key once the owner records it", async () => {
    await purchaseProduct(app, { buyerCookie, adminCookie, productId: videoProductId });

    const asked = await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).set("Cookie", buyerCookie).expect(201);
    expect(asked.body).toMatchObject({ hasAccess: true, request: { status: "PENDING" }, license: null });
    // Asking twice is still one request.
    await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).set("Cookie", buyerCookie).expect(201);

    const pending = await request(app.getHttpServer()).get("/admin/video-licenses").set("Cookie", adminCookie).expect(200);
    const row = pending.body.find((entry: { user: { phone: string } }) => entry.user.phone === buyerPhone);
    expect(row.requests).toHaveLength(1);
    expect(row.licenseKey).toBeNull();

    // Students never see the queue or record keys.
    await request(app.getHttpServer()).get("/admin/video-licenses").set("Cookie", buyerCookie).expect(403);
    await request(app.getHttpServer()).post(`/admin/video-licenses/${row.user.id}`).set("Cookie", buyerCookie).send({ licenseKey: "x" }).expect(403);

    const issued = await request(app.getHttpServer()).post(`/admin/video-licenses/${row.user.id}`).set("Cookie", adminCookie).send({ licenseKey: " KEY-ALL-COURSES " }).expect(201);
    expect(issued.body).toMatchObject({ licenseKey: "KEY-ALL-COURSES", closedRequests: 1 });

    const status = await request(app.getHttpServer()).get(`/courses/${videoCourseId}/video`).set("Cookie", buyerCookie).expect(200);
    expect(status.body.request.status).toBe("DONE");
    expect(status.body.license.licenseKey).toBe("KEY-ALL-COURSES");

    const after = await request(app.getHttpServer()).get("/admin/video-licenses").set("Cookie", adminCookie).expect(200);
    expect(after.body.some((entry: { user: { phone: string } }) => entry.user.phone === buyerPhone)).toBe(false);
    const done = await request(app.getHttpServer()).get("/admin/video-licenses?status=DONE").set("Cookie", adminCookie).expect(200);
    expect(done.body.find((entry: { user: { phone: string } }) => entry.user.phone === buyerPhone).licenseKey).toBe("KEY-ALL-COURSES");
  });

  it("stops showing the key once access is revoked", async () => {
    const entitlement = await prisma.entitlement.findFirstOrThrow({ where: { productId: videoProductId }, orderBy: { createdAt: "desc" } });
    await request(app.getHttpServer())
      .post(`/admin/entitlements/${entitlement.id}/revoke`)
      .set("Cookie", adminCookie)
      .send({ reason: "test revocation" })
      .expect(201);
    const status = await request(app.getHttpServer()).get(`/courses/${videoCourseId}/video`).set("Cookie", buyerCookie).expect(200);
    expect(status.body).toMatchObject({ hasAccess: false, license: null });
    await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).set("Cookie", buyerCookie).expect(403);
  });

  it("lets an operator attach a SpotPlayer course id to an existing course", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/courses/${plainCourseId}`)
      .set("Cookie", adminCookie)
      .send({
        slug: `plain-course-${suffix}`,
        title: "No video",
        description: "d",
        spotPlayerCourseId: `sp-added-${suffix}`,
      })
      .expect(200);
    expect(res.body.spotPlayerCourseId).toBe(`sp-added-${suffix}`);

    const status = await request(app.getHttpServer())
      .get(`/courses/${plainCourseId}/video`)
      .set("Cookie", buyerCookie)
      .expect(200);
    expect(status.body.hasVideo).toBe(true);
  });

  it("lets an operator state a course's length, shown on the catalogue and the syllabus", async () => {
    const slug = `plain-course-${suffix}`;
    const base = { slug, title: "No video", description: "d", spotPlayerCourseId: `sp-added-${suffix}` };
    const set = await request(app.getHttpServer()).patch(`/admin/courses/${plainCourseId}`).set("Cookie", adminCookie).send({ ...base, durationMinutes: 2550 }).expect(200);
    expect(set.body.durationMinutes).toBe(2550);

    const catalogue = await request(app.getHttpServer()).get("/courses").expect(200);
    expect(catalogue.body.find((row: { slug: string }) => row.slug === slug).durationMinutes).toBe(2550);
    expect((await request(app.getHttpServer()).get(`/courses/${slug}`).expect(200)).body.durationMinutes).toBe(2550);

    // Leaving it out keeps it; null clears it; nonsense is refused.
    expect((await request(app.getHttpServer()).patch(`/admin/courses/${plainCourseId}`).set("Cookie", adminCookie).send(base).expect(200)).body.durationMinutes).toBe(2550);
    expect((await request(app.getHttpServer()).patch(`/admin/courses/${plainCourseId}`).set("Cookie", adminCookie).send({ ...base, durationMinutes: null }).expect(200)).body.durationMinutes).toBeNull();
    await request(app.getHttpServer()).patch(`/admin/courses/${plainCourseId}`).set("Cookie", adminCookie).send({ ...base, durationMinutes: -5 }).expect(400);
  });

  it("keeps course editing away from students", async () => {
    await request(app.getHttpServer())
      .patch(`/admin/courses/${plainCourseId}`)
      .set("Cookie", buyerCookie)
      .send({ slug: "hijack", title: "t", description: "d" })
      .expect(403);
  });
});
