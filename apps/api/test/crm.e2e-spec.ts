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
  return `+9898${suffix}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("CRM + growth loop (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;

  async function login(phone: string, extra?: Record<string, unknown>): Promise<string> {
    await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({ phone, ...extra })
      .expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code })
      .expect(200);
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await seed();
    adminCookie = await login(SEED_ADMIN_PHONE);
  });

  afterAll(async () => {
    await app.close();
  });

  it("denies CRM access to a plain student", async () => {
    const studentCookie = await login(randomPhone());
    await request(app.getHttpServer()).get("/admin/crm/leads").set("Cookie", studentCookie).expect(403);
  });

  it("creates a Lead via the real outbox consumer on signup, with campaign attribution", async () => {
    const suffix = Date.now();
    await request(app.getHttpServer())
      .post("/admin/crm/campaigns")
      .set("Cookie", adminCookie)
      .send({ code: `campaign-${suffix}`, title: "Telegram post", targetUrl: "/courses" })
      .expect(201);

    // A click through the deep link redirects and increments the campaign's count.
    const clickRes = await request(app.getHttpServer()).get(`/r/campaign-${suffix}`).redirects(0);
    expect(clickRes.status).toBe(302);
    expect(clickRes.headers.location).toContain("/courses");
    expect(clickRes.headers.location).toContain(`campaign=campaign-${suffix}`);

    const phone = randomPhone();
    await login(phone, { source: "telegram", campaignCode: `campaign-${suffix}` });

    // The outbox consumer polls every 5s; wait for it rather than assert instantly.
    let lead = null;
    for (let i = 0; i < 15; i++) {
      const user = await prisma.user.findUnique({ where: { phone } });
      lead = user ? await prisma.lead.findUnique({ where: { userId: user.id } }) : null;
      if (lead) break;
      await sleep(1000);
    }
    expect(lead).not.toBeNull();
    expect(lead!.source).toBe("telegram");
    expect(lead!.campaignCode).toBe(`campaign-${suffix}`);
    expect(lead!.stage).toBe("LEAD");

    const campaignsRes = await request(app.getHttpServer())
      .get("/admin/crm/campaigns")
      .set("Cookie", adminCookie)
      .expect(200);
    const campaign = campaignsRes.body.find((c: any) => c.code === `campaign-${suffix}`);
    expect(campaign.clicks).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("recomputes lead stage from real activity, and supports cases/interactions", async () => {
    const phone = randomPhone();
    await login(phone);
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });

    let lead = null;
    for (let i = 0; i < 15; i++) {
      lead = await prisma.lead.findUnique({ where: { userId: user.id } });
      if (lead) break;
      await sleep(1000);
    }
    expect(lead).not.toBeNull();
    expect(lead!.stage).toBe("LEAD");

    // Give the user a Goal, which recomputeStage treats as real engagement.
    await prisma.goal.create({
      data: { userId: user.id, degree: "MASTER", field: "computer-engineering", weeklyHours: 10 },
    });

    const recomputeRes = await request(app.getHttpServer())
      .post(`/admin/crm/leads/${lead!.id}/recompute`)
      .set("Cookie", adminCookie)
      .expect(201);
    expect(recomputeRes.body.stage).toBe("QUALIFIED");

    const caseRes = await request(app.getHttpServer())
      .post(`/admin/crm/leads/${lead!.id}/cases`)
      .set("Cookie", adminCookie)
      .send({ subject: "Support question" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/crm/leads/${lead!.id}/interactions`)
      .set("Cookie", adminCookie)
      .send({ type: "note", note: "Called the student" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/crm/cases/${caseRes.body.id}/resolve`)
      .set("Cookie", adminCookie)
      .expect(201);

    const leadDetail = await request(app.getHttpServer())
      .get(`/admin/crm/leads/${lead!.id}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(leadDetail.body.cases[0].status).toBe("RESOLVED");
    expect(leadDetail.body.interactions).toHaveLength(1);

    const listRes = await request(app.getHttpServer())
      .get("/admin/crm/leads?stage=QUALIFIED")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(listRes.body.some((l: any) => l.id === lead!.id)).toBe(true);
  }, 20000);

  it("produces a real business report from existing data", async () => {
    const res = await request(app.getHttpServer())
      .get("/admin/crm/report")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(res.body.totalUsers).toBeGreaterThan(0);
    expect(typeof res.body.leadsByStage).toBe("object");
    expect(res.body.totalRevenueRial).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.topCampaigns)).toBe(true);
  });
});
