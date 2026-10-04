import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import AdmZip from "adm-zip";
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

const randomPhone = () => `0939${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

describe("Exam simulator and report card (e2e)", () => {
  let app: INestApplication;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  const http = () => request(app.getHttpServer());
  // A year no other suite uses, so the simulator holds only these questions.
  const year = 1300 + (Date.now() % 80);
  const examCode = "1277";

  async function login(phone: string) {
    await http().post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent[otp.sent.length - 1].code;
    const res = await http().post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  async function student(gpa?: number) {
    const cookie = await login(randomPhone());
    await http()
      .patch("/me/profile")
      .set("Cookie", cookie)
      .send({
        firstName: "دانشجو",
        lastName: "شبیه‌ساز",
        educationStatus: "BACHELOR_STUDENT",
        universityName: "دانشگاه آزمایشی",
        fieldOfStudy: "مهندسی کامپیوتر",
        targetDegree: "MASTER",
        targetField: "computer-engineering",
        ...(gpa ? { gpa } : {}),
      })
      .expect(200);
    return cookie;
  }

  const questions: { number: number; subject: string; key: number; review?: boolean }[] = [
    { number: 1, subject: "english", key: 1 },
    { number: 2, subject: "english", key: 2 },
    { number: 30, subject: "discrete-math", key: 3 },
    { number: 31, subject: "statistics", key: 4 },
    { number: 70, subject: "operating-systems", key: 1 },
    { number: 71, subject: "operating-systems", key: 2, review: false },
  ];

  beforeAll(async () => {
    process.env.EXAM_RANK_MIN_PARTICIPANTS = "2";
    process.env.EXAM_QUESTION_STAT_MIN_ANSWERS = "2";
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OTP_PROVIDER).useValue(otp).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);

    const items = questions.map((q) => ({
      schema_version: "question.v2",
      external_id: `sim-${year}-${q.number}-${Date.now()}`,
      exam: { degree: "master", major: "computer-engineering", year, code: examCode },
      slot: { booklet: 1, number: q.number },
      subject_code: q.subject,
      topic_codes: [],
      stem_blocks: [{ type: "text", text: `question ${q.number}` }],
      options: [1, 2, 3, 4].map((n) => ({ number: n, blocks: [{ type: "text", text: `option ${n}` }] })),
      correct_option: q.key,
      solution_blocks: [],
      review: { text_verified: true, key_verified: q.review !== false },
      provenance: { producer_type: "ocr", source_artifact: "simulator-e2e" },
    }));
    const zip = new AdmZip();
    zip.addFile("payload.json", Buffer.from(JSON.stringify(items)));
    const job = await http().post("/admin/import").set("Cookie", adminCookie).attach("file", zip.toBuffer(), "sim.zip").expect(201);
    const staged = await http().get(`/admin/import/${job.body.id}/items`).set("Cookie", adminCookie).expect(200);
    await http()
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: staged.body.map((row: { id: string }) => row.id), decision: "APPROVE" })
      .expect(201);
    await http().post(`/admin/import/${job.body.id}/publish`).set("Cookie", adminCookie).expect(201);
  });

  afterAll(async () => {
    delete process.env.EXAM_RANK_MIN_PARTICIPANTS;
    delete process.env.EXAM_QUESTION_STAT_MIN_ANSWERS;
    await app.close();
  });

  let examId: string;

  it("builds a simulator of the year in booklet order, in konkur sections, without unreviewed questions", async () => {
    const student0 = await student();
    await http().post("/admin/exams/simulators").set("Cookie", student0).send({ examCode, examYear: year, durationMinutes: 30 }).expect(403);

    const built = await http().post("/admin/exams/simulators").set("Cookie", adminCookie).send({ examCode, examYear: year, durationMinutes: 30 }).expect(201);
    expect(built.body).toMatchObject({ slug: `simulator-${examCode}-${year}`, questions: 5, inBooklet: 6, simulatesYear: year });
    examId = built.body.id;
    const detail = await http().get(`/admin/exams/${examId}`).set("Cookie", adminCookie).expect(200);
    expect(detail.body.forms[0].items).toHaveLength(5);

    // Rebuilding while nobody has sat it replaces it in place.
    const rebuilt = await http().post("/admin/exams/simulators").set("Cookie", adminCookie).send({ examCode, examYear: year, durationMinutes: 40 }).expect(201);
    examId = rebuilt.body.id;
    await http().post(`/admin/exams/${examId}/publish`).set("Cookie", adminCookie).expect(201);
  });

  it("records time, flags and changes of mind, and issues a sectioned report card", async () => {
    const first = await student(18);
    const started = await http().post(`/exams/${examId}/start`).set("Cookie", first).expect(201);
    expect(started.body.sections.map((section: { title: string }) => section.title)).toEqual([
      "زبان عمومی و تخصصی",
      "ریاضیات",
      "سیستم عامل، شبکه و پایگاه داده",
    ]);
    const ids: string[] = started.body.items.map((row: { questionId: string }) => row.questionId);
    const keys = [1, 2, 3, 4, 1];

    await http()
      .post(`/attempts/${started.body.id}/activity`)
      .set("Cookie", first)
      .send({ entries: [{ questionId: ids[0], timeSpentMs: 40_000, flagged: true }, { questionId: ids[2], timeSpentMs: 90_000 }] })
      .expect(201);
    // An overnight tab counts as fifteen minutes at most.
    await http().post(`/attempts/${started.body.id}/activity`).set("Cookie", first).send({ entries: [{ questionId: ids[2], timeSpentMs: 5 * 60 * 60_000 }] }).expect(201);

    // English: one right, one wrong after a change of mind. Maths: right, blank. OS: wrong.
    await http().put(`/attempts/${started.body.id}/answers/${ids[0]}`).set("Cookie", first).send({ selectedOption: keys[0] }).expect(200);
    await http().put(`/attempts/${started.body.id}/answers/${ids[1]}`).set("Cookie", first).send({ selectedOption: keys[1] }).expect(200);
    await http().put(`/attempts/${started.body.id}/answers/${ids[1]}`).set("Cookie", first).send({ selectedOption: 4 }).expect(200);
    await http().put(`/attempts/${started.body.id}/answers/${ids[2]}`).set("Cookie", first).send({ selectedOption: keys[2] }).expect(200);
    await http().put(`/attempts/${started.body.id}/answers/${ids[4]}`).set("Cookie", first).send({ selectedOption: 4 }).expect(200);

    const resumed = await http().get(`/attempts/${started.body.id}`).set("Cookie", first).expect(200);
    expect(resumed.body.items[0]).toMatchObject({ flagged: true, timeSpentMs: 40_000, selectedOption: 1 });

    await http().post(`/attempts/${started.body.id}/submit`).set("Cookie", first).expect(201);
    // A late activity batch after the submit is ignored, not an error.
    await http().post(`/attempts/${started.body.id}/activity`).set("Cookie", first).send({ entries: [{ questionId: ids[0], timeSpentMs: 1000 }] }).expect(201);

    const report = (await http().get(`/attempts/${started.body.id}/report`).set("Cookie", first).expect(200)).body;
    expect(report.exam.simulatesYear).toBe(year);
    expect(report.gpa).toBe(18);
    expect(report.sections.map((section: { correct: number; wrong: number; blank: number }) => [section.correct, section.wrong, section.blank])).toEqual([
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ]);
    expect(report.sections[0].percent).toBeCloseTo(33.33, 1);
    expect(report.sections[0].taraz).toBeNull(); // one participant so far
    expect(report.timeSpentMs).toBe(40_000 + 90_000 + 15 * 60_000);
    const english2 = report.items.find((row: { question: { id: string } }) => row.question.id === ids[1]);
    expect(english2).toMatchObject({ changeCount: 1, selectedOption: 4, crowdCorrectPercent: null });
    expect(report.subjects.find((subject: { subjectCode: string }) => subject.subjectCode === "operating-systems")).toMatchObject({ questions: 1, wrong: 1 });
    expect(report.history[0]).toMatchObject({ attemptId: started.body.id });
  });

  it("compares with the other participants once there are enough of them", async () => {
    const second = await student();
    const started = await http().post(`/exams/${examId}/start`).set("Cookie", second).expect(201);
    const ids: string[] = started.body.items.map((row: { questionId: string }) => row.questionId);
    for (const [index, option] of [1, 2, 3, 4, 1].entries()) {
      await http().put(`/attempts/${started.body.id}/answers/${ids[index]}`).set("Cookie", second).send({ selectedOption: option }).expect(200);
    }
    await http().post(`/attempts/${started.body.id}/submit`).set("Cookie", second).expect(201);
    const report = (await http().get(`/attempts/${started.body.id}/report`).set("Cookie", second).expect(200)).body;
    expect(report.participants).toBe(2);
    expect(report.sections.every((section: { taraz: number | null }) => typeof section.taraz === "number")).toBe(true);
    expect(report.overallTaraz).toBeGreaterThan(5000);
    // Both got the first question right; only this student got the OS one.
    expect(report.items[0].crowdCorrectPercent).toBe(100);
    expect(report.items[4].crowdCorrectPercent).toBe(50);
  });

  it("will not rebuild a simulator someone has sat", async () => {
    await http().post("/admin/exams/simulators").set("Cookie", adminCookie).send({ examCode, examYear: year, durationMinutes: 30 }).expect(409);
  });
});
