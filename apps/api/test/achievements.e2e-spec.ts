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
  return `+9895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

/** A real 1x1 PNG, so the upload path is exercised with an actual image. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("Student results wall + free lectures (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let studentCookie: string;

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  const base = {
    displayName: "دانشجوی آزمایشی",
    examYear: 1404,
    degree: "MASTER",
    field: "مهندسی کامپیوتر",
    rank: 7,
    rankLabel: "رتبهٔ کشوری",
    acceptedUniversity: "دانشگاه صنعتی شریف",
    subjectSlugs: ["digital-logic"],
  };

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
    studentCookie = await login(randomPhone());
  });

  afterAll(async () => {
    await app.close();
  });

  it("refuses to publish a result with no recorded consent", async () => {
    await request(app.getHttpServer())
      .post("/admin/achievements")
      .set("Cookie", adminCookie)
      .send({ ...base, isPublished: true })
      .expect(400);

    // The database holds the same rule, so no code path -- a script, a
    // future endpoint, a direct update -- can get around it.
    const draft = await prisma.studentAchievement.create({
      data: { ...base, degree: "MASTER", displayName: "بدون رضایت" },
    });
    await expect(
      prisma.studentAchievement.update({ where: { id: draft.id }, data: { isPublished: true } }),
    ).rejects.toThrow();
  });

  it("keeps the wall to admins, and never shows how consent was obtained", async () => {
    await request(app.getHttpServer())
      .post("/admin/achievements")
      .set("Cookie", studentCookie)
      .send(base)
      .expect(403);

    const created = await request(app.getHttpServer())
      .post("/admin/achievements")
      .set("Cookie", adminCookie)
      .send({
        ...base,
        displayName: "نتیجهٔ منتشرشده",
        consentConfirmedAt: new Date().toISOString(),
        consentNote: "رضایت کتبی در پیام خصوصی",
        isPublished: true,
      })
      .expect(201);

    const wall = await request(app.getHttpServer()).get("/achievements").expect(200);
    const row = wall.body.find((item: { id: string }) => item.id === created.body.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("consentNote");
    expect(row).not.toHaveProperty("consentConfirmedAt");
    // The draft from the previous test is not on the wall.
    expect(wall.body.some((item: { displayName: string }) => item.displayName === "بدون رضایت")).toBe(false);
  });

  it("serves a student's photo only while their result is published", async () => {
    const upload = await request(app.getHttpServer())
      .post("/admin/achievements/photo")
      .set("Cookie", adminCookie)
      .attach("file", TINY_PNG, { filename: "photo.png", contentType: "image/png" })
      .expect(201);
    const { photoArtifactId, photoPath } = upload.body as { photoArtifactId: string; photoPath: string };

    const created = await request(app.getHttpServer())
      .post("/admin/achievements")
      .set("Cookie", adminCookie)
      .send({ ...base, displayName: "با عکس", photoArtifactId })
      .expect(201);

    // Unpublished: not for strangers, and not for a signed-in student either.
    await request(app.getHttpServer()).get(photoPath).expect(404);
    await request(app.getHttpServer()).get(photoPath).set("Cookie", studentCookie).expect(404);
    // The admin managing the wall can still see it.
    await request(app.getHttpServer()).get(photoPath).set("Cookie", adminCookie).expect(200);

    await request(app.getHttpServer())
      .patch(`/admin/achievements/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({
        ...base,
        displayName: "با عکس",
        photoArtifactId,
        consentConfirmedAt: new Date().toISOString(),
        isPublished: true,
      })
      .expect(200);
    await request(app.getHttpServer()).get(photoPath).expect(200);

    // Consent withdrawn: the photo goes dark immediately.
    await request(app.getHttpServer())
      .post(`/admin/achievements/${created.body.id}/unpublish`)
      .set("Cookie", adminCookie)
      .expect(201);
    await request(app.getHttpServer()).get(photoPath).expect(404);
  });

  /** A PNG with its own checksum, so erasing it cannot touch another test's photo. */
  function uniquePng() {
    return Buffer.concat([TINY_PNG, Buffer.from(`${Date.now()}-${Math.random()}`)]);
  }

  it("keeps a photo private even when no result uses it", async () => {
    // Uploaded, then the form was abandoned: the image is still a person's
    // face, and must not fall through to the signed-in media rule.
    const upload = await request(app.getHttpServer())
      .post("/admin/achievements/photo")
      .set("Cookie", adminCookie)
      .attach("file", uniquePng(), { filename: "orphan.png", contentType: "image/png" })
      .expect(201);
    const { photoPath } = upload.body as { photoPath: string };

    await request(app.getHttpServer()).get(photoPath).expect(404);
    await request(app.getHttpServer()).get(photoPath).set("Cookie", studentCookie).expect(404);
    await request(app.getHttpServer()).get(photoPath).set("Cookie", adminCookie).expect(200);
  });

  it("erases a result and its photo for good when the student asks", async () => {
    const upload = await request(app.getHttpServer())
      .post("/admin/achievements/photo")
      .set("Cookie", adminCookie)
      .attach("file", uniquePng(), { filename: "erase.png", contentType: "image/png" })
      .expect(201);
    const { photoArtifactId, photoPath } = upload.body as { photoArtifactId: string; photoPath: string };

    const created = await request(app.getHttpServer())
      .post("/admin/achievements")
      .set("Cookie", adminCookie)
      .send({
        ...base,
        displayName: "حذف کامل",
        photoArtifactId,
        consentConfirmedAt: new Date().toISOString(),
        isPublished: true,
      })
      .expect(201);
    await request(app.getHttpServer()).get(photoPath).expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/achievements/${created.body.id}`)
      .set("Cookie", studentCookie)
      .expect(403);

    const erased = await request(app.getHttpServer())
      .delete(`/admin/achievements/${created.body.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(erased.body).toMatchObject({ erased: true, photoErased: true });

    expect(await prisma.studentAchievement.findUnique({ where: { id: created.body.id } })).toBeNull();
    expect(await prisma.sourceArtifact.findUnique({ where: { id: photoArtifactId } })).toBeNull();
    // Gone for everyone, the admin included.
    await request(app.getHttpServer()).get(photoPath).set("Cookie", adminCookie).expect(404);

    // The audit trail records the erasure without the person in it.
    const entry = await prisma.auditLog.findFirst({
      where: { action: "achievement.erased", targetId: created.body.id },
    });
    expect(entry).not.toBeNull();
    expect(JSON.stringify(entry?.metadata ?? {})).not.toContain("حذف کامل");

    await request(app.getHttpServer())
      .delete(`/admin/achievements/${created.body.id}`)
      .set("Cookie", adminCookie)
      .expect(404);
  });

  it("treats a malformed query number as absent instead of failing", async () => {
    await request(app.getHttpServer()).get("/achievements?limit=abc&examYear=x").expect(200);
  });

  it("refuses anything that is not an image", async () => {
    await request(app.getHttpServer())
      .post("/admin/achievements/photo")
      .set("Cookie", adminCookie)
      .attach("file", Buffer.from("not an image"), { filename: "x.txt", contentType: "text/plain" })
      .expect(400);
  });

  it("computes the headline numbers from published results only", async () => {
    const summary = await request(app.getHttpServer()).get("/achievements/summary").expect(200);
    const published = await prisma.studentAchievement.count({ where: { isPublished: true } });
    expect(summary.body.total).toBe(published);
    expect(summary.body.under10).toBeLessThanOrEqual(published);
  });

  it("offers the owner's free lectures as links, never as hosted video", async () => {
    const res = await request(app.getHttpServer())
      .get("/resources?kind=VIDEO&subject=digital-logic")
      .expect(200);
    const items = Array.isArray(res.body) ? res.body : res.body.items;
    const lecture = items.find((item: { slug: string }) => item.slug === "free-lecture-digital-logic-sharif");
    expect(lecture).toBeDefined();
    expect(lecture.hostingMode).toBe("EXTERNAL_LINK");

    // The link itself is released only through the content route, which
    // checks that a source actually clears this exact URL for linking.
    const content = await request(app.getHttpServer())
      .get("/resources/free-lecture-digital-logic-sharif/content")
      .expect(200);
    expect(content.body.externalUrl).toBe("https://ocw.sharif.ir/course/id/323");
  });

  it("clears every free lecture for linking, and none for hosting", async () => {
    const lectures = await prisma.resource.findMany({
      where: { slug: { startsWith: "free-lecture-" } },
      include: { sources: { include: { source: true } } },
    });
    expect(lectures).toHaveLength(7);
    for (const lecture of lectures) {
      const source = lecture.sources[0].source;
      expect(source.canonicalUrl).toBe(lecture.externalUrl);
      expect(source.mayLink).toBe(true);
      expect(source.mayEmbed).toBe(false);
      expect(source.mayHost).toBe(false);
      expect(source.mayReproduce).toBe(false);
    }
  });
});
