import "reflect-metadata";
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

const randomPhone = () => `+9897${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

describe("Admissions booklet import and field-selection catalog (e2e)", () => {
  let app: INestApplication;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  let sourceId: string;
  // A set code no real booklet uses, so this suite owns every row it imports.
  const examSet = String(9000 + Math.floor(Math.random() * 999));
  const tag = Date.now().toString(36);
  const university = `دانشگاه آزمایشی ${tag}`;

  const row = (selectionCode: string, overrides: Record<string, unknown> = {}) => ({
    selectionCode,
    examSetCode: examSet,
    coefficientGroup: 4,
    period: "DAILY",
    university,
    universityCity: "تهران",
    city: "تهران",
    program: "مهندسی و علم کامپیوتر گرایش نرم‌افزار",
    orientation: "نرم‌افزار",
    field: "computer-engineering",
    gender: "ANY",
    hasDormitory: false,
    capacityFirstTerm: 10,
    capacitySecondTerm: 0,
    bookletPage: 480,
    ...overrides,
  });
  const booklet = (rows: unknown[]) => Buffer.from(JSON.stringify({ schema_version: "admissions-booklet.v1", examYear: 1405, degree: "MASTER", rows }));
  const upload = (cookie: string, rows: unknown[]) =>
    request(app.getHttpServer()).post("/admin/admissions/import").set("Cookie", cookie).field("sourceId", sourceId).attach("file", booklet(rows), "booklet.json");
  const catalogRows = async () => {
    const res = await request(app.getHttpServer()).get("/admissions/catalog").query({ degree: "master", year: 1405 }).expect(200);
    return (res.body.programs as { examSetCode: string; selectionCode: string; capacity: number; gender: string; period: string; id: string; code: string }[])
      .filter((p) => p.examSetCode === examSet);
  };

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent[otp.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  beforeAll(async () => {
    otp = new CapturingOtpProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OTP_PROVIDER).useValue(otp).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);
    const source = await request(app.getHttpServer())
      .post("/admin/content-sources")
      .set("Cookie", adminCookie)
      .send({
        externalId: `booklet-source-${tag}`,
        kind: "OFFICIAL_ADMISSIONS_BOOKLET",
        title: "دفترچهٔ انتخاب رشتهٔ آزمایشی",
        publisher: "سازمان سنجش (آزمایشی)",
        canonicalUrl: `https://example.test/booklet/${tag}`,
        sourceTier: "PRIMARY_OFFICIAL",
        checkedAt: new Date().toISOString(),
        rightsBasis: "LINK_ONLY",
        mayLink: true,
      })
      .expect(201);
    sourceId = source.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lets only an admin import a booklet", async () => {
    const student = await login(randomPhone());
    await upload(student, [row("90001")]).expect(403);
  });

  it("imports a booklet and lists it in the catalog with its codes", async () => {
    const res = await upload(adminCookie, [
      row("90001"),
      row("90002", { gender: "FEMALE", notes: "فقط زن", capacityFirstTerm: 4, capacitySecondTerm: 2 }),
      // Same programme and place, a different seat: a company grant.
      row("90003", { variant: "بورس شرکت آزمایشی", notes: "بورس شرکت آزمایشی - مصاحبه دارد", capacityFirstTerm: 2 }),
      row("90004", { period: "NON_PROFIT", university: `مؤسسه غیرانتفاعی ${tag}`, universityCity: "کرج", city: "کرج", capacityFirstTerm: 30 }),
      row("90005", { period: "PAYAM_NOOR", location: "واحد ری", city: "ری", capacityFirstTerm: 8 }),
    ]).expect(201);
    expect(res.body).toMatchObject({ rows: 5, universities: 2, programsCreated: 5, programsUpdated: 0, capacitiesRemoved: 0 });

    const rows = await catalogRows();
    expect(rows.map((r) => r.selectionCode).sort()).toEqual(["90001", "90002", "90003", "90004", "90005"]);
    expect(rows.find((r) => r.selectionCode === "90002")).toMatchObject({ capacity: 6, gender: "FEMALE", period: "DAILY" });

    const detail = await request(app.getHttpServer()).get(`/programs/code/${rows.find((r) => r.selectionCode === "90005")!.code}`).expect(200);
    expect(detail.body).toMatchObject({ examSetCode: examSet, period: "PAYAM_NOOR", location: "واحد ری", city: "ری", tuitionType: "PAID", orientation: "نرم‌افزار" });
    expect(detail.body.capacities[0]).toMatchObject({ examYear: 1405, quota: "term-1", capacity: 8, selectionCode: "90005", bookletPage: 480 });
  });

  it("re-imports a corrected file onto the same programs", async () => {
    const before = await catalogRows();
    const res = await upload(adminCookie, [
      row("90001", { capacityFirstTerm: 12 }),
      row("90002", { gender: "FEMALE", notes: "فقط زن", capacityFirstTerm: 4 }),
      row("90003", { variant: "بورس شرکت آزمایشی", notes: "بورس شرکت آزمایشی - مصاحبه دارد", capacityFirstTerm: 2 }),
      row("90005", { period: "PAYAM_NOOR", location: "واحد ری", city: "ری", capacityFirstTerm: 8 }),
    ]).expect(201);
    expect(res.body).toMatchObject({ programsCreated: 0, programsUpdated: 4, capacitiesRemoved: 1 });

    const after = await catalogRows();
    expect(after.map((r) => r.selectionCode).sort()).toEqual(["90001", "90002", "90003", "90005"]);
    expect(after.find((r) => r.selectionCode === "90001")).toMatchObject({ capacity: 12, id: before.find((r) => r.selectionCode === "90001")!.id });
    expect(after.find((r) => r.selectionCode === "90002")!.capacity).toBe(4);
  });

  it("refuses a malformed booklet with a readable reason", async () => {
    const bad = await upload(adminCookie, [row("90001", { period: "NIGHT" })]).expect(400);
    expect(bad.body.message).toContain("ردیف 1");
    const twice = await upload(adminCookie, [row("90001"), row("90001", { capacityFirstTerm: 3 })]).expect(400);
    expect(twice.body.message).toContain("90001");
    const twins = await upload(adminCookie, [row("90001"), row("90009")]).expect(400);
    expect(twins.body.message).toContain("90009");
    await request(app.getHttpServer())
      .post("/admin/admissions/import")
      .set("Cookie", adminCookie)
      .field("sourceId", sourceId)
      .attach("file", Buffer.from("not json"), "booklet.json")
      .expect(400);
  });

  it("caps a choice list at the 100 codes Sanjesh's form takes", async () => {
    const many = Array.from({ length: 101 }, (_, i) => row(String(91000 + i), { program: `برنامهٔ آزمایشی ${i}`, orientation: `گرایش ${i}` }));
    await upload(adminCookie, many).expect(201);
    const programs = (await catalogRows()).filter((r) => r.selectionCode.startsWith("91")).sort((a, b) => a.selectionCode.localeCompare(b.selectionCode));
    expect(programs).toHaveLength(101);

    const student = await login(randomPhone());
    for (const program of programs.slice(0, 100)) {
      await request(app.getHttpServer()).post("/me/choices").set("Cookie", student).send({ programId: program.id }).expect(201);
    }
    // Adding one already on the list is not a new choice.
    await request(app.getHttpServer()).post("/me/choices").set("Cookie", student).send({ programId: programs[0].id }).expect(201);
    const over = await request(app.getHttpServer()).post("/me/choices").set("Cookie", student).send({ programId: programs[100].id }).expect(400);
    expect(over.body.message).toContain("۱۰۰");

    const list = await request(app.getHttpServer()).get("/me/choices").set("Cookie", student).expect(200);
    expect(list.body).toHaveLength(100);
    expect(list.body[0].program.capacities[0]).toMatchObject({ examYear: 1405, selectionCode: "91000" });
  }, 120_000);
});
