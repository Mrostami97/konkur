import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import {
  seed,
  SEED_ADMIN_PHONE,
  SEED_COURSE_SLUG,
  SEED_PRODUCT_SLUG,
  SEED_ARTICLE_SLUG,
} from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  const suffix = Math.floor(1_000_000 + Math.random() * 8_999_999);
  return `+9891${suffix}`;
}

describe("Register -> purchase -> access -> consume lesson (e2e)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;

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
    await seed();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    return { cookie: res.headers["set-cookie"][0] as string, user: res.body.user };
  }

  it("runs the full registration -> purchase -> access -> consumption path, and blocks unauthorized access", async () => {
    // 1. Portal: public catalog + syllabus are visible before login.
    const productsRes = await request(app.getHttpServer()).get("/products").expect(200);
    const product = productsRes.body.find((p: any) => p.slug === SEED_PRODUCT_SLUG);
    expect(product).toBeDefined();

    const syllabusRes = await request(app.getHttpServer())
      .get(`/courses/${SEED_COURSE_SLUG}`)
      .expect(200);
    const lessonId: string = syllabusRes.body.modules[0].lessons[0].id;
    expect(lessonId).toBeDefined();

    const articleRes = await request(app.getHttpServer())
      .get(`/articles/${SEED_ARTICLE_SLUG}`)
      .expect(200);
    expect(articleRes.body.reviewStatus).toBe("PUBLISHED");

    // 2. A brand-new user registers via OTP (Phase 0 flow, reused here).
    const phone = randomPhone();
    const { cookie } = await loginAs(phone);

    // 3. Unauthorized access is prevented: no entitlement yet -> lesson is gated.
    await request(app.getHttpServer()).get(`/lessons/${lessonId}`).set("Cookie", cookie).expect(403);

    // 4. Purchase: checkout against the sandbox payment provider.
    const checkoutRes = await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", cookie)
      .send({ productId: product.id })
      .expect(201);
    expect(checkoutRes.body.status).toBe("PAID");

    // 5. Access: entitlement + enrollment now exist.
    const entitlementsRes = await request(app.getHttpServer())
      .get("/me/entitlements")
      .set("Cookie", cookie)
      .expect(200);
    expect(entitlementsRes.body.some((e: any) => e.productId === product.id)).toBe(true);

    const enrollmentsRes = await request(app.getHttpServer())
      .get("/me/enrollments")
      .set("Cookie", cookie)
      .expect(200);
    expect(enrollmentsRes.body.some((e: any) => e.course.slug === SEED_COURSE_SLUG)).toBe(true);

    // 6. Consume: lesson content is now reachable and completable.
    const lessonRes = await request(app.getHttpServer())
      .get(`/lessons/${lessonId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(lessonRes.body.contentBlocks).toBeInstanceOf(Array);

    await request(app.getHttpServer())
      .post(`/lessons/${lessonId}/complete`)
      .set("Cookie", cookie)
      .expect(201);
  });

  it("prevents a second, unrelated student from accessing a lesson they never purchased", async () => {
    const syllabusRes = await request(app.getHttpServer())
      .get(`/courses/${SEED_COURSE_SLUG}`)
      .expect(200);
    const lessonId: string = syllabusRes.body.modules[0].lessons[0].id;

    const phone = randomPhone();
    const { cookie } = await loginAs(phone);
    await request(app.getHttpServer()).get(`/lessons/${lessonId}`).set("Cookie", cookie).expect(403);
  });

  it("admin can revoke an entitlement, which revokes the enrollment and re-blocks lesson access", async () => {
    const productsRes = await request(app.getHttpServer()).get("/products").expect(200);
    const product = productsRes.body.find((p: any) => p.slug === SEED_PRODUCT_SLUG);
    const syllabusRes = await request(app.getHttpServer())
      .get(`/courses/${SEED_COURSE_SLUG}`)
      .expect(200);
    const lessonId: string = syllabusRes.body.modules[0].lessons[0].id;

    const phone = randomPhone();
    const { cookie } = await loginAs(phone);
    await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", cookie)
      .send({ productId: product.id })
      .expect(201);
    await request(app.getHttpServer()).get(`/lessons/${lessonId}`).set("Cookie", cookie).expect(200);

    const entitlementsRes = await request(app.getHttpServer())
      .get("/me/entitlements")
      .set("Cookie", cookie)
      .expect(200);
    const entitlementId = entitlementsRes.body.find((e: any) => e.productId === product.id).id;

    const { cookie: adminCookie } = await loginAs(SEED_ADMIN_PHONE);
    await request(app.getHttpServer())
      .post(`/admin/entitlements/${entitlementId}/revoke`)
      .set("Cookie", adminCookie)
      .send({ reason: "test revocation" })
      .expect(201);

    await request(app.getHttpServer()).get(`/lessons/${lessonId}`).set("Cookie", cookie).expect(403);
  });

  it("admin content workflow: draft articles are invisible publicly until approved", async () => {
    const { cookie: adminCookie } = await loginAs(SEED_ADMIN_PHONE);
    const unique = Date.now();
    const sourceRes = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "workflow-source-" + unique,
        kind: "FIRST_PARTY_TEST",
        title: "Workflow source",
        publisher: "kunkur01",
        canonicalUrl: "https://kunkur01.ir/about/editorial-policy",
        sourceTier: "FIRST_PARTY",
        checkedAt: new Date().toISOString(),
        rightsBasis: "OWNED_BY_PUBLISHER",
        mayLink: true,
        mayAdapt: true,
      })
      .expect(201);

    const createRes = await request(app.getHttpServer())
      .post("/admin/articles")
      .set("Cookie", adminCookie)
      .send({
        slug: "draft-article-" + unique,
        title: "Draft article",
        summary: "not yet published",
        quickAnswer: "A concise answer backed by the attached source.",
        seoTitle: "Draft article for workflow testing",
        seoDescription: "A source-backed editorial workflow fixture for kunkur01.",
        contentBlocks: [{ type: "text", text: "..." }],
        taxonomyMajor: ["computer-engineering"],
        taxonomyTags: ["workflow"],
        taxonomyDegrees: ["MASTER"],
        taxonomyFields: ["computer-engineering"],
        sourceLinks: [{ sourceId: sourceRes.body.id, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    const articleId = createRes.body.id;
    const slug = createRes.body.slug;

    await request(app.getHttpServer()).get(`/articles/${slug}`).expect(404);

    await request(app.getHttpServer())
      .post(`/admin/articles/${articleId}/submit`)
      .set("Cookie", adminCookie)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/articles/${articleId}/approve`)
      .set("Cookie", adminCookie)
      .expect(201);

    const publicRes = await request(app.getHttpServer()).get(`/articles/${slug}`).expect(200);
    expect(publicRes.body.reviewStatus).toBe("PUBLISHED");
  });
});
