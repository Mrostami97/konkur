import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { OTP_PROVIDER, OtpProvider } from "../src/modules/identity/otp-provider";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { SMS_GATEWAY, SmsGateway } from "../src/modules/notifications/sms-gateway";
import { normalizePhone } from "../src/modules/identity/phone";
import { seed, SEED_ADMIN_PHONE } from "../src/seed";

class CapturingOtpProvider implements OtpProvider {
  public sent: { phone: string; code: string }[] = [];
  public fail = false;
  async send(phone: string, code: string): Promise<void> {
    if (this.fail) throw new Error("gateway down");
    this.sent.push({ phone, code });
  }
}

class FakeGateway implements SmsGateway {
  readonly name = "fake";
  readonly delivers = true;
  public sent: { phone: string; template: string; tokens: string[] }[] = [];
  public failFor = new Set<string>();
  async send(phone: string, template: string, tokens: string[]) {
    if (this.failFor.has(phone)) throw new Error("operator rejected the message");
    this.sent.push({ phone, template, tokens });
    return { messageId: String(this.sent.length) };
  }
}

function randomMobile(): string {
  return `0915${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const toPersian = (value: string) => value.replace(/\d/g, (digit) => PERSIAN[Number(digit)]);

describe("Login numbers and SMS notifications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: CapturingOtpProvider;
  let gateway: FakeGateway;
  let notifications: NotificationsService;
  let adminCookie: string;
  let productId: string;
  const adminAlertPhone = normalizePhone(randomMobile());
  const suffix = Date.now();
  const savedEnv = { ...process.env };

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otp.sent[otp.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return { cookie: res.headers["set-cookie"][0] as string, user: res.body.user as { id: string; phone: string } };
  }

  beforeAll(async () => {
    Object.assign(process.env, {
      SMS_TEMPLATE_PAYMENT_CONFIRMED: "payment-ok",
      SMS_TEMPLATE_PAYMENT_RECEIPT_SUBMITTED: "receipt-in",
      SMS_ADMIN_PHONES: adminAlertPhone,
    });
    delete process.env.SMS_TEMPLATE_PAYMENT_REJECTED;

    otp = new CapturingOtpProvider();
    gateway = new FakeGateway();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OTP_PROVIDER)
      .useValue(otp)
      .overrideProvider(SMS_GATEWAY)
      .useValue(gateway)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    await seed();
    adminCookie = (await login(SEED_ADMIN_PHONE)).cookie;

    const product = await prisma.product.create({
      data: {
        slug: `sms-product-${suffix}`,
        title: "SMS product",
        description: "d",
        kind: "QUESTION_BANK",
        questionBankGrants: { create: [{ subjectCode: `sms-subject-${suffix}` }] },
        prices: { create: [{ amountRial: 1_000_000, isActive: true }] },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    process.env = savedEnv;
    await app.close();
  });

  it("treats every spelling of a mobile number as the same account", () => {
    expect(normalizePhone("09121234567")).toBe("+989121234567");
    expect(normalizePhone("۰۹۱۲ ۱۲۳ ۴۵۶۷")).toBe("+989121234567");
    expect(normalizePhone("+98 912-123-4567")).toBe("+989121234567");
    expect(normalizePhone("00989121234567")).toBe("+989121234567");
    expect(normalizePhone("9121234567")).toBe("+989121234567");
    expect(normalizePhone("989121234567")).toBe("+989121234567");
  });

  it("signs the same person in whichever way they type their number and code", async () => {
    const local = randomMobile();
    const first = await login(local);
    expect(first.user.phone).toBe(normalizePhone(local));

    await request(app.getHttpServer())
      .post("/auth/otp/request")
      .send({ phone: toPersian(local) })
      .expect(200)
      .expect((res) => expect(res.body.phone).toBe(normalizePhone(local)));
    const code = otp.sent[otp.sent.length - 1].code;
    const second = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone: `+98${local.slice(1)}`, code: toPersian(code) })
      .expect(200);
    expect(second.body.user.id).toBe(first.user.id);
    expect(await prisma.user.count({ where: { phone: { contains: local.slice(1) } } })).toBe(1);
  });

  it("limits how often one number can be sent a code, and a failed send does not count", async () => {
    process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";
    try {
      const phone = randomMobile();
      otp.fail = true;
      await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(500);
      otp.fail = false;

      const ok = await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
      expect(ok.body.resendAfterSeconds).toBe(60);
      const again = await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(429);
      expect(again.body.code).toBe("OTP_COOLDOWN");
      expect(again.body.retryAfterSeconds).toBeGreaterThan(0);
      expect(again.body.retryAfterSeconds).toBeLessThanOrEqual(60);
    } finally {
      otp.fail = false;
      delete process.env.OTP_RESEND_COOLDOWN_SECONDS;
    }
  });

  it("texts the operator a new receipt and the buyer their confirmation, only after the event commits", async () => {
    const buyer = await login(randomMobile());
    const order = await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", buyer.cookie)
      .send({ productId })
      .expect(201);
    const payment = order.body.payments[0];

    await request(app.getHttpServer())
      .post(`/me/orders/${order.body.id}/receipt`)
      .set("Cookie", buyer.cookie)
      .send({ trackingCode: "TRK-SMS-1", paidAt: new Date().toISOString() })
      .expect(201);
    const alert = await prisma.smsMessage.findFirstOrThrow({
      where: { phone: adminAlertPhone, kind: "PAYMENT_RECEIPT_SUBMITTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(alert.tokens).toEqual([payment.referenceCode]);

    // A second confirm fails inside the transaction and must not text again.
    await request(app.getHttpServer()).post(`/admin/payments/${payment.id}/confirm`).set("Cookie", adminCookie).expect(201);
    await request(app.getHttpServer()).post(`/admin/payments/${payment.id}/confirm`).set("Cookie", adminCookie).expect(400);
    const confirmations = await prisma.smsMessage.findMany({ where: { userId: buyer.user.id, kind: "PAYMENT_CONFIRMED" } });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]).toMatchObject({ phone: buyer.user.phone, status: "PENDING", tokens: [payment.referenceCode] });

    await notifications.dispatch();
    expect(gateway.sent).toEqual(
      expect.arrayContaining([
        { phone: buyer.user.phone, template: "payment-ok", tokens: [payment.referenceCode] },
        { phone: adminAlertPhone, template: "receipt-in", tokens: [payment.referenceCode] },
      ]),
    );
    const sent = await prisma.smsMessage.findUniqueOrThrow({ where: { id: confirmations[0].id } });
    expect(sent).toMatchObject({ status: "SENT", provider: "fake", attempts: 1 });
    expect(sent.providerMessageId).toBeTruthy();
    expect(sent.sentAt).not.toBeNull();
  });

  it("records a message with no template as skipped, and sends it once the template is set and it is retried", async () => {
    const buyer = await login(randomMobile());
    const order = await request(app.getHttpServer()).post("/checkout").set("Cookie", buyer.cookie).send({ productId }).expect(201);
    const payment = order.body.payments[0];
    await request(app.getHttpServer())
      .post(`/me/orders/${order.body.id}/receipt`)
      .set("Cookie", buyer.cookie)
      .send({ trackingCode: "TRK-SMS-2", paidAt: new Date().toISOString() })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/reject`)
      .set("Cookie", adminCookie)
      .send({ reason: "not on the statement" })
      .expect(201);

    await notifications.dispatch();
    const skipped = await prisma.smsMessage.findFirstOrThrow({ where: { userId: buyer.user.id, kind: "PAYMENT_REJECTED" } });
    expect(skipped.status).toBe("SKIPPED");
    expect(skipped.lastError).toContain("SMS_TEMPLATE_PAYMENT_REJECTED");

    process.env.SMS_TEMPLATE_PAYMENT_REJECTED = "payment-no";
    const retried = await request(app.getHttpServer())
      .post(`/admin/notifications/sms/${skipped.id}/retry`)
      .set("Cookie", adminCookie)
      .expect(201);
    expect(retried.body).toEqual({ requeued: true });
    await notifications.dispatch();
    expect(await prisma.smsMessage.findUniqueOrThrow({ where: { id: skipped.id } })).toMatchObject({ status: "SENT" });
    expect(gateway.sent).toContainEqual({ phone: buyer.user.phone, template: "payment-no", tokens: [payment.referenceCode] });
  });

  it("retries a failed delivery and gives up after five attempts", async () => {
    const phone = normalizePhone(randomMobile());
    gateway.failFor.add(phone);
    await notifications.enqueue([{ kind: "PAYMENT_CONFIRMED", phone, tokens: ["ABCD2345"] }]);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await notifications.dispatch();
      const row = await prisma.smsMessage.findFirstOrThrow({ where: { phone } });
      expect(row.attempts).toBe(attempt);
      expect(row.status).toBe(attempt < 5 ? "PENDING" : "FAILED");
      expect(row.lastError).toContain("operator rejected");
    }
  });

  it("shows the SMS setup and log to admins only", async () => {
    const student = await login(randomMobile());
    await request(app.getHttpServer()).get("/admin/notifications/status").set("Cookie", student.cookie).expect(403);
    await request(app.getHttpServer()).get("/admin/notifications/sms").expect(401);

    const status = await request(app.getHttpServer()).get("/admin/notifications/status").set("Cookie", adminCookie).expect(200);
    expect(status.body).toMatchObject({ provider: "fake", delivers: true, adminPhones: 1 });
    expect(status.body.kinds).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "PAYMENT_CONFIRMED", templateConfigured: true })]),
    );
    // The key itself is never part of the answer.
    expect(JSON.stringify(status.body)).not.toContain("SMS_API_KEY");

    const list = await request(app.getHttpServer())
      .get("/admin/notifications/sms?status=FAILED&pageSize=5")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(list.body.items.every((row: { status: string }) => row.status === "FAILED")).toBe(true);
    expect(list.body.counts.FAILED).toBeGreaterThanOrEqual(1);
    await request(app.getHttpServer()).get("/admin/notifications/sms?status=BOGUS").set("Cookie", adminCookie).expect(400);
  });
});
