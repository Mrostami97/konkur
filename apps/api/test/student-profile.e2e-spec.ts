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
  return `+9896${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

const COMPLETE_PROFILE = {
  firstName: "سارا",
  lastName: "محمدی",
  educationStatus: "BACHELOR_GRADUATE",
  universityName: "دانشگاه صنعتی اصفهان",
  fieldOfStudy: "مهندسی کامپیوتر",
  targetDegree: "MASTER",
  targetField: "computer-engineering",
};

describe("Student profile and exam readiness (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let examId: string;

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

    // One published static exam with a single question.
    const stamp = Date.now();
    const externalId = `profile-q-${stamp}`;
    const job = await request(app.getHttpServer())
      .post("/admin/questions")
      .set("Cookie", adminCookie)
      .send({
        external_id: externalId,
        exam: { degree: "master", major: "computer-engineering", year: 1405 },
        subject_code: `profile-subject-${stamp}`,
        topic_codes: ["t1"],
        stem_blocks: [{ type: "text", text: "stem" }],
        options: [1, 2, 3, 4].map((number) => ({ number, blocks: [{ type: "text", text: String(number) }] })),
        correct_option: 2,
        solution_blocks: [{ type: "text", text: "solution" }],
      })
      .expect(201);
    const items = await request(app.getHttpServer())
      .get(`/admin/import/${job.body.id}/items`)
      .set("Cookie", adminCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: [items.body[0].id], decision: "APPROVE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/import/${job.body.id}/publish`)
      .set("Cookie", adminCookie)
      .expect(201);
    const question = await prisma.question.findUniqueOrThrow({ where: { externalId } });

    const exam = await request(app.getHttpServer())
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug: `profile-exam-${stamp}`, title: "Profile gate exam", description: "…", mode: "STATIC", durationMinutes: 20 })
      .expect(201);
    examId = exam.body.id;
    await request(app.getHttpServer())
      .post(`/admin/exams/${examId}/items`)
      .set("Cookie", adminCookie)
      .send({ questionId: question.id, order: 0 })
      .expect(201);
    await request(app.getHttpServer()).post(`/admin/exams/${examId}/publish`).set("Cookie", adminCookie).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports what a new student still has to fill in", async () => {
    const cookie = await login(randomPhone());
    const res = await request(app.getHttpServer()).get("/me/profile").set("Cookie", cookie).expect(200);
    expect(res.body.completion).toEqual({
      complete: false,
      percent: 0,
      missing: ["firstName", "lastName", "educationStatus", "universityName", "fieldOfStudy", "targetDegree", "targetField"],
    });
  });

  it("rejects values that do not belong in the fields", async () => {
    const cookie = await login(randomPhone());
    const bad = [
      { firstName: "Sara1" },
      { lastName: "<b>x</b>" },
      { gpa: 21 },
      { gpa: 17.255 },
      { entryYear: 1300 },
      { educationStatus: "PROFESSOR" },
      { targetExamYear: 1390 },
      { nationalId: "0012345678" },
    ];
    for (const body of bad) {
      await request(app.getHttpServer()).patch("/me/profile").set("Cookie", cookie).send(body).expect(400);
    }
  });

  it("saves step by step, normalises Persian text and follows the real name", async () => {
    const cookie = await login(randomPhone());
    const first = await request(app.getHttpServer())
      .patch("/me/profile")
      .set("Cookie", cookie)
      // Arabic yeh and kaf, as typed on an Arabic keyboard layout.
      .send({ firstName: " علي ", lastName: "كريمي   نژاد" })
      .expect(200);
    expect(first.body.firstName).toBe("علی");
    expect(first.body.lastName).toBe("کریمی نژاد");
    expect(first.body.displayName).toBe("علی کریمی نژاد");
    expect(first.body.completion.complete).toBe(false);
    expect(first.body.completedAt).toBeNull();

    const done = await request(app.getHttpServer())
      .patch("/me/profile")
      .set("Cookie", cookie)
      .send({ ...COMPLETE_PROFILE, firstName: "علی", lastName: "کریمی نژاد", gpa: 17.25, entryYear: 1399 })
      .expect(200);
    expect(done.body.completion).toMatchObject({ complete: true, percent: 100, missing: [] });
    expect(done.body.completedAt).not.toBeNull();
    expect(done.body.gpa).toBe(17.25);

    // null clears an optional answer without touching the rest.
    const cleared = await request(app.getHttpServer())
      .patch("/me/profile")
      .set("Cookie", cookie)
      .send({ gpa: null })
      .expect(200);
    expect(cleared.body.gpa).toBeNull();
    expect(cleared.body.completion.complete).toBe(true);
    expect(cleared.body.completedAt).toBe(done.body.completedAt);
  });

  it("will not start an exam until name and education are filled in", async () => {
    const cookie = await login(randomPhone());
    const refused = await request(app.getHttpServer())
      .post(`/exams/${examId}/start`)
      .set("Cookie", cookie)
      .expect(403);
    expect(refused.body.code).toBe("PROFILE_INCOMPLETE");
    expect(refused.body.missing).toContain("firstName");
    expect(await prisma.attempt.count({ where: { examId } })).toBe(0);

    await request(app.getHttpServer()).patch("/me/profile").set("Cookie", cookie).send(COMPLETE_PROFILE).expect(200);
    const started = await request(app.getHttpServer())
      .post(`/exams/${examId}/start`)
      .set("Cookie", cookie)
      .expect(201);
    expect(started.body.id).toBeDefined();
  });

  it("lists only the student's own attempts, with no questions or answers", async () => {
    await request(app.getHttpServer()).get("/me/attempts").expect(401);

    const mine = await login(randomPhone());
    const other = await login(randomPhone());
    for (const cookie of [mine, other]) {
      await request(app.getHttpServer()).patch("/me/profile").set("Cookie", cookie).send(COMPLETE_PROFILE).expect(200);
    }
    const started = await request(app.getHttpServer()).post(`/exams/${examId}/start`).set("Cookie", mine).expect(201);
    await request(app.getHttpServer()).post(`/attempts/${started.body.id}/submit`).set("Cookie", mine).expect(201);
    await request(app.getHttpServer()).post(`/exams/${examId}/start`).set("Cookie", other).expect(201);

    const list = await request(app.getHttpServer()).get("/me/attempts").set("Cookie", mine).expect(200);
    expect(list.body).toHaveLength(1);
    const [attempt] = list.body;
    expect(attempt.id).toBe(started.body.id);
    expect(attempt.status).toBe("SUBMITTED");
    expect(attempt.exam.title).toBe("Profile gate exam");
    expect(attempt.score).toMatchObject({ correctCount: 0, unansweredCount: 1 });
    expect(attempt).not.toHaveProperty("answers");
    expect(JSON.stringify(attempt)).not.toContain("correctOption");
  });
});
