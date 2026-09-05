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
    expect(res.body.users.some((u: any) => u.phone === SEED_ADMIN_PHONE)).toBe(true);
  });
});
