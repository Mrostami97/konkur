import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { seed, SEED_ADMIN_PASSWORD, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  async send(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

function randomPhone(): string {
  const suffix = Math.floor(1_000_000 + Math.random() * 8_999_999);
  return `+9890${suffix}`;
}

describe("Auth + RBAC (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;

  beforeAll(async () => {
    otpProvider = new CapturingOtpProvider();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otpProvider)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await seed();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
    const cookie = res.headers["set-cookie"][0];
    return { cookie, body: res.body };
  }

  it("registers a new user via OTP and creates an audit log + outbox event", async () => {
    const phone = randomPhone();
    const { body } = await loginAs(phone);
    expect(body.user.phone).toBe(phone);
    expect(body.user.roles).toEqual(["STUDENT"]);

    const auditRows = await prisma.auditLog.findMany({ where: { targetId: body.user.id } });
    expect(auditRows.map((r) => r.action)).toEqual(expect.arrayContaining(["user.registered", "auth.login"]));

    const outboxRows = await prisma.outboxEvent.findMany({
      where: { eventType: "UserOnboarded" },
    });
    expect(outboxRows.some((r) => (r.payload as any).phone === phone)).toBe(true);
  });

  it("rejects an invalid OTP code", async () => {
    const phone = randomPhone();
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code: "000000" })
      .expect(401);
  });

  it("GET /auth/me requires a valid session", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);

    const phone = randomPhone();
    const { cookie } = await loginAs(phone);
    const res = await request(app.getHttpServer()).get("/auth/me").set("Cookie", cookie).expect(200);
    expect(res.body.user.phone).toBe(phone);
  });

  it("logout revokes the session", async () => {
    const phone = randomPhone();
    const { cookie } = await loginAs(phone);
    await request(app.getHttpServer()).post("/auth/logout").set("Cookie", cookie).expect(200);
    await request(app.getHttpServer()).get("/auth/me").set("Cookie", cookie).expect(401);
  });

  it("denies /admin/users to a plain student", async () => {
    const phone = randomPhone();
    const { cookie } = await loginAs(phone);
    await request(app.getHttpServer()).get("/admin/users").set("Cookie", cookie).expect(403);
  });

  it("allows /admin/users to the seeded admin", async () => {
    const { cookie } = await loginAs(SEED_ADMIN_PHONE);
    const res = await request(app.getHttpServer())
      .get("/admin/users")
      .set("Cookie", cookie)
      .expect(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    // Newest first, paged: the seeded admin is found by searching for them.
    const found = await request(app.getHttpServer())
      .get(`/admin/users?q=${encodeURIComponent("0" + SEED_ADMIN_PHONE.slice(3))}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(found.body.users.some((u: any) => u.phone === SEED_ADMIN_PHONE)).toBe(true);
    const admins = await request(app.getHttpServer()).get("/admin/users?role=ADMIN&pageSize=100").set("Cookie", cookie).expect(200);
    expect(admins.body.users.every((u: any) => u.roles.includes("ADMIN"))).toBe(true);
    await request(app.getHttpServer()).get("/admin/users?pageSize=500").set("Cookie", cookie).expect(400);
  });

  it("lets an admin grant and revoke roles, audited, but never strand the panel without an admin", async () => {
    const admin = await loginAs(SEED_ADMIN_PHONE);
    const target = await loginAs(randomPhone());
    const targetId = (await request(app.getHttpServer()).get("/auth/me").set("Cookie", target.cookie).expect(200)).body.user.id;

    const granted = await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/roles`)
      .set("Cookie", admin.cookie)
      .send({ role: "AUTHOR" })
      .expect(201);
    expect(granted.body.roles).toEqual(expect.arrayContaining(["STUDENT", "AUTHOR"]));
    // The new role takes effect on the next request.
    await request(app.getHttpServer()).get("/admin/exams").set("Cookie", target.cookie).expect(200);

    const detail = await request(app.getHttpServer()).get(`/admin/users/${targetId}`).set("Cookie", admin.cookie).expect(200);
    expect(detail.body.passwordHash).toBeUndefined();
    expect(detail.body.roles).toContain("AUTHOR");

    await request(app.getHttpServer())
      .delete(`/admin/users/${targetId}/roles/AUTHOR`)
      .set("Cookie", admin.cookie)
      .expect(200);
    await request(app.getHttpServer()).get("/admin/exams").set("Cookie", target.cookie).expect(403);
    await request(app.getHttpServer()).delete(`/admin/users/${targetId}/roles/AUTHOR`).set("Cookie", admin.cookie).expect(404);
    await request(app.getHttpServer()).delete(`/admin/users/${targetId}/roles/WIZARD`).set("Cookie", admin.cookie).expect(400);
    await request(app.getHttpServer()).post(`/admin/users/${targetId}/roles`).set("Cookie", admin.cookie).send({ role: "WIZARD" }).expect(400);

    // A non-admin cannot hand out roles, including to themselves.
    await request(app.getHttpServer())
      .post(`/admin/users/${targetId}/roles`)
      .set("Cookie", target.cookie)
      .send({ role: "ADMIN" })
      .expect(403);

    const adminId = (await request(app.getHttpServer()).get("/auth/me").set("Cookie", admin.cookie).expect(200)).body.user.id;
    await request(app.getHttpServer()).delete(`/admin/users/${adminId}/roles/ADMIN`).set("Cookie", admin.cookie).expect(400);

    const audit = await prisma.auditLog.findMany({ where: { targetId: targetId, action: { in: ["user.role_granted", "user.role_revoked"] } } });
    expect(audit.map((row) => row.action).sort()).toEqual(["user.role_granted", "user.role_revoked"]);
  });

  it("logs the seeded administrator in with the password method", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/password/login")
      .send({ phone: SEED_ADMIN_PHONE, password: SEED_ADMIN_PASSWORD })
      .expect(200);

    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.body.user.phone).toBe(SEED_ADMIN_PHONE);
    expect(res.body.user.roles).toContain("ADMIN");
  });

  it("rejects a wrong password without issuing a session", async () => {
    await request(app.getHttpServer())
      .post("/auth/password/login")
      .send({ phone: SEED_ADMIN_PHONE, password: "not-the-seed-password" })
      .expect(401);
  });
});
