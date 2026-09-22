import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import {
  SPOTPLAYER_CLIENT,
  type SpotPlayerClient,
  type SpotPlayerLicenseRequest,
} from "../src/modules/learning/spotplayer.client";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";
import { purchaseProduct } from "./helpers/purchase";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

/**
 * Stands in for SpotPlayer's HTTP API in tests only.
 *
 * The production module registers no stub on purpose -- one that invented a
 * key would hand a paying student something that opens nothing. Here it is
 * the point: it counts calls, so the tests can prove a licence is issued once
 * and reused rather than spending a seat per page load.
 */
class RecordingSpotPlayerClient implements SpotPlayerClient {
  readonly configured = true;
  public calls: SpotPlayerLicenseRequest[] = [];

  async createLicense(request: SpotPlayerLicenseRequest) {
    this.calls.push(request);
    const n = this.calls.length;
    return { licenseId: `lic-${n}`, key: `KEY-${n}`, url: `/license/download/lic-${n}` };
  }
}

function randomPhone(): string {
  return `+9892${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

describe("SpotPlayer video licences (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let spotPlayer: RecordingSpotPlayerClient;

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
    spotPlayer = new RecordingSpotPlayerClient();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otpProvider)
      .overrideProvider(SPOTPLAYER_CLIENT)
      .useValue(spotPlayer)
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

  it("refuses a licence to someone who has not bought the course", async () => {
    await request(app.getHttpServer())
      .post(`/courses/${videoCourseId}/video-license`)
      .set("Cookie", outsiderCookie)
      .expect(403);

    await request(app.getHttpServer()).post(`/courses/${videoCourseId}/video-license`).expect(401);

    // Nothing was requested from SpotPlayer for a refused caller: a seat is
    // spent per licence, so an unauthorised request must not cost one.
    expect(spotPlayer.calls).toHaveLength(0);
  });

  it("says a course has no video rather than issuing an empty licence", async () => {
    const status = await request(app.getHttpServer())
      .get(`/courses/${plainCourseId}/video`)
      .set("Cookie", buyerCookie)
      .expect(200);
    expect(status.body.hasVideo).toBe(false);

    await request(app.getHttpServer())
      .post(`/courses/${plainCourseId}/video-license`)
      .set("Cookie", buyerCookie)
      .expect(404);
    expect(spotPlayer.calls).toHaveLength(0);
  });

  it("issues one licence after purchase and reuses it on every later ask", async () => {
    await purchaseProduct(app, { buyerCookie, adminCookie, productId: videoProductId });

    const first = await request(app.getHttpServer())
      .post(`/courses/${videoCourseId}/video-license`)
      .set("Cookie", buyerCookie)
      .expect(201);

    expect(first.body.licenseKey).toBe("KEY-1");
    // SpotPlayer returns a relative path; the student needs something they
    // can actually open.
    expect(first.body.downloadUrl).toBe("https://panel.spotplayer.ir/license/download/lic-1");
    expect(spotPlayer.calls).toHaveLength(1);
    // The watermark is what traces a leaked recording back to a person.
    expect(spotPlayer.calls[0].watermark).toBe(buyerPhone);
    expect(spotPlayer.calls[0].courseIds).toEqual([`sp-${suffix}`]);

    const second = await request(app.getHttpServer())
      .post(`/courses/${videoCourseId}/video-license`)
      .set("Cookie", buyerCookie)
      .expect(201);

    expect(second.body.licenseKey).toBe("KEY-1");
    // A second seat was not spent.
    expect(spotPlayer.calls).toHaveLength(1);
  });

  it("stops handing out a stored licence once access is revoked", async () => {
    const entitlement = await prisma.entitlement.findFirstOrThrow({
      where: { productId: videoProductId },
      orderBy: { createdAt: "desc" },
    });
    await request(app.getHttpServer())
      .post(`/admin/entitlements/${entitlement.id}/revoke`)
      .set("Cookie", adminCookie)
      .send({ reason: "test revocation" })
      .expect(201);

    // The row still exists, but entitlement is rechecked on every request,
    // so a licence already issued is not a permanent key to the course.
    const stored = await prisma.spotPlayerLicense.findUnique({
      where: { userId_courseId: { userId: (await prisma.user.findUniqueOrThrow({ where: { phone: buyerPhone } })).id, courseId: videoCourseId } },
    });
    expect(stored).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/courses/${videoCourseId}/video-license`)
      .set("Cookie", buyerCookie)
      .expect(403);
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

  it("keeps course editing away from students", async () => {
    await request(app.getHttpServer())
      .patch(`/admin/courses/${plainCourseId}`)
      .set("Cookie", buyerCookie)
      .send({ slug: "hijack", title: "t", description: "d" })
      .expect(403);
  });
});
