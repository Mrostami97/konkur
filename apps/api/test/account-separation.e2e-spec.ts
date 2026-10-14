import { canonicalPhone } from "../src/modules/identity/phone";
import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { PrismaService } from "../src/prisma/prisma.service";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  sent: { phone: string; code: string }[] = [];

  async send(phone: string, code: string) {
    this.sent.push({ phone, code });
  }
}

/** The owner's rule: the main administrator, students and instructors are kept apart. */
describe("Account separation: admin, staff, student, instructor (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let adminCookie: string;
  let suffix: string;

  beforeAll(async () => {
    suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent.at(-1)!.code;
    const response = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return response.headers["set-cookie"][0] as string;
  }

  function randomPhone() {
    return `0916${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  }

  async function signUp() {
    const phone = randomPhone();
    const cookie = await login(phone);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: canonicalPhone(phone) } });
    return { cookie, id: user.id };
  }

  it("keeps a student out of every staff route", async () => {
    const student = await signUp();
    for (const path of ["/admin/users", "/admin/resources", "/admin/payments", "/admin/courses", "/admin/crm/leads"]) {
      const response = await request(app.getHttpServer()).get(path).set("Cookie", student.cookie);
      expect([403, 404]).toContain(response.status);
      expect(response.status).not.toBe(200);
    }
  });

  it("lets an administrator hold every role, and keeps other students apart from staff", async () => {
    const person = await signUp();
    const put = (roles: Role[]) =>
      request(app.getHttpServer()).put(`/admin/users/${person.id}/roles`).set("Cookie", adminCookie).send({ roles });

    // The administrator may be everything at once (owner, 2026-10-12)...
    const everything = await put([Role.ADMIN, Role.STUDENT, Role.AUTHOR, Role.REVIEWER, Role.MENTOR, Role.FINANCE]);
    expect(everything.status).toBe(200);
    expect(everything.body.roles).toHaveLength(6);
    // ...and still reaches staff routes while also a student.
    await request(app.getHttpServer()).get("/admin/resources").set("Cookie", person.cookie).expect(200);
    expect((await put([Role.STUDENT, Role.AUTHOR])).status).toBe(400);
    const staff = await put([Role.AUTHOR, Role.REVIEWER]);
    expect(staff.status).toBe(200);
    expect([...staff.body.roles].sort()).toEqual([Role.AUTHOR, Role.REVIEWER].sort());

    await request(app.getHttpServer())
      .post("/admin/users")
      .set("Cookie", adminCookie)
      .send({ phone: randomPhone(), roles: [Role.STUDENT, Role.FINANCE] })
      .expect(400);
  });

  it("refuses staff routes to an account left holding both student and staff roles", async () => {
    const legacy = await signUp();
    // Written directly, as older data could be; the API no longer creates this.
    await prisma.userRole.create({ data: { userId: legacy.id, role: Role.AUTHOR } });
    await request(app.getHttpServer()).get("/admin/resources").set("Cookie", legacy.cookie).expect(403);

    await request(app.getHttpServer())
      .put(`/admin/users/${legacy.id}/roles`)
      .set("Cookie", adminCookie)
      .send({ roles: [Role.AUTHOR] })
      .expect(200);
    await request(app.getHttpServer()).get("/admin/resources").set("Cookie", legacy.cookie).expect(200);
  });

  it("links a teacher's account by mobile number, typed any way, and unlinks it", async () => {
    const phone = randomPhone();
    await login(phone);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone: canonicalPhone(phone) } });
    // Stored as 09…; typed the international way.
    const typed = `+98 ${phone.slice(1)}`;
    await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({ userPhone: "09000000000", slug: `nobody-${suffix}`, displayName: "Nobody" })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({ userPhone: typed, slug: `phone-teacher-${suffix}`, displayName: "Phone teacher", avatarUrl: "/brand/teacher.webp" })
      .expect(201);
    expect(created.body.userId).toBe(user.id);
    expect(created.body.avatarUrl).toBe("/brand/teacher.webp");
    const listed = await request(app.getHttpServer()).get("/admin/contributors").set("Cookie", adminCookie).expect(200);
    expect(listed.body.find((row: { id: string }) => row.id === created.body.id).userPhone).toBe(user.phone);

    const unlinked = await request(app.getHttpServer())
      .patch(`/admin/contributors/${created.body.id}`)
      .set("Cookie", adminCookie)
      .send({ userPhone: "", avatarUrl: "" })
      .expect(200);
    expect(unlinked.body.userId).toBeNull();
    expect(unlinked.body.avatarUrl).toBeNull();
  });

  it("makes a linked instructor no longer a student; the main admin may also teach", async () => {
    const teacher = await signUp();
    await request(app.getHttpServer())
      .post("/admin/contributors")
      .set("Cookie", adminCookie)
      .send({ userId: teacher.id, slug: `teacher-${suffix}`, displayName: "Teacher" })
      .expect(201);
    const roles = await prisma.userRole.findMany({ where: { userId: teacher.id } });
    expect(roles.map((row) => row.role)).not.toContain(Role.STUDENT);

    await request(app.getHttpServer())
      .put(`/admin/users/${teacher.id}/roles`)
      .set("Cookie", adminCookie)
      .send({ roles: [Role.STUDENT] })
      .expect(400);

    const admin = await prisma.user.findUniqueOrThrow({ where: { phone: SEED_ADMIN_PHONE } });
    const linked = await prisma.contributorProfile.findUnique({ where: { userId: admin.id } });
    if (!linked) {
      await request(app.getHttpServer())
        .post("/admin/contributors")
        .set("Cookie", adminCookie)
        .send({ userId: admin.id, slug: `admin-teacher-${suffix}`, displayName: "Admin" })
        .expect(201);
    }
    // Still the administrator after teaching, and still allowed in.
    const adminRoles = await prisma.userRole.findMany({ where: { userId: admin.id } });
    expect(adminRoles.map((row) => row.role)).toEqual([Role.ADMIN]);
    await request(app.getHttpServer()).get("/admin/users").set("Cookie", adminCookie).expect(200);
    await request(app.getHttpServer()).get("/me/profile").set("Cookie", adminCookie).expect(200);
  });
});
