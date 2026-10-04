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

function randomPhone(): string {
  return `0938${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

/** A past-exam question as the archive converter writes it. */
function archiveQuestion(
  externalId: string,
  subjectCode: string,
  number: number,
  extra: { review: { text_verified: boolean; key_verified: boolean }; accepted?: number[]; passage?: string },
) {
  return {
    schema_version: "question.v2",
    external_id: externalId,
    exam: { degree: "master", major: "computer-engineering", year: 1403, code: "1277" },
    slot: { booklet: 1, number, section: "زبان عمومی و تخصصی (انگلیسی)" },
    subject_code: subjectCode,
    topic_codes: [],
    ...(extra.passage ? { passage: { external_id: extra.passage, blocks: [{ type: "text", text: "A shared reading passage." }] } } : {}),
    stem_blocks: [{ type: "text", text: `stem ${externalId}` }],
    options: [1, 2, 3, 4].map((n) => ({ number: n, blocks: [{ type: "text", text: `option ${n}` }] })),
    correct_option: 2,
    ...(extra.accepted ? { accepted_options: extra.accepted } : {}),
    solution_blocks: [],
    review: extra.review,
    source: { page: 3, question_number: number, booklet: 1, archive_path: "ce/03/1403.pdf" },
    provenance: { producer_type: "ocr", producer_name: "e2e", source_artifact: "ce/03/1403.pdf" },
  };
}

describe("Past-exam archive questions (question.v2)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  const run = Date.now();
  const subjectCode = `archive-subject-${run}`;
  const http = () => request(app.getHttpServer());

  async function login(phone: string) {
    await http().post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await http().post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  async function examReadyStudent() {
    const cookie = await login(randomPhone());
    await http()
      .patch("/me/profile")
      .set("Cookie", cookie)
      .send({
        firstName: "دانشجو",
        lastName: "آزمایشی",
        educationStatus: "BACHELOR_STUDENT",
        universityName: "دانشگاه آزمایشی",
        fieldOfStudy: "مهندسی کامپیوتر",
        targetDegree: "MASTER",
        targetField: "computer-engineering",
      })
      .expect(200);
    return cookie;
  }

  const ids: Record<string, string> = {};

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

    const verified = { text_verified: true, key_verified: true };
    const items = [
      archiveQuestion(`archive-a-${run}`, subjectCode, 1, { review: verified, accepted: [2, 3], passage: `passage-${run}` }),
      archiveQuestion(`archive-b-${run}`, subjectCode, 2, { review: { text_verified: false, key_verified: true } }),
      archiveQuestion(`archive-c-${run}`, subjectCode, 3, { review: verified, passage: `passage-${run}` }),
    ];
    const zip = new AdmZip();
    zip.addFile("payload.json", Buffer.from(JSON.stringify(items)));
    const job = await http().post("/admin/import").set("Cookie", adminCookie).attach("file", zip.toBuffer(), "archive.zip").expect(201);
    const staged = await http().get(`/admin/import/${job.body.id}/items`).set("Cookie", adminCookie).expect(200);
    expect(staged.body.map((item: { status: string }) => item.status)).toEqual(["VALID", "VALID", "VALID"]);
    await http()
      .post("/admin/import/items/review")
      .set("Cookie", adminCookie)
      .send({ itemIds: staged.body.map((item: { id: string }) => item.id), decision: "APPROVE" })
      .expect(201);
    await http().post(`/admin/import/${job.body.id}/publish`).set("Cookie", adminCookie).expect(201);

    const admin = await http().get(`/admin/questions?subjectCode=${subjectCode}&pageSize=10`).set("Cookie", adminCookie).expect(200);
    for (const row of admin.body.items) ids[row.externalId.split("-")[1]] = row.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("records the booklet slot and derives the tier from the review state", async () => {
    const admin = await http().get(`/admin/questions?subjectCode=${subjectCode}&pageSize=10`).set("Cookie", adminCookie).expect(200);
    const byLetter = Object.fromEntries(admin.body.items.map((row: { externalId: string }) => [row.externalId.split("-")[1], row]));
    expect(byLetter.a).toMatchObject({ qualityTier: "SILVER", examCode: "1277", questionNumber: 1, acceptedOptions: [2, 3] });
    expect(byLetter.b).toMatchObject({ qualityTier: "DRAFT", textVerified: false });
    expect(byLetter.a.passage.externalId).toBe(`passage-${run}`);
    expect(byLetter.c.passage.externalId).toBe(`passage-${run}`);

    const queue = await http().get(`/admin/questions?subjectCode=${subjectCode}&qualityTier=DRAFT`).set("Cookie", adminCookie).expect(200);
    expect(queue.body.items.map((row: { id: string }) => row.id)).toEqual([ids.b]);
  });

  it("keeps an unreviewed question away from students until it is confirmed", async () => {
    const before = await http().get(`/questions?subjectCode=${subjectCode}`).expect(200);
    expect(before.body.total).toBe(2);
    expect(before.body.items.map((row: { id: string }) => row.id)).not.toContain(ids.b);
    await http().get(`/questions/${ids.b}`).expect(404);
    // Locked rows carry no body, passage included.
    expect(before.body.items[0].stemBlocks).toBeUndefined();
    expect(before.body.items[0].passage).toBeUndefined();

    const exam = await http()
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug: `archive-draft-exam-${run}`, title: "x", description: "x", mode: "STATIC", durationMinutes: 10 })
      .expect(201);
    await http().post(`/admin/exams/${exam.body.id}/items`).set("Cookie", adminCookie).send({ questionId: ids.b, order: 0 }).expect(400);
    await http().post(`/admin/questions/${ids.b}/sample`).set("Cookie", adminCookie).send({ isSample: true }).expect(400);

    const reviewed = await http().post(`/admin/questions/${ids.b}/review`).set("Cookie", adminCookie).send({ textVerified: true }).expect(201);
    expect(reviewed.body.qualityTier).toBe("SILVER");
    const after = await http().get(`/questions?subjectCode=${subjectCode}`).expect(200);
    expect(after.body.total).toBe(3);

    // Withdrawing the confirmation takes it out again.
    await http().post(`/admin/questions/${ids.b}/review`).set("Cookie", adminCookie).send({ keyVerified: false }).expect(201);
    await http().get(`/questions/${ids.b}`).expect(404);
  });

  it("marks either option the final key accepts as correct, and hides both while the exam runs", async () => {
    const exam = await http()
      .post("/admin/exams")
      .set("Cookie", adminCookie)
      .send({ slug: `archive-exam-${run}`, title: "Archive", description: "x", mode: "STATIC", durationMinutes: 10 })
      .expect(201);
    await http().post(`/admin/exams/${exam.body.id}/items`).set("Cookie", adminCookie).send({ questionId: ids.a, order: 0 }).expect(201);
    await http().post(`/admin/exams/${exam.body.id}/items`).set("Cookie", adminCookie).send({ questionId: ids.c, order: 1 }).expect(201);
    await http().post(`/admin/exams/${exam.body.id}/publish`).set("Cookie", adminCookie).expect(201);

    const student = await examReadyStudent();
    const started = await http().post(`/exams/${exam.body.id}/start`).set("Cookie", student).expect(201);
    const first = started.body.items[0].question;
    expect(first.correctOption).toBeUndefined();
    expect(first.acceptedOptions).toBeUndefined();
    expect(first.solutionBlocks).toBeUndefined();
    expect(first.passage.blocks[0].text).toBe("A shared reading passage.");

    // 3 is not the stored key (2) but the final key accepts it; 3 on the other question is wrong.
    await http().put(`/attempts/${started.body.id}/answers/${ids.a}`).set("Cookie", student).send({ selectedOption: 3 }).expect(200);
    await http().put(`/attempts/${started.body.id}/answers/${ids.c}`).set("Cookie", student).send({ selectedOption: 3 }).expect(200);
    const score = await http().post(`/attempts/${started.body.id}/submit`).set("Cookie", student).expect(201);
    expect(score.body.correctCount).toBe(1);
    expect(score.body.wrongCount).toBe(1);
  });
});
