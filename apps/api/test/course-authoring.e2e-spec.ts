import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";
import { videoSource } from "../src/modules/learning/course-authoring.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

/** Object storage is not part of this test; an in-memory store stands in. */
class MemoryStorage {
  objects = new Map<string, Buffer>();
  async putObject(key: string, buffer: Buffer) {
    this.objects.set(key, buffer);
  }
  async objectExists(key: string) {
    return this.objects.has(key);
  }
  async removeObject(key: string) {
    this.objects.delete(key);
  }
  async presignedGetUrl(key: string) {
    return `https://storage.test/${key}`;
  }
  async onModuleInit() {}
}

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

function randomPhone(): string {
  return `+9893${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

describe("Course authoring (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  const suffix = Date.now();

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent[otp.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return { cookie: res.headers["set-cookie"][0] as string, userId: res.body.user.id as string };
  }

  async function newCourse(accessMode: "PUBLIC" | "ENTITLEMENT" = "ENTITLEMENT") {
    const slug = `authoring-${accessMode.toLowerCase()}-${suffix}-${Math.floor(Math.random() * 1e6)}`;
    const course = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug, title: "Authoring course", description: "d", accessMode })
      .expect(201);
    const module = await request(app.getHttpServer())
      .post(`/admin/courses/${course.body.id}/modules`)
      .set("Cookie", adminCookie)
      .send({ title: "Module A", order: 1 })
      .expect(201);
    return { courseId: course.body.id as string, slug, moduleId: module.body.id as string };
  }

  async function addLesson(moduleId: string, title: string, extra: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({ title, contentBlocks: [{ type: "text", text: `${title} body` }], ...extra })
      .expect(201);
    return res.body as { id: string; order: number };
  }

  beforeAll(async () => {
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otp)
      .overrideProvider(ObjectStorageService)
      .useValue(new MemoryStorage())
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await seed();
    adminCookie = (await login(SEED_ADMIN_PHONE)).cookie;
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts only Aparat pages and https video files as video sources", () => {
    expect(videoSource("https://www.aparat.com/v/abc123XY")).toEqual({ kind: "aparat", hash: "abc123XY" });
    expect(videoSource("https://aparat.com/video/video/embed/videohash/Q1w2/vt/frame")).toEqual({ kind: "aparat", hash: "Q1w2" });
    expect(videoSource("https://cdn.example.org/lessons/intro.mp4")).toEqual({ kind: "file" });
    expect(videoSource("http://cdn.example.org/lessons/intro.mp4")).toBeNull();
    expect(videoSource("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(videoSource("javascript:alert(1)")).toBeNull();
  });

  it("appends new lessons in order, edits them and moves them", async () => {
    const { moduleId } = await newCourse();
    const first = await addLesson(moduleId, "L1");
    const second = await addLesson(moduleId, "L2");
    const third = await addLesson(moduleId, "L3");
    expect([first.order, second.order, third.order]).toEqual([1, 2, 3]);

    await request(app.getHttpServer())
      .patch(`/admin/lessons/${second.id}`)
      .set("Cookie", adminCookie)
      .send({
        title: "L2 edited",
        isPreview: true,
        contentBlocks: [
          { type: "heading", level: 2, text: "Heading" },
          { type: "video", url: "https://www.aparat.com/v/abc123" },
        ],
      })
      .expect(200);
    const edited = await request(app.getHttpServer()).get(`/admin/lessons/${second.id}`).set("Cookie", adminCookie).expect(200);
    expect(edited.body).toMatchObject({ title: "L2 edited", isPreview: true });
    expect(edited.body.contentBlocks).toHaveLength(2);

    await request(app.getHttpServer())
      .post(`/admin/lessons/${third.id}/move`)
      .set("Cookie", adminCookie)
      .send({ direction: "up" })
      .expect(200);
    const order = await prisma.lesson.findMany({ where: { courseModuleId: moduleId }, orderBy: { order: "asc" }, select: { title: true } });
    expect(order.map((row) => row.title)).toEqual(["L1", "L3", "L2 edited"]);

    // Moving past the ends is a no-op, not an error.
    await request(app.getHttpServer()).post(`/admin/lessons/${first.id}/move`).set("Cookie", adminCookie).send({ direction: "up" }).expect(200);
    await request(app.getHttpServer()).post(`/admin/lessons/${first.id}/move`).set("Cookie", adminCookie).send({ direction: "sideways" }).expect(400);
  });

  it("refuses blocks the lesson page could not show", async () => {
    const { moduleId } = await newCourse();
    const lesson = await addLesson(moduleId, "Checked");
    const patch = (contentBlocks: unknown[]) =>
      request(app.getHttpServer()).patch(`/admin/lessons/${lesson.id}`).set("Cookie", adminCookie).send({ contentBlocks });

    await patch([{ type: "image", media_key: "missing" }]).expect(400);
    await patch([{ type: "video", url: "https://www.youtube.com/watch?v=1" }]).expect(400);
    await patch([{ type: "text", text: "   " }]).expect(400);
    await patch([{ type: "script", text: "x" }]).expect(400);
    await request(app.getHttpServer())
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({ title: "bad", contentBlocks: [{ type: "video", url: "http://insecure.example/v.mp4" }] })
      .expect(400);
  });

  it("uploads a lesson image, lets an image block use it, and serves it publicly only for a preview lesson", async () => {
    const { courseId, moduleId } = await newCourse();
    const lesson = await addLesson(moduleId, "With image");

    await request(app.getHttpServer())
      .post(`/admin/lessons/${lesson.id}/images`)
      .set("Cookie", adminCookie)
      .attach("file", Buffer.from("not an image"), { filename: "x.txt", contentType: "text/plain" })
      .expect(400);
    const uploaded = await request(app.getHttpServer())
      .post(`/admin/lessons/${lesson.id}/images`)
      .set("Cookie", adminCookie)
      .attach("file", PNG, { filename: "graph.png", contentType: "image/png" })
      .expect(201);
    expect(uploaded.body.media_key).toMatch(/^img-[0-9a-f]{12}$/);
    // The same file twice is one asset.
    await request(app.getHttpServer())
      .post(`/admin/lessons/${lesson.id}/images`)
      .set("Cookie", adminCookie)
      .attach("file", PNG, { filename: "graph.png", contentType: "image/png" })
      .expect(201);
    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(stored.assets).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/admin/lessons/${lesson.id}`)
      .set("Cookie", adminCookie)
      .send({ contentBlocks: [{ type: "image", media_key: uploaded.body.media_key, alt: "graph" }] })
      .expect(200);

    const mediaPath = uploaded.body.url as string;
    await request(app.getHttpServer()).post(`/admin/courses/${courseId}/publish`).set("Cookie", adminCookie).expect(201);
    // A paid lesson's image is not handed to anonymous visitors...
    await request(app.getHttpServer()).get(mediaPath).expect(403);
    // ...a preview lesson's is.
    await request(app.getHttpServer()).patch(`/admin/lessons/${lesson.id}`).set("Cookie", adminCookie).send({ isPreview: true }).expect(200);
    await request(app.getHttpServer()).get(mediaPath).expect(302);

    // And the student lesson endpoint carries the assets the block needs.
    const publicLesson = await request(app.getHttpServer()).get(`/lessons/${lesson.id}`).expect(200);
    expect(publicLesson.body.assets[0].media_key).toBe(uploaded.body.media_key);

    // Unpublishing the course closes it again.
    await request(app.getHttpServer()).post(`/admin/courses/${courseId}/unpublish`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get(mediaPath).expect(403);
    await request(app.getHttpServer()).get(`/lessons/${lesson.id}`).expect(404);
  });

  it("deletes only what nobody has studied, and only empty modules", async () => {
    const { courseId, moduleId } = await newCourse("PUBLIC");
    const studied = await addLesson(moduleId, "Studied", { isPreview: true });
    const untouched = await addLesson(moduleId, "Untouched");
    await request(app.getHttpServer()).post(`/admin/courses/${courseId}/publish`).set("Cookie", adminCookie).expect(201);

    const student = await login(randomPhone());
    await request(app.getHttpServer()).get(`/lessons/${studied.id}`).set("Cookie", student.cookie).expect(200);

    await request(app.getHttpServer()).delete(`/admin/lessons/${studied.id}`).set("Cookie", adminCookie).expect(400);
    await request(app.getHttpServer()).delete(`/admin/modules/${moduleId}`).set("Cookie", adminCookie).expect(400);
    await request(app.getHttpServer()).delete(`/admin/lessons/${untouched.id}`).set("Cookie", adminCookie).expect(200);
    expect(await prisma.lesson.count({ where: { id: untouched.id } })).toBe(0);

    const empty = await request(app.getHttpServer())
      .post(`/admin/courses/${courseId}/modules`)
      .set("Cookie", adminCookie)
      .send({ title: "Empty", order: 2 })
      .expect(201);
    await request(app.getHttpServer()).patch(`/admin/modules/${empty.body.id}`).set("Cookie", adminCookie).send({ title: "Renamed" }).expect(200);
    await request(app.getHttpServer()).post(`/admin/modules/${empty.body.id}/move`).set("Cookie", adminCookie).send({ direction: "up" }).expect(200);
    const modules = await prisma.courseModule.findMany({ where: { courseId }, orderBy: { order: "asc" }, select: { title: true } });
    expect(modules.map((row) => row.title)).toEqual(["Renamed", "Module A"]);
    await request(app.getHttpServer()).delete(`/admin/modules/${empty.body.id}`).set("Cookie", adminCookie).expect(200);

    const audit = await prisma.auditLog.findMany({ where: { action: { in: ["lesson.deleted", "course_module.deleted"] }, targetId: { in: [untouched.id, empty.body.id] } } });
    expect(audit).toHaveLength(2);
  });

  it("keeps authoring to authors and admins", async () => {
    const { moduleId } = await newCourse();
    const lesson = await addLesson(moduleId, "Guarded");
    const student = await login(randomPhone());
    await request(app.getHttpServer()).patch(`/admin/lessons/${lesson.id}`).set("Cookie", student.cookie).send({ title: "x" }).expect(403);
    await request(app.getHttpServer()).delete(`/admin/lessons/${lesson.id}`).set("Cookie", student.cookie).expect(403);
    await request(app.getHttpServer())
      .post(`/admin/lessons/${lesson.id}/images`)
      .set("Cookie", student.cookie)
      .attach("file", PNG, { filename: "a.png", contentType: "image/png" })
      .expect(403);
    await request(app.getHttpServer()).get(`/admin/lessons/${lesson.id}`).expect(401);
  });

  it("unpublishes an exam: no new attempts, but it stays in the admin list", async () => {
    const exam = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug: `unpub-exam-${suffix}`, title: "Unpub", description: "d", mode: "STATIC", durationMinutes: 10 })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/exams/${exam.body.id}/publish`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get(`/exams/unpub-exam-${suffix}`).expect(200);
    await request(app.getHttpServer()).post(`/admin/exams/${exam.body.id}/unpublish`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).get(`/exams/unpub-exam-${suffix}`).expect(404);
    const list = await request(app.getHttpServer()).get("/admin/exams").set("Cookie", adminCookie).expect(200);
    expect(list.body.find((row: { id: string }) => row.id === exam.body.id).isPublished).toBe(false);
  });
});
