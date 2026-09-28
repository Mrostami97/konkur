import "reflect-metadata";
import { createHash } from "crypto";
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

/** A mobile number no other suite uses, typed the way people type it. */
function randomMobile(): string {
  return `0935${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

describe("Admin operations: users, roles and safe deletes (e2e)", () => {
  let app: INestApplication;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let adminId: string;
  const run = Date.now();

  const http = () => request(app.getHttpServer());
  const asAdmin = (method: "get" | "post" | "put" | "patch" | "delete", path: string) =>
    http()[method](path).set("Cookie", adminCookie);

  async function login(phone: string) {
    await http().post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await http().post("/auth/otp/verify").send({ phone, code }).expect(200);
    return { cookie: res.headers["set-cookie"][0] as string, id: res.body.user.id as string };
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
    const admin = await login(SEED_ADMIN_PHONE);
    adminCookie = admin.cookie;
    adminId = admin.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("users and roles", () => {
    it("creates a user, refuses the same number in another form, and finds it by search", async () => {
      const phone = randomMobile();
      const created = await asAdmin("post", "/admin/users")
        .send({ phone, firstName: "کاربر", lastName: "آزمون", roles: ["AUTHOR"] })
        .expect(201);
      expect(created.body).toMatchObject({ phone, name: "کاربر آزمون", roles: ["AUTHOR"], hasPassword: false });

      await asAdmin("post", "/admin/users").send({ phone: `+98${phone.slice(1)}`, roles: ["STUDENT"] }).expect(409);

      const found = await asAdmin("get", `/admin/users?q=${phone.slice(-7)}&page=1`).expect(200);
      expect(found.body.users.map((user: { id: string }) => user.id)).toContain(created.body.id);
      expect(found.body.total).toBeGreaterThanOrEqual(1);
    });

    it("keeps the unpaged list the entitlement form relies on", async () => {
      const all = await asAdmin("get", "/admin/users").expect(200);
      expect(Array.isArray(all.body.users)).toBe(true);
      expect(all.body.users.some((user: { phone: string }) => user.phone === SEED_ADMIN_PHONE)).toBe(true);
    });

    it("sets a password that signs the person in and ends their other sessions", async () => {
      const phone = randomMobile();
      const user = await asAdmin("post", "/admin/users").send({ phone, roles: ["STUDENT"] }).expect(201);
      const otp = await login(phone);
      await http().get("/auth/me").set("Cookie", otp.cookie).expect(200);

      await asAdmin("post", `/admin/users/${user.body.id}/password`).send({ password: "short" }).expect(400);
      const set = await asAdmin("post", `/admin/users/${user.body.id}/password`).send({ password: "a-good-password" }).expect(201);
      expect(set.body.sessionsRevoked).toBeGreaterThanOrEqual(1);

      // The old session is gone; the new password works.
      await http().get("/auth/me").set("Cookie", otp.cookie).expect(401);
      await http().post("/auth/password/login").send({ phone, password: "a-good-password" }).expect(200);
    });

    it("changes roles but never strips the acting admin or the last admin", async () => {
      const phone = randomMobile();
      const user = await asAdmin("post", "/admin/users").send({ phone, roles: ["STUDENT"] }).expect(201);
      // A student is not staff: the two are never combined on one account.
      await asAdmin("put", `/admin/users/${user.body.id}/roles`).send({ roles: ["STUDENT", "FINANCE"] }).expect(400);
      const updated = await asAdmin("put", `/admin/users/${user.body.id}/roles`).send({ roles: ["FINANCE"] }).expect(200);
      expect(updated.body.roles).toEqual(["FINANCE"]);

      await asAdmin("put", `/admin/users/${adminId}/roles`).send({ roles: ["STUDENT"] }).expect(400);
    });

    it("is closed to everyone but administrators", async () => {
      const student = await login(randomMobile());
      await http().get("/admin/users?page=1").set("Cookie", student.cookie).expect(403);
      await http().post("/admin/users").set("Cookie", student.cookie).send({ phone: randomMobile(), roles: ["ADMIN"] }).expect(403);
      await http().put(`/admin/users/${student.id}/roles`).set("Cookie", student.cookie).send({ roles: ["ADMIN"] }).expect(403);
    });
  });

  describe("courses and lessons", () => {
    async function makeCourse() {
      const course = await asAdmin("post", "/admin/courses")
        .send({ slug: `ops-course-${run}-${Math.floor(Math.random() * 1e6)}`, title: "Ops course", description: "e2e", accessMode: "ENTITLEMENT" })
        .expect(201);
      const mod = await asAdmin("post", `/admin/courses/${course.body.id}/modules`).send({ title: "Module", order: 1 }).expect(201);
      const lessons: string[] = [];
      for (const title of ["A", "B", "C"]) {
        const lesson: request.Response = await asAdmin("post", `/admin/modules/${mod.body.id}/lessons`)
          .send({ title, order: lessons.length + 1, contentBlocks: [{ type: "text", text: title }] })
          .expect(201);
        lessons.push(lesson.body.id as string);
      }
      return { courseId: course.body.id as string, moduleId: mod.body.id as string, lessons };
    }

    it("reorders lessons, renames and deletes what nobody has studied", async () => {
      const { courseId, moduleId, lessons } = await makeCourse();
      await asAdmin("put", `/admin/modules/${moduleId}/lesson-order`).send({ lessonIds: [lessons[2], lessons[0]] }).expect(400);
      await asAdmin("put", `/admin/modules/${moduleId}/lesson-order`).send({ lessonIds: [lessons[2], lessons[0], lessons[1]] }).expect(200);
      const list = await asAdmin("get", "/admin/courses").expect(200);
      const titles = list.body
        .find((course: { id: string }) => course.id === courseId)
        .modules[0].lessons.map((lesson: { title: string }) => lesson.title);
      expect(titles).toEqual(["C", "A", "B"]);

      await asAdmin("patch", `/admin/modules/${moduleId}`).send({ title: "Renamed" }).expect(200);
      await asAdmin("delete", `/admin/lessons/${lessons[1]}`).expect(200);
      await asAdmin("delete", `/admin/modules/${moduleId}`).expect(200);
      await asAdmin("delete", `/admin/courses/${courseId}`).expect(200);
      await asAdmin("delete", `/admin/courses/${courseId}`).expect(404);
    });

    it("refuses to delete a course with enrolled students, but unpublishes it", async () => {
      const { courseId, lessons } = await makeCourse();
      await asAdmin("post", `/admin/courses/${courseId}/publish`).expect(201);
      const product = await asAdmin("post", "/admin/products")
        .send({ slug: `ops-product-${run}`, title: "Ops product", description: "e2e", kind: "COURSE", courseId })
        .expect(201);
      const student = await login(randomMobile());
      await asAdmin("post", "/admin/entitlements/grant")
        .send({ userId: student.id, productId: product.body.id, grantedVia: "GIFT", reason: "e2e" })
        .expect(201);
      await http().get(`/lessons/${lessons[0]}`).set("Cookie", student.cookie).expect(200);

      const refused = await asAdmin("delete", `/admin/courses/${courseId}`).expect(409);
      expect(refused.body.message).toMatch(/ثبت‌نام/);
      await asAdmin("delete", `/admin/lessons/${lessons[0]}`).expect(409);

      // The product has an entitlement, so it can be switched off but not removed.
      await asAdmin("delete", `/admin/products/${product.body.id}`).expect(409);
      const off = await asAdmin("post", `/admin/products/${product.body.id}/deactivate`).expect(201);
      expect(off.body.isActive).toBe(false);

      const unpublished = await asAdmin("post", `/admin/courses/${courseId}/unpublish`).expect(201);
      expect(unpublished.body.isPublished).toBe(false);
    });

    it("keeps authors out of course deletion", async () => {
      const phone = randomMobile();
      const author = await asAdmin("post", "/admin/users").send({ phone, roles: ["AUTHOR"] }).expect(201);
      await asAdmin("post", `/admin/users/${author.body.id}/password`).send({ password: "author-password" }).expect(201);
      const session = await http().post("/auth/password/login").send({ phone, password: "author-password" }).expect(200);
      const cookie = session.headers["set-cookie"][0] as string;
      const { courseId } = await makeCourse();
      await http().delete(`/admin/courses/${courseId}`).set("Cookie", cookie).expect(403);
      await http().post(`/admin/courses/${courseId}/unpublish`).set("Cookie", cookie).expect(201);
    });
  });

  describe("exams", () => {
    it("removes items, unpublishes and deletes an exam nobody has sat", async () => {
      const job = await asAdmin("post", "/admin/questions")
        .send({
          external_id: `ops-q-${run}`,
          exam: { degree: "master", major: "computer-engineering", year: 1405 },
          subject_code: "algorithms",
          topic_codes: ["sorting"],
          stem_blocks: [{ type: "text", text: "مرتبهٔ $O(n \\log n)$ مال کدام است؟" }],
          options: [1, 2, 3, 4].map((number) => ({ number, blocks: [{ type: "text", text: `گزینهٔ ${number}` }] })),
          correct_option: 1,
          solution_blocks: [{ type: "text", text: "ادغامی: $$T(n)=2T(n/2)+n$$" }],
        })
        .expect(201);
      const items = await asAdmin("get", `/admin/import/${job.body.id}/items`).expect(200);
      const itemIds = (Array.isArray(items.body) ? items.body : items.body.items).map((item: { id: string }) => item.id);
      await asAdmin("post", "/admin/import/items/review").send({ itemIds, decision: "APPROVE" }).expect(201);
      await asAdmin("post", `/admin/import/${job.body.id}/publish`).expect(201);
      const bank = await asAdmin("get", `/admin/questions?q=ops-q-${run}`).expect(200);
      const question = bank.body.items.find((row: { externalId: string }) => row.externalId === `ops-q-${run}`);
      expect(question.stemBlocks[0].text).toContain("$O(n \\log n)$");

      const exam = await asAdmin("post", "/admin/exams")
        .send({ slug: `ops-exam-${run}`, title: "Ops exam", description: "e2e", mode: "STATIC", durationMinutes: 5 })
        .expect(201);
      await asAdmin("post", `/admin/exams/${exam.body.id}/items`).send({ questionId: question.id, order: 1 }).expect(201);
      const detail = await asAdmin("get", `/admin/exams/${exam.body.id}`).expect(200);
      expect(detail.body.forms[0].items).toHaveLength(1);
      await asAdmin("delete", `/admin/exams/${exam.body.id}/items/${detail.body.forms[0].items[0].id}`).expect(200);

      await asAdmin("post", `/admin/exams/${exam.body.id}/publish`).expect(201);
      const unpublished = await asAdmin("post", `/admin/exams/${exam.body.id}/unpublish`).expect(201);
      expect(unpublished.body.isPublished).toBe(false);
      await asAdmin("delete", `/admin/exams/${exam.body.id}`).expect(200);
    });
  });

  describe("activity notices", () => {
    it("shows recent signups without anything that identifies the person, and never to themselves", async () => {
      const phone = randomMobile();
      const student = await login(phone);

      const anonymous = await http().get("/site/activity").expect(200);
      const serialized = JSON.stringify(anonymous.body);
      expect(anonymous.body.some((event: { kind: string }) => event.kind === "signup")).toBe(true);
      expect(serialized).not.toContain(phone);
      expect(serialized).not.toContain(student.id);
      for (const event of anonymous.body) {
        expect(Object.keys(event).sort()).toEqual(
          event.kind === "signup" ? ["at", "degree", "field", "id", "kind"] : ["at", "href", "id", "kind", "product"],
        );
      }

      // The newcomer is not told about their own signup.
      const ownId = createHash("sha256").update(`signup:${student.id}`).digest("hex").slice(0, 16);
      expect(anonymous.body.map((event: { id: string }) => event.id)).toContain(ownId);
      const own = await http().get("/site/activity").set("Cookie", student.cookie).expect(200);
      expect(own.body.map((event: { id: string }) => event.id)).not.toContain(ownId);
    });

    it("counts sales made at checkout or by hand, never gifts or what staff give themselves", async () => {
      const subject = `ops-activity-subject-${run}`;
      await asAdmin("post", "/admin/subjects").send({ code: subject, title: "Activity subject" }).expect(201);
      const product = await asAdmin("post", "/admin/products")
        .send({ slug: `ops-activity-${run}`, title: `Activity bank ${run}`, description: "ops", kind: "QUESTION_BANK", questionBankSubjectCodes: [subject] })
        .expect(201);
      const buyer = await login(randomMobile());
      const gifted = await login(randomMobile());
      const grant = (userId: string, grantedVia: "MANUAL" | "GIFT") =>
        asAdmin("post", "/admin/entitlements/grant").send({ userId, productId: product.body.id, grantedVia, reason: "ops activity" }).expect(201);
      const sold = await grant(buyer.id, "MANUAL");
      const gift = await grant(gifted.id, "GIFT");
      const staff = await grant(adminId, "MANUAL");

      const events = (await http().get("/site/activity").expect(200)).body as { id: string; kind: string; product?: string; href?: string }[];
      const idOf = (id: string) => createHash("sha256").update(`purchase:${id}`).digest("hex").slice(0, 16);
      const ids = events.map((event) => event.id);
      expect(ids).toContain(idOf(sold.body.id));
      expect(ids).not.toContain(idOf(gift.body.id));
      expect(ids).not.toContain(idOf(staff.body.id));
      const shown = events.find((event) => event.id === idOf(sold.body.id));
      expect(shown).toMatchObject({ kind: "purchase", product: `Activity bank ${run}`, href: "/questions" });
      expect(JSON.stringify(events)).not.toContain(buyer.id);

      // The buyer is not shown their own purchase.
      const own = (await http().get("/site/activity").set("Cookie", buyer.cookie).expect(200)).body as { id: string }[];
      expect(own.map((event) => event.id)).not.toContain(idOf(sold.body.id));
    });
  });

  describe("products", () => {
    it("refuses a second product with the same slug as a 409, not a 500", async () => {
      const subject = `ops-slug-subject-${run}`;
      await asAdmin("post", "/admin/subjects").send({ code: subject, title: "Slug subject" }).expect(201);
      const body = { slug: `ops-slug-${run}`, title: "Slug bank", description: "ops", kind: "QUESTION_BANK", questionBankSubjectCodes: [subject] };
      await asAdmin("post", "/admin/products").send(body).expect(201);
      const again = await asAdmin("post", "/admin/products").send(body).expect(409);
      expect(again.body.message).toBe("product slug already exists");
    });
  });

  describe("taxonomy", () => {
    it("deletes a subject only after its topics", async () => {
      const code = `ops-subject-${run}`;
      const subject = await asAdmin("post", "/admin/subjects").send({ code, title: "Ops subject" }).expect(201);
      const topic = await asAdmin("post", "/admin/topics").send({ code: `ops-topic-${run}`, title: "Ops topic", subjectCode: code }).expect(201);
      await asAdmin("delete", `/admin/subjects/${subject.body.id}`).expect(409);
      await asAdmin("delete", `/admin/topics/${topic.body.id}`).expect(200);
      await asAdmin("delete", `/admin/subjects/${subject.body.id}`).expect(200);
    });
  });
});
