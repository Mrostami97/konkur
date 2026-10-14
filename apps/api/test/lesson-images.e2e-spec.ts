import "reflect-metadata";
import { randomUUID } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  return `+9895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

/** Collects a response body as raw bytes, whatever its content type. */
function binary(res: request.Response, done: (err: Error | null, body: Buffer) => void) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => done(null, Buffer.concat(chunks)));
}

/** A real 1x1 PNG, so the upload path is exercised with an actual image.
 * Bytes after IEND are ignored by decoders; they make this run's checksum its
 * own, so the image is not shared with another suite's upload of the same PNG. */
const TINY_PNG = Buffer.concat([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
  Buffer.from(randomUUID()),
]);

describe("Lesson images (e2e)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;
  let moduleId: string;
  let courseId: string;

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  function upload(cookie: string | null, body: Buffer, contentType: string) {
    const req = request(app.getHttpServer()).post("/admin/lesson-images");
    if (cookie) req.set("Cookie", cookie);
    return req.attach("file", body, { filename: "figure.png", contentType });
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
    await seed();

    adminCookie = await login(SEED_ADMIN_PHONE);
    studentCookie = await login(randomPhone());

    const course = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `lesson-images-${Date.now()}`, title: "Lesson images", description: "e2e", accessMode: "ENTITLEMENT" })
      .expect(201);
    courseId = course.body.id;
    const mod = await request(app.getHttpServer())
      .post(`/admin/courses/${courseId}/modules`)
      .set("Cookie", adminCookie)
      .send({ title: "Module", order: 1 })
      .expect(201);
    moduleId = mod.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("only lets authors and admins upload, and only real images", async () => {
    await upload(null, TINY_PNG, "image/png").expect(401);
    await upload(studentCookie, TINY_PNG, "image/png").expect(403);
    // A text file dressed up as a PNG is refused by its bytes, not its label.
    await upload(adminCookie, Buffer.from("not an image"), "image/png").expect(400);
    // A real PNG declared as something else is refused too.
    await upload(adminCookie, TINY_PNG, "image/jpeg").expect(400);
  });

  it("refuses an image block whose image the lesson does not carry", async () => {
    await request(app.getHttpServer())
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({ title: "Broken", order: 1, contentBlocks: [{ type: "image", media_key: "nope" }] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({
        title: "Never uploaded",
        order: 1,
        contentBlocks: [{ type: "image", media_key: "x" }],
        assets: [{ media_key: "x", checksum: `sha256:${"a".repeat(64)}` }],
      })
      .expect(400);
  });

  it("attaches an uploaded image and serves it to exactly the readers of the lesson", async () => {
    const uploaded = await upload(adminCookie, TINY_PNG, "image/png").expect(201);
    const { media_key: mediaKey, checksum } = uploaded.body as { media_key: string; checksum: string };
    const digest = checksum.replace("sha256:", "");

    const lesson = await request(app.getHttpServer())
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({
        title: "With a figure",
        order: 1,
        contentBlocks: [{ type: "text", text: "Look:" }, { type: "image", media_key: mediaKey, alt: "a figure" }],
        // An image no block uses is dropped rather than stored.
        assets: [{ media_key: mediaKey, checksum }, { media_key: "unused", checksum }],
      })
      .expect(201);
    expect(lesson.body.assets).toEqual([{ media_key: mediaKey, checksum }]);

    await request(app.getHttpServer()).post(`/admin/courses/${courseId}/publish`).set("Cookie", adminCookie).expect(201);

    // A paid lesson's image is not handed to a guest by checksum.
    await request(app.getHttpServer()).get(`/media/${digest}`).expect(404);

    // Once the lesson is a free preview, anyone who can read it can see it.
    await request(app.getHttpServer())
      .patch(`/admin/lessons/${lesson.body.id}`)
      .set("Cookie", adminCookie)
      .send({ isPreview: true })
      .expect(200);
    // Served by the API itself: storage is not reachable from a browser.
    const served = await request(app.getHttpServer()).get(`/media/${digest}`).buffer(true).parse(binary).expect(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(served.body as Buffer, TINY_PNG)).toBe(0);
    const read = await request(app.getHttpServer()).get(`/lessons/${lesson.body.id}`).expect(200);
    expect(read.body.assets).toEqual([{ media_key: mediaKey, checksum }]);

    // Removing the image block removes the image from the lesson.
    const edited = await request(app.getHttpServer())
      .patch(`/admin/lessons/${lesson.body.id}`)
      .set("Cookie", adminCookie)
      .send({ contentBlocks: [{ type: "text", text: "No figure now." }] })
      .expect(200);
    expect(edited.body.assets).toEqual([]);
  });

  it("sets a course cover that is public once the course is published, and removes it", async () => {
    // A course of its own: the one above is already published.
    const created = await request(app.getHttpServer())
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `course-cover-${Date.now()}`, title: "Course cover", description: "e2e", accessMode: "ENTITLEMENT" })
      .expect(201);
    const coverCourseId = created.body.id as string;
    const cover = Buffer.concat([TINY_PNG, Buffer.from(randomUUID())]);
    const coverUpload = (cookie: string) =>
      request(app.getHttpServer()).post(`/admin/courses/${coverCourseId}/cover`).set("Cookie", cookie).attach("file", cover, { filename: "cover.png", contentType: "image/png" });
    await coverUpload(studentCookie).expect(403);
    await request(app.getHttpServer()).post(`/admin/courses/${coverCourseId}/cover`).set("Cookie", adminCookie)
      .attach("file", Buffer.from("not an image"), { filename: "cover.png", contentType: "image/png" }).expect(400);
    const set = await coverUpload(adminCookie).expect(201);
    const coverUrl = set.body.coverUrl as string;
    expect(coverUrl).toMatch(/^\/media\/[a-f0-9]{64}$/);

    // Unpublished: staff only.
    await request(app.getHttpServer()).get(coverUrl).expect(404);
    await request(app.getHttpServer()).get(coverUrl).set("Cookie", adminCookie).expect(200);
    const listed = await request(app.getHttpServer()).get("/admin/courses").set("Cookie", adminCookie).expect(200);
    expect(listed.body.find((row: { id: string }) => row.id === coverCourseId).coverUrl).toBe(coverUrl);

    // Published: anyone, cached, and on the catalogue.
    await request(app.getHttpServer()).post(`/admin/courses/${coverCourseId}/publish`).set("Cookie", adminCookie).expect(201);
    const served = await request(app.getHttpServer()).get(coverUrl).buffer(true).parse(binary).expect(200);
    expect(served.headers["cache-control"]).toBe("public, max-age=86400");
    expect((served.body as Buffer).equals(cover)).toBe(true);
    const catalogue = await request(app.getHttpServer()).get("/courses").expect(200);
    expect(catalogue.body.find((row: { id: string }) => row.id === coverCourseId).coverUrl).toBe(coverUrl);

    await request(app.getHttpServer()).delete(`/admin/courses/${coverCourseId}/cover`).set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get(coverUrl).expect(404);
    await request(app.getHttpServer()).post(`/admin/courses/${coverCourseId}/unpublish`).set("Cookie", adminCookie).expect(201);
  });
});
