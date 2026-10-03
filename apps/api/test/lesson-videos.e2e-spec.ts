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
  return `+9896${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

/** Collects a response body as raw bytes, whatever its content type. */
function binary(res: request.Response, done: (err: Error | null, body: Buffer) => void) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => done(null, Buffer.concat(chunks)));
}

function box(type: string, ...body: Buffer[]) {
  const content = Buffer.concat(body);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + content.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, content]);
}

/**
 * A minimal MP4 laid out the way phones write it: media data first, the
 * index (moov) last, with one chunk offset pointing at the media. The run id
 * in the media makes this upload's checksum its own.
 */
function mp4WithIndexLast(brand = "isom") {
  const ftyp = box("ftyp", Buffer.from(brand, "latin1"), Buffer.alloc(4), Buffer.from("isommp41", "latin1"));
  const media = Buffer.from(`CHUNK:${randomUUID()}`, "latin1");
  const mdat = box("mdat", media);
  const chunkAt = ftyp.length + 8;
  const stcoBody = Buffer.alloc(12);
  stcoBody.writeUInt32BE(1, 4);
  stcoBody.writeUInt32BE(chunkAt, 8);
  const moov = box("moov", box("trak", box("mdia", box("minf", box("stbl", box("stco", stcoBody))))));
  return { file: Buffer.concat([ftyp, mdat, moov]), media };
}

/** Top-level box types in order, and where the stco's one offset points. */
function inspect(file: Buffer) {
  const types: string[] = [];
  let offset = 0;
  let stco = -1;
  while (offset + 8 <= file.length) {
    const size = file.readUInt32BE(offset);
    const type = file.toString("latin1", offset + 4, offset + 8);
    types.push(type);
    if (type === "moov") {
      const at = file.indexOf("stco", offset, "latin1");
      stco = file.readUInt32BE(at + 12);
    }
    offset += size;
  }
  return { types, stco };
}

describe("Lesson videos (e2e)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;
  let courseId: string;
  let moduleId: string;

  const http = () => request(app.getHttpServer());

  async function login(phone: string) {
    await http().post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await http().post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  function upload(cookie: string | null, body: Buffer, filename = "sample.mp4", contentType = "video/mp4") {
    const req = http().post("/admin/lesson-videos");
    if (cookie) req.set("Cookie", cookie);
    return req.attach("file", body, { filename, contentType });
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
    const course = await http()
      .post("/admin/courses")
      .set("Cookie", adminCookie)
      .send({ slug: `lesson-videos-${Date.now()}`, title: "Lesson videos", description: "e2e", accessMode: "ENTITLEMENT" })
      .expect(201);
    courseId = course.body.id;
    const mod = await http().post(`/admin/courses/${courseId}/modules`).set("Cookie", adminCookie).send({ title: "Module", order: 1 }).expect(201);
    moduleId = mod.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("only lets authors and admins upload, and only MP4 or WebM", async () => {
    const { file } = mp4WithIndexLast();
    await upload(null, file).expect(401);
    await upload(studentCookie, file).expect(403);
    await upload(adminCookie, Buffer.from("not a video at all"), "sample.mp4").expect(400);
    // A QuickTime .mov is refused with a way forward, not stored.
    const mov = await upload(adminCookie, mp4WithIndexLast("qt  ").file, "sample.mov", "video/quicktime").expect(400);
    expect(mov.body.message).toMatch(/MP4/);
  });

  it("moves the index first, and streams the sample in byte ranges to anyone once the lesson is a free sample", async () => {
    const { file, media } = mp4WithIndexLast();
    expect(inspect(file).types).toEqual(["ftyp", "mdat", "moov"]);

    const uploaded = await upload(adminCookie, file).expect(201);
    const { media_key: mediaKey, checksum } = uploaded.body as { media_key: string; checksum: string };
    const digest = checksum.replace("sha256:", "");

    const lesson = await http()
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({
        title: "Sample",
        order: 1,
        contentBlocks: [{ type: "video", media_key: mediaKey, caption: "the first session" }],
        assets: [{ media_key: mediaKey, checksum }],
      })
      .expect(201);
    expect(lesson.body.assets).toEqual([{ media_key: mediaKey, checksum }]);
    await http().post(`/admin/courses/${courseId}/publish`).set("Cookie", adminCookie).expect(201);

    // A paid lesson's video is not handed to a guest.
    await http().get(`/media/${digest}`).expect(404);
    await http().patch(`/admin/lessons/${lesson.body.id}`).set("Cookie", adminCookie).send({ isPreview: true }).expect(200);

    // Whole file: the index now comes before the media, and its chunk offset
    // was moved with it, still pointing at the same bytes.
    const whole = await http().get(`/media/${digest}`).buffer(true).parse(binary).expect(200);
    expect(whole.headers["content-type"]).toBe("video/mp4");
    expect(whole.headers["accept-ranges"]).toBe("bytes");
    // Consent and entitlement changes must be checked on every new request.
    expect(whole.headers["cache-control"]).toBe("private, no-store");
    const stored = whole.body as Buffer;
    const layout = inspect(stored);
    expect(layout.types).toEqual(["ftyp", "moov", "mdat"]);
    expect(stored.subarray(layout.stco, layout.stco + media.length).equals(media)).toBe(true);

    // A byte range, as a video element asks for it.
    const part = await http().get(`/media/${digest}`).set("Range", "bytes=4-11").buffer(true).parse(binary).expect(206);
    expect(part.headers["content-range"]).toBe(`bytes 4-11/${stored.length}`);
    expect((part.body as Buffer).equals(stored.subarray(4, 12))).toBe(true);
    const tail = await http().get(`/media/${digest}`).set("Range", "bytes=-6").buffer(true).parse(binary).expect(206);
    expect((tail.body as Buffer).equals(stored.subarray(stored.length - 6))).toBe(true);
    const beyond = await http().get(`/media/${digest}`).set("Range", `bytes=${stored.length}-`).expect(416);
    expect(beyond.headers["content-range"]).toBe(`bytes */${stored.length}`);
  });

  it("refuses a video block that names an image, or nothing uploaded", async () => {
    await http()
      .post(`/admin/modules/${moduleId}/lessons`)
      .set("Cookie", adminCookie)
      .send({
        title: "Never uploaded",
        order: 2,
        contentBlocks: [{ type: "video", media_key: "v" }],
        assets: [{ media_key: "v", checksum: `sha256:${"b".repeat(64)}` }],
      })
      .expect(400);
  });
});
