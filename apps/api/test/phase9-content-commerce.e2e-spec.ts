import "reflect-metadata";
import { createHash } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Degree, Prisma, ReviewStatus, Role } from "@prisma/client";
import { Test } from "@nestjs/testing";
import AdmZip from "adm-zip";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";
import { seedStaticEditorial } from "../src/seed-static-editorial";
import staticEditorialSeed from "../src/seed-data/editorial-drafts.json";

class CapturingOtpProvider implements OtpProvider {
  sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
}

function buildImportZip(payload: unknown) {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(payload)));
  return zip.toBuffer();
}

describe("Phase 9 content, learning access and commerce (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ObjectStorageService;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;
  let studentId: string;
  let paidCourseId: string;
  let paidLessonId: string;
  let paidResourceId: string;
  let paidResourceSlug: string;
  let artifactChecksum: string;
  let courseProductId: string;
  let resourceProductId: string;
  let bundleProductId: string;
  let sourceId: string;
  let sourceExternalId: string;
  let suffix: string;

  beforeAll(async () => {
    suffix = Date.now().toString() + "-" + Math.floor(Math.random() * 100000).toString();
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
    storage = app.get(ObjectStorageService);
    await seed();

    adminCookie = (await login(SEED_ADMIN_PHONE)).cookie;
    const student = await login(randomPhone());
    studentCookie = student.cookie;
    studentId = student.user.id;

    const paidCourse = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({
        slug: "phase9-paid-course-" + suffix,
        title: "Phase 9 paid course",
        description: "Entitlement-gated fixture",
        accessMode: "ENTITLEMENT",
        degreeTargets: ["MASTER"],
        fieldTargets: ["computer-engineering"],
      })
      .expect(201);
    paidCourseId = paidCourse.body.id;
    const paidModule = await request(app.getHttpServer())
      .post("/admin/courses/" + paidCourseId + "/modules")
      .set("Cookie", adminCookie)
      .send({ title: "Paid module", order: 1 })
      .expect(201);
    const paidLesson = await request(app.getHttpServer())
      .post("/admin/modules/" + paidModule.body.id + "/lessons")
      .set("Cookie", adminCookie)
      .send({ title: "Paid lesson", order: 1, contentBlocks: [{ type: "text", text: "Protected lesson" }] })
      .expect(201);
    paidLessonId = paidLesson.body.id;
    await request(app.getHttpServer())
      .post("/admin/modules/" + paidModule.body.id + "/lessons")
      .set("Cookie", adminCookie)
      .send({ title: "Preview lesson", order: 2, isPreview: true, contentBlocks: [{ type: "text", text: "Preview" }] })
      .expect(201);
    await request(app.getHttpServer())
      .post("/admin/courses/" + paidCourseId + "/publish")
      .set("Cookie", adminCookie)
      .expect(201);

    sourceExternalId = "phase9-owned-source-" + suffix;
    const source = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: sourceExternalId,
        kind: "FIRST_PARTY_FILE",
        title: "Owned resource source",
        publisher: "kunkur01",
        canonicalUrl: "https://kunkur01.ir/resources",
        sourceTier: "FIRST_PARTY",
        checkedAt: new Date().toISOString(),
        rightsHolder: "kunkur01",
        rightsBasis: "USER_DECLARATION",
        mayLink: true,
        mayHost: true,
        mayReproduce: true,
        commercialUseAllowed: true,
      })
      .expect(201);
    sourceId = source.body.id;

    const bytes = Buffer.from("phase-9-protected-note");
    artifactChecksum = createHash("sha256").update(bytes).digest("hex");
    const storageKey = artifactChecksum + "/phase9-note.pdf";
    await storage.putObject(storageKey, bytes, "application/pdf");
    const artifact = await prisma.sourceArtifact.upsert({
      where: { checksum: "sha256:" + artifactChecksum },
      update: {},
      create: {
        checksum: "sha256:" + artifactChecksum,
        filename: "phase9-note.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
        storageKey,
      },
    });

    paidResourceSlug = "phase9-paid-note-" + suffix;
    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "phase9-paid-note-external-" + suffix,
        slug: paidResourceSlug,
        title: "Phase 9 protected note",
        summary: "A paid note fixture",
        kind: "NOTE",
        accessMode: "ENTITLEMENT",
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
        taxonomyDegrees: ["MASTER"],
        taxonomyFields: ["computer-engineering"],
        sources: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    paidResourceId = resource.body.id;
    await request(app.getHttpServer()).post("/admin/resources/" + paidResourceId + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/resources/" + paidResourceId + "/approve").set("Cookie", adminCookie).expect(201);

    const courseProduct = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: "phase9-course-product-" + suffix,
        title: "Course access",
        description: "Single course access",
        kind: "COURSE",
        courseIds: [paidCourseId],
      })
      .expect(201);
    courseProductId = courseProduct.body.id;
    await request(app.getHttpServer())
      .post("/admin/products/" + courseProductId + "/prices")
      .set("Cookie", adminCookie)
      .send({ amountRial: 100000 })
      .expect(201);

    const resourceProduct = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: "phase9-resource-product-" + suffix,
        title: "Note access",
        description: "Standalone note access",
        kind: "RESOURCE",
        resourceIds: [paidResourceId],
      })
      .expect(201);
    resourceProductId = resourceProduct.body.id;
    await request(app.getHttpServer())
      .post("/admin/products/" + resourceProductId + "/prices")
      .set("Cookie", adminCookie)
      .send({ amountRial: 60000 })
      .expect(201);

    const bundle = await request(app.getHttpServer())
      .post("/admin/products")
      .set("Cookie", adminCookie)
      .send({
        slug: "phase9-bundle-product-" + suffix,
        title: "Course and note bundle",
        description: "Bundle fixture",
        kind: "BUNDLE",
        courseIds: [paidCourseId],
        resourceIds: [paidResourceId],
      })
      .expect(201);
    bundleProductId = bundle.body.id;
    await request(app.getHttpServer())
      .post("/admin/products/" + bundleProductId + "/prices")
      .set("Cookie", adminCookie)
      .send({ amountRial: 150000 })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent[otp.sent.length - 1].code;
    const response = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return { cookie: response.headers["set-cookie"][0] as string, user: response.body.user };
  }

  function randomPhone() {
    return "+9893" + Math.floor(10000000 + Math.random() * 89999999).toString();
  }

  async function grant(userId: string, productId: string, dates?: { startAt?: string; endAt?: string }) {
    return request(app.getHttpServer())
      .post("/admin/entitlements/grant")
      .set("Cookie", adminCookie)
      .send({
        userId,
        productId,
        grantedVia: "MANUAL",
        reason: "phase 9 e2e",
        ...dates,
      })
      .expect(201);
  }

  it("supports anonymous PUBLIC learning, account progress and paid previews", async () => {
    const publicCourse = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: "phase9-public-" + suffix, title: "Public", description: "Public", accessMode: "PUBLIC" })
      .expect(201);
    const publicModule = await request(app.getHttpServer())
      .post("/admin/courses/" + publicCourse.body.id + "/modules")
      .set("Cookie", adminCookie)
      .send({ title: "Public module", order: 1 })
      .expect(201);
    const publicLesson = await request(app.getHttpServer())
      .post("/admin/modules/" + publicModule.body.id + "/lessons")
      .set("Cookie", adminCookie)
      .send({ title: "Public lesson", order: 1, contentBlocks: [{ type: "text", text: "Free" }] })
      .expect(201);
    await request(app.getHttpServer()).get("/lessons/" + publicLesson.body.id).expect(404);
    await request(app.getHttpServer())
      .post("/lessons/" + publicLesson.body.id + "/complete")
      .set("Cookie", studentCookie)
      .expect(404);
    await request(app.getHttpServer()).post("/admin/courses/" + publicCourse.body.id + "/publish").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/lessons/" + publicLesson.body.id).expect(200);
    await request(app.getHttpServer()).post("/lessons/" + publicLesson.body.id + "/complete").expect(401);
    await request(app.getHttpServer()).get("/lessons/" + publicLesson.body.id).set("Cookie", studentCookie).expect(200);
    expect(await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: studentId, lessonId: publicLesson.body.id } } })).not.toBeNull();

    const accountCourse = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: "phase9-account-" + suffix, title: "Account", description: "Account", accessMode: "ACCOUNT" })
      .expect(201);
    const accountModule = await request(app.getHttpServer())
      .post("/admin/courses/" + accountCourse.body.id + "/modules")
      .set("Cookie", adminCookie)
      .send({ title: "Account module", order: 1 })
      .expect(201);
    const accountLesson = await request(app.getHttpServer())
      .post("/admin/modules/" + accountModule.body.id + "/lessons")
      .set("Cookie", adminCookie)
      .send({ title: "Account lesson", order: 1, contentBlocks: [{ type: "text", text: "Account free" }] })
      .expect(201);
    await request(app.getHttpServer()).post("/admin/courses/" + accountCourse.body.id + "/publish").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/lessons/" + accountLesson.body.id).expect(401);
    await request(app.getHttpServer()).get("/lessons/" + accountLesson.body.id).set("Cookie", studentCookie).expect(200);

    const hiddenCourse = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: "phase9-hidden-" + suffix, title: "Hidden", description: "Unpublished", accessMode: "ENTITLEMENT" })
      .expect(201);
    const hiddenModule = await request(app.getHttpServer())
      .post("/admin/courses/" + hiddenCourse.body.id + "/modules")
      .set("Cookie", adminCookie)
      .send({ title: "Hidden module", order: 1 })
      .expect(201);
    const hiddenPreview = await request(app.getHttpServer())
      .post("/admin/modules/" + hiddenModule.body.id + "/lessons")
      .set("Cookie", adminCookie)
      .send({ title: "Hidden preview", order: 1, isPreview: true, contentBlocks: [{ type: "text", text: "Not published" }] })
      .expect(201);
    await request(app.getHttpServer()).get("/lessons/" + hiddenPreview.body.id).expect(404);

    const syllabus = await request(app.getHttpServer()).get("/courses/phase9-paid-course-" + suffix).expect(200);
    const previewId = syllabus.body.modules[0].lessons.find((lesson: { isPreview: boolean }) => lesson.isPreview).id;
    await request(app.getHttpServer()).get("/lessons/" + previewId).expect(200);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).expect(401);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", studentCookie).expect(403);
  });

  it("checks out standalone resource and bundle products with their exact grants", async () => {
    const resourceBuyer = await login(randomPhone());
    await request(app.getHttpServer())
      .get("/resources/" + paidResourceSlug + "/content")
      .set("Cookie", resourceBuyer.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", resourceBuyer.cookie)
      .send({ productId: resourceProductId })
      .expect(201)
      .expect((response) => expect(response.body.status).toBe("PAID"));
    await request(app.getHttpServer())
      .get("/resources/" + paidResourceSlug + "/content")
      .set("Cookie", resourceBuyer.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get("/lessons/" + paidLessonId)
      .set("Cookie", resourceBuyer.cookie)
      .expect(403);

    const bundleBuyer = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", bundleBuyer.cookie)
      .send({ productId: bundleProductId })
      .expect(201)
      .expect((response) => expect(response.body.status).toBe("PAID"));
    await request(app.getHttpServer())
      .get("/resources/" + paidResourceSlug + "/content")
      .set("Cookie", bundleBuyer.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get("/lessons/" + paidLessonId)
      .set("Cookie", bundleBuyer.cookie)
      .expect(200);
    const library = await request(app.getHttpServer())
      .get("/me/library")
      .set("Cookie", bundleBuyer.cookie)
      .expect(200);
    expect(library.body.courses.some((item: { id: string }) => item.id === paidCourseId)).toBe(true);
    expect(library.body.resources.some((item: { id: string }) => item.id === paidResourceId)).toBe(true);
  });

  it("honors future, expired, active and revoked entitlements for a bundle", async () => {
    const future = await grant(studentId, bundleProductId, { startAt: new Date(Date.now() + 3600000).toISOString() });
    const expired = await grant(studentId, bundleProductId, {
      startAt: new Date(Date.now() - 7200000).toISOString(),
      endAt: new Date(Date.now() - 3600000).toISOString(),
    });
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", studentCookie).expect(403);

    const active = await grant(studentId, bundleProductId);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", studentCookie).expect(200);
    const entitlements = await request(app.getHttpServer()).get("/me/entitlements").set("Cookie", studentCookie).expect(200);
    expect(entitlements.body.find((item: { id: string }) => item.id === future.body.id).status).toBe("SCHEDULED");
    expect(entitlements.body.find((item: { id: string }) => item.id === expired.body.id).status).toBe("EXPIRED");
    expect(entitlements.body.find((item: { id: string }) => item.id === active.body.id).status).toBe("ACTIVE");

    const library = await request(app.getHttpServer()).get("/me/library").set("Cookie", studentCookie).expect(200);
    expect(library.body.courses.some((item: { id: string }) => item.id === paidCourseId)).toBe(true);
    expect(library.body.resources.some((item: { id: string }) => item.id === paidResourceId)).toBe(true);

    await request(app.getHttpServer())
      .post("/admin/entitlements/" + active.body.id + "/revoke")
      .set("Cookie", adminCookie)
      .send({ reason: "phase 9 revoke" })
      .expect(201);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", studentCookie).expect(403);
  });

  it("keeps alternate grants active and treats entitlement, not catalog activity, as access truth", async () => {
    const second = await login(randomPhone());
    const bundleGrant = await grant(second.user.id, bundleProductId);
    const courseGrant = await grant(second.user.id, courseProductId);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", second.cookie).expect(200);
    await request(app.getHttpServer())
      .post("/admin/entitlements/" + bundleGrant.body.id + "/revoke")
      .set("Cookie", adminCookie)
      .send({ reason: "alternate grant remains" })
      .expect(201);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", second.cookie).expect(200);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").set("Cookie", second.cookie).expect(403);

    await prisma.product.update({ where: { id: courseProductId }, data: { isActive: false } });
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", second.cookie).expect(200);
    await request(app.getHttpServer())
      .post("/admin/entitlements/" + courseGrant.body.id + "/revoke")
      .set("Cookie", adminCookie)
      .send({ reason: "all grants removed" })
      .expect(201);
    await request(app.getHttpServer()).get("/lessons/" + paidLessonId).set("Cookie", second.cookie).expect(403);
  });

  it("serves paid notes inline after authorization without exposing storage identifiers", async () => {
    const third = await login(randomPhone());
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").expect(401);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").set("Cookie", third.cookie).expect(403);
    const entitlement = await grant(third.user.id, bundleProductId);

    const metadata = await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).set("Cookie", third.cookie).expect(200);
    expect(metadata.body.canAccess).toBe(true);
    expect(metadata.body).not.toHaveProperty("sourceArtifactId");
    expect(metadata.body).not.toHaveProperty("storageKey");
    expect(metadata.body).not.toHaveProperty("contentBlocks");
    const content = await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").set("Cookie", third.cookie).expect(200);
    expect(content.headers["content-disposition"]).toContain("inline");
    expect(content.headers["cache-control"]).toContain("no-store");
    await request(app.getHttpServer()).get("/media/" + artifactChecksum).expect(404);

    await request(app.getHttpServer())
      .post("/admin/entitlements/" + entitlement.body.id + "/revoke")
      .set("Cookie", adminCookie)
      .send({ reason: "resource test complete" })
      .expect(201);
  });

  it("never exposes an account-gated resource through the raw media route", async () => {
    const bytes = Buffer.from("phase-9-account-resource-" + suffix);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const storageKey = checksum + "/account-note.pdf";
    await storage.putObject(storageKey, bytes, "application/pdf");
    const artifact = await prisma.sourceArtifact.create({
      data: {
        checksum: "sha256:" + checksum,
        filename: "account-note.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
        storageKey,
      },
    });
    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "phase9-account-resource-" + suffix,
        slug: "phase9-account-resource-" + suffix,
        title: "Account resource",
        summary: "Requires a signed-in account",
        kind: "NOTE",
        accessMode: "ACCOUNT",
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
        sources: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).post("/admin/resources/" + resource.body.id + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/resources/" + resource.body.id + "/approve").set("Cookie", adminCookie).expect(201);

    await request(app.getHttpServer()).get("/resources/" + resource.body.slug + "/content").expect(401);
    const publicMetadata = await request(app.getHttpServer()).get("/resources/" + resource.body.slug).set("Cookie", studentCookie).expect(200);
    expect(publicMetadata.body).not.toHaveProperty("sourceArtifactId");
    expect(publicMetadata.body.sources[0]).not.toHaveProperty("id");
    expect(publicMetadata.body.sources[0]).not.toHaveProperty("resourceId");
    expect(publicMetadata.body.sources[0]).not.toHaveProperty("sourceId");
    expect(publicMetadata.body.sources[0].source).not.toHaveProperty("id");
    await request(app.getHttpServer()).get("/resources/" + resource.body.slug + "/content").set("Cookie", studentCookie).expect(200);
    await request(app.getHttpServer()).get("/media/" + checksum).expect(404);
  });

  it("never exposes a public resource artifact through the raw checksum route", async () => {
    const bytes = Buffer.from("phase-9-draft-public-resource-" + suffix);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const storageKey = checksum + "/public-note.pdf";
    await storage.putObject(storageKey, bytes, "application/pdf");
    const artifact = await prisma.sourceArtifact.create({
      data: {
        checksum: "sha256:" + checksum,
        filename: "public-note.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
        storageKey,
      },
    });
    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "phase9-draft-public-resource-" + suffix,
        slug: "phase9-draft-public-resource-" + suffix,
        title: "Draft public resource",
        summary: "Must stay private until approved",
        kind: "NOTE",
        accessMode: "PUBLIC",
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
        sources: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).get("/media/" + checksum).expect(404);
    await request(app.getHttpServer()).post("/admin/resources/" + resource.body.id + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/media/" + checksum).expect(404);
    await request(app.getHttpServer()).post("/admin/resources/" + resource.body.id + "/approve").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/media/" + checksum).expect(404);
  });

  it("keeps the published paid resource live throughout a rejected revision", async () => {
    const learner = await login(randomPhone());
    await grant(learner.user.id, bundleProductId);
    const original = await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).expect(200);
    const initialApprovalAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "resource.approved", targetType: "Resource", targetId: paidResourceId },
      orderBy: { createdAt: "asc" },
    });
    expect((initialApprovalAudit.metadata as { selfReviewed: boolean }).selfReviewed).toBe(true);

    const revision = await request(app.getHttpServer())
      .post("/admin/resources/" + paidResourceId + "/revise")
      .set("Cookie", adminCookie)
      .expect(201);
    expect(revision.body).toMatchObject({ version: 2, reviewStatus: "DRAFT" });
    await request(app.getHttpServer())
      .patch("/admin/resources/" + paidResourceId)
      .set("Cookie", adminCookie)
      .send({ title: "Pending resource title" })
      .expect(200);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).expect(200).expect((response) => {
      expect(response.body.title).toBe(original.body.title);
    });
    await request(app.getHttpServer()).get("/products").expect(200).expect((response) => {
      expect(response.body.some((product: { id: string }) => product.id === bundleProductId)).toBe(true);
    });
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").set("Cookie", learner.cookie).expect(200);

    await request(app.getHttpServer()).post("/admin/resources/" + paidResourceId + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).expect(200).expect((response) => {
      expect(response.body.title).toBe(original.body.title);
    });
    await request(app.getHttpServer())
      .post("/admin/resources/" + paidResourceId + "/reject")
      .set("Cookie", adminCookie)
      .send({ reason: "Needs another edit" })
      .expect(201);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).expect(200).expect((response) => {
      expect(response.body.title).toBe(original.body.title);
    });
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug + "/content").set("Cookie", learner.cookie).expect(200);
    await request(app.getHttpServer()).get("/products").expect(200).expect((response) => {
      expect(response.body.some((product: { id: string }) => product.id === bundleProductId)).toBe(true);
    });

    await request(app.getHttpServer())
      .patch("/admin/resources/" + paidResourceId)
      .set("Cookie", adminCookie)
      .send({ title: "Approved resource title" })
      .expect(200);
    await request(app.getHttpServer()).post("/admin/resources/" + paidResourceId + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/resources/" + paidResourceId + "/approve").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/resources/" + paidResourceSlug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Approved resource title");
    });
  });

  it("refuses to publish paid material without explicit commercial-use permission", async () => {
    const source = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "phase9-noncommercial-source-" + suffix,
        kind: "FIRST_PARTY_FILE",
        title: "Non-commercial fixture",
        publisher: "Fixture publisher",
        canonicalUrl: "https://example.test/non-commercial",
        sourceTier: "PRIMARY",
        checkedAt: new Date().toISOString(),
        rightsHolder: "Fixture publisher",
        rightsBasis: "USER_DECLARATION",
        mayLink: true,
        mayHost: true,
        mayReproduce: true,
        commercialUseAllowed: false,
      })
      .expect(201);
    const bytes = Buffer.from("phase-9-noncommercial-" + suffix);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const artifact = await prisma.sourceArtifact.create({
      data: {
        checksum: "sha256:" + checksum,
        filename: "noncommercial.pdf",
        mimeType: "application/pdf",
        size: bytes.length,
        storageKey: checksum + "/noncommercial.pdf",
      },
    });
    const resource = await request(app.getHttpServer())
      .post("/admin/resources")
      .set("Cookie", adminCookie)
      .send({
        externalId: "phase9-noncommercial-resource-" + suffix,
        slug: "phase9-noncommercial-resource-" + suffix,
        title: "Non-commercial paid material",
        summary: "Must not be sold",
        kind: "NOTE",
        accessMode: "ENTITLEMENT",
        hostingMode: "USER_UPLOAD",
        sourceArtifactId: artifact.id,
        sources: [{ sourceId: source.body.id, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/admin/resources/" + resource.body.id + "/submit")
      .set("Cookie", adminCookie)
      .expect(400);
    await request(app.getHttpServer()).get("/resources/" + resource.body.slug).expect(404);
  });

  it("keeps the recorded import reviewer distinct from the publishing administrator", async () => {
    const reviewer = await login(randomPhone());
    await prisma.userRole.create({ data: { userId: reviewer.user.id, role: Role.REVIEWER } });
    const reviewerProfile = await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({
        userId: reviewer.user.id,
        kind: "PERSON",
        slug: "phase9-reviewer-" + suffix,
        displayName: "Phase 9 reviewer",
        roleTitle: "Reviewer",
        isPublished: true,
      })
      .expect(201);
    const externalId = "phase9-imported-v2-" + suffix;
    const payload = {
      schema_version: "article.v2",
      external_id: externalId,
      content_type: "article",
      title: "Imported article with separate reviewer",
      slug: externalId,
      summary: "Verifies that publication never overwrites the recorded reviewer.",
      quick_answer: "The reviewer and publisher remain separate audit actors.",
      content_blocks: [{ type: "text", text: "Source-backed imported content." }],
      taxonomy: {
        major: ["computer-engineering"],
        tags: ["phase9"],
        degrees: ["master"],
        fields: ["computer-engineering"],
        subject_codes: [],
        topic_codes: [],
      },
      seo: {
        title: "Imported Phase 9 reviewer attribution",
        description: "A test article verifying separate reviewer and publisher attribution in the editorial import pipeline.",
      },
      validity: { time_sensitive: false },
      sources: [{ source_external_id: sourceExternalId, relation: "SUPPORTS", order: 0 }],
      provenance: { producer_type: "human", source_artifact: "phase9-import-reviewer-test" },
      review_status: "draft",
    };
    const job = await request(app.getHttpServer())
      .post("/admin/import")
      .set("Cookie", reviewer.cookie)
      .attach("file", buildImportZip(payload), "phase9-article-v2.zip")
      .expect(201);
    const items = await request(app.getHttpServer())
      .get("/admin/import/" + job.body.id + "/items")
      .set("Cookie", reviewer.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", reviewer.cookie)
      .send({ itemIds: [items.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/admin/import/" + job.body.id + "/publish")
      .set("Cookie", adminCookie)
      .expect(201);

    const article = await prisma.article.findUniqueOrThrow({ where: { externalId } });
    const version = await prisma.contentVersion.findUniqueOrThrow({
      where: { entityType_entityId_version: { entityType: "ARTICLE", entityId: article.id, version: 1 } },
    });
    expect(article.reviewerProfileId).toBe(reviewerProfile.body.id);
    expect(version.reviewedByUserId).toBe(reviewer.user.id);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "import.published", targetType: "ARTICLE", targetId: article.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.actorUserId).not.toBe(reviewer.user.id);
    expect((audit.metadata as { publisherUserId: string; reviewedByUserId: string }).reviewedByUserId).toBe(reviewer.user.id);
    const publicArticle = await request(app.getHttpServer()).get("/articles/" + externalId).expect(200);
    expect(publicArticle.body.reviewerProfile).toMatchObject({ slug: reviewerProfile.body.slug });
  });

  it("records an honest article self-review even without an attribution profile", async () => {
    const slug = "phase9-self-reviewed-" + suffix;
    const article = await request(app.getHttpServer())
      .post("/admin/articles")
      .set("Cookie", adminCookie)
      .send({
        slug,
        title: "Profile-free self review",
        summary: "Checks audit truth independently of optional public attribution.",
        quickAnswer: "The version creator and reviewer are the same administrator.",
        contentBlocks: [{ type: "text", text: "Editorial audit test." }],
        taxonomyMajor: ["computer-engineering"],
        taxonomyTags: ["phase9"],
        taxonomyDegrees: ["MASTER"],
        taxonomyFields: ["computer-engineering"],
        seoTitle: "Profile-free article self-review audit",
        seoDescription: "A regression fixture for honest self-review logging without a contributor attribution profile.",
        sourceLinks: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).post("/admin/articles/" + article.body.id + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/articles/" + article.body.id + "/approve").set("Cookie", adminCookie).expect(201);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "article.approved", targetType: "Article", targetId: article.body.id },
      orderBy: { createdAt: "desc" },
    });
    expect((audit.metadata as { selfReviewed: boolean }).selfReviewed).toBe(true);
    const publicArticle = await request(app.getHttpServer()).get("/articles/" + slug).expect(200);
    expect(publicArticle.body.authorProfile).toBeNull();
  });

  it("publishes article.v2 revisions atomically and turns rollback into a new draft", async () => {
    const contributors = await request(app.getHttpServer()).get("/admin/contributors").set("Cookie", adminCookie).expect(200);
    const author = contributors.body.find((item: { slug: string }) => item.slug === "mohammad-rostami");
    expect(author.isPublished).toBe(false);
    const slug = "phase9-versioned-article-" + suffix;
    const created = await request(app.getHttpServer())
      .post("/admin/articles")
      .set("Cookie", adminCookie)
      .send({
        slug,
        title: "Original title",
        summary: "Versioned article summary",
        quickAnswer: "Original quick answer",
        contentBlocks: [{ type: "text", text: "Original content" }],
        taxonomyMajor: ["computer-engineering"],
        taxonomyTags: ["phase9"],
        taxonomyDegrees: ["MASTER"],
        taxonomyFields: ["computer-engineering"],
        seoTitle: "Original versioned article",
        seoDescription: "A source-backed article used to verify the Phase 9 editorial workflow.",
        authorProfileId: author.id,
        sourceLinks: [{ sourceId, relation: "SUPPORTS", order: 0 }],
      })
      .expect(201);
    await request(app.getHttpServer()).get("/articles/" + slug).expect(404);
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/approve").set("Cookie", adminCookie).expect(201);
    const firstPublic = await request(app.getHttpServer()).get("/articles/" + slug).expect(200);
    expect(firstPublic.body.title).toBe("Original title");
    expect(firstPublic.body.authorProfile).toBeNull();
    expect(firstPublic.body.reviewerProfile).toBeNull();
    expect(firstPublic.body).not.toHaveProperty("authorId");
    expect(firstPublic.body).not.toHaveProperty("authorProfileId");
    expect(firstPublic.body).not.toHaveProperty("reviewerProfileId");
    expect(firstPublic.body).not.toHaveProperty("provenance");
    expect(firstPublic.body.sources[0]).not.toHaveProperty("id");
    expect(firstPublic.body.sources[0]).not.toHaveProperty("articleId");
    expect(firstPublic.body.sources[0]).not.toHaveProperty("sourceId");
    expect(firstPublic.body.sources[0].source).not.toHaveProperty("id");
    expect(firstPublic.body.sources[0].source).not.toHaveProperty("externalId");

    const revision = await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/revise").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/revise").set("Cookie", adminCookie).expect(403);
    await request(app.getHttpServer())
      .post("/admin/content/rollback")
      .set("Cookie", adminCookie)
      .send({ entityType: "ARTICLE", entityId: created.body.id, toVersion: 1 })
      .expect(403);
    const revisedPayload = { ...revision.body.payload, title: "Revised title", review_status: "draft" };
    await request(app.getHttpServer())
      .patch("/admin/articles/" + created.body.id + "/versions/" + revision.body.version)
      .set("Cookie", adminCookie)
      .send(revisedPayload)
      .expect(200);
    await request(app.getHttpServer()).get("/articles/" + slug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Original title");
    });
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/versions/2/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/articles/" + slug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Original title");
    });
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/versions/2/approve").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/articles/" + slug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Revised title");
    });

    const rollback = await request(app.getHttpServer())
      .post("/admin/content/rollback")
      .set("Cookie", adminCookie)
      .send({ entityType: "ARTICLE", entityId: created.body.id, toVersion: 1 })
      .expect(201);
    expect(rollback.body).toMatchObject({ newVersion: 3, pendingReview: true });
    await request(app.getHttpServer()).get("/articles/" + slug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Revised title");
    });
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/versions/3/submit").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post("/admin/articles/" + created.body.id + "/versions/3/approve").set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get("/articles/" + slug).expect(200).expect((response) => {
      expect(response.body.title).toBe("Original title");
    });

    await request(app.getHttpServer()).get("/admin/articles").set("Cookie", studentCookie).expect(403);
  });

  it("defaults report-card publication consent to false", async () => {
    const report = await prisma.reportCard.create({
      data: {
        externalId: "phase9-report-" + suffix,
        anonymousId: "anonymous-phase9",
        examYear: 1405,
        degree: Degree.MASTER,
        field: "computer-engineering",
        quota: "open",
        subjectScores: [
          { subject_code: "algorithms", percent: 50 },
          { subject_code: "data-structures", percent: 50 },
        ],
        rank: { value: 100, scope: "quota" },
        admissions: [],
        provenance: { producer_type: "human", source_artifact: "phase9-e2e" },
      },
    });
    expect(report.publicConsent).toBe(false);
  });

  it("seeds every static editorial page as an idempotent article.v2 draft", async () => {
    const migrated = await prisma.article.findMany({
      where: { externalId: { startsWith: "static-editorial-" } },
      select: {
        id: true,
        slug: true,
        reviewStatus: true,
      },
    });
    expect(migrated).toHaveLength(staticEditorialSeed.articles.length);
    expect(new Set(migrated.map((article) => article.slug)).size).toBe(staticEditorialSeed.articles.length);
    const phase13Payloads = staticEditorialSeed.articles.filter((article) =>
      article.provenance.source_artifact.startsWith("apps/web/src/content/phase13-corpus.json:"),
    );
    expect(phase13Payloads).toHaveLength(14);
    expect(phase13Payloads.filter((article) => article.content_type === "guide")).toHaveLength(8);
    expect(phase13Payloads.filter((article) => article.content_type === "case_study")).toHaveLength(6);
    const phase13Slugs = new Set(phase13Payloads.map((article) => article.slug));
    expect(migrated.filter((article) => phase13Slugs.has(article.slug))).toHaveLength(14);
    for (const article of migrated) {
      expect(article.reviewStatus).toBe("DRAFT");
      const revision = await prisma.contentVersion.findUnique({
        where: {
          entityType_entityId_version: {
            entityType: "ARTICLE",
            entityId: article.id,
            version: 1,
          },
        },
      });
      expect(revision).toMatchObject({ schemaVersion: "article.v2", reviewStatus: "DRAFT" });
    }
  });

  it("never overwrites editorial changes when static drafts are reseeded", async () => {
    const statuses = [
      ReviewStatus.DRAFT,
      ReviewStatus.IN_REVIEW,
      ReviewStatus.REJECTED,
      ReviewStatus.PUBLISHED,
    ];
    const articles = await prisma.article.findMany({
      where: { externalId: { startsWith: "static-editorial-" } },
      orderBy: { slug: "asc" },
      take: statuses.length,
    });
    expect(articles).toHaveLength(statuses.length);

    const fixtures = await Promise.all(articles.map(async (article, index) => {
      const version = await prisma.contentVersion.findUniqueOrThrow({
        where: {
          entityType_entityId_version: {
            entityType: "ARTICLE",
            entityId: article.id,
            version: article.version,
          },
        },
      });
      return {
        article,
        version,
        changedTitle: `Human editorial change ${statuses[index]!}`,
        changedStatus: statuses[index]!,
      };
    }));

    try {
      for (const fixture of fixtures) {
        await prisma.article.update({
          where: { id: fixture.article.id },
          data: { title: fixture.changedTitle, reviewStatus: fixture.changedStatus },
        });
        await prisma.contentVersion.update({
          where: { id: fixture.version.id },
          data: {
            reviewStatus: fixture.changedStatus,
            payload: {
              ...(fixture.version.payload as Prisma.JsonObject),
              title: fixture.changedTitle,
            } as Prisma.InputJsonValue,
          },
        });
      }

      await seedStaticEditorial(prisma);

      for (const fixture of fixtures) {
        const after = await prisma.article.findUniqueOrThrow({ where: { id: fixture.article.id } });
        const version = await prisma.contentVersion.findUniqueOrThrow({ where: { id: fixture.version.id } });
        expect(after).toMatchObject({
          title: fixture.changedTitle,
          reviewStatus: fixture.changedStatus,
        });
        expect(version.reviewStatus).toBe(fixture.changedStatus);
        expect((version.payload as Prisma.JsonObject).title).toBe(fixture.changedTitle);
      }
    } finally {
      for (const fixture of fixtures) {
        await prisma.article.update({
          where: { id: fixture.article.id },
          data: { title: fixture.article.title, reviewStatus: fixture.article.reviewStatus },
        });
        await prisma.contentVersion.update({
          where: { id: fixture.version.id },
          data: {
            reviewStatus: fixture.version.reviewStatus,
            payload: fixture.version.payload as Prisma.InputJsonValue,
          },
        });
      }
    }
  });
});
