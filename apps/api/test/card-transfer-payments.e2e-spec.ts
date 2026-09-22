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
  return `+9891${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

describe("Card-to-card payment (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let buyerCookie: string;
  let outsiderCookie: string;
  let productId: string;

  const suffix = Date.now();

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  /** Opens an order and returns the ids the rest of the flow needs. */
  async function openOrder(cookie: string) {
    const res = await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", cookie)
      .send({ productId })
      .expect(201);
    return {
      orderId: res.body.id as string,
      payment: res.body.payments[0] as {
        id: string;
        status: string;
        referenceCode: string;
        bankAccount: { cardNumber: string; holderName: string };
      },
      status: res.body.status as string,
    };
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
    buyerCookie = await login(randomPhone());
    outsiderCookie = await login(randomPhone());

    const course = await prisma.course.create({
      data: { slug: `pay-course-${suffix}`, title: "Paid course", description: "d", isPublished: true },
    });
    const product = await prisma.product.create({
      data: {
        slug: `pay-product-${suffix}`,
        title: "Paid course",
        description: "d",
        kind: "COURSE",
        courseId: course.id,
        courseGrants: { create: [{ courseId: course.id }] },
        prices: { create: [{ amountRial: 2_500_000, isActive: true }] },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("opens an order without granting anything, and hands back where to pay", async () => {
    const { orderId, payment, status } = await openOrder(buyerCookie);

    expect(status).toBe("PENDING");
    expect(payment.status).toBe("PENDING");
    // The buyer needs somewhere to send the money and a code to write on it.
    expect(payment.bankAccount.cardNumber).toMatch(/^[0-9]{16}$/);
    expect(payment.referenceCode).toMatch(/^[A-Z2-9]{8}$/);

    // Nothing was granted. This is the whole point of the change: an order is
    // not a payment.
    const entitlements = await request(app.getHttpServer())
      .get("/me/entitlements")
      .set("Cookie", buyerCookie)
      .expect(200);
    expect(entitlements.body.some((row: { productId: string }) => row.productId === productId)).toBe(false);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PENDING");
  });

  it("never issues the same reference code twice", async () => {
    const first = await openOrder(buyerCookie);
    const second = await openOrder(buyerCookie);
    expect(first.payment.referenceCode).not.toBe(second.payment.referenceCode);
  });

  it("keeps a receipt to the order's own buyer", async () => {
    const { orderId } = await openOrder(buyerCookie);

    // A stranger is told the order does not exist rather than that it is not
    // theirs.
    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", outsiderCookie)
      .send({ trackingCode: "TRK-STRANGER", paidAt: new Date().toISOString() })
      .expect(404);
  });

  it("rejects a transfer dated before the order or in the future", async () => {
    const { orderId } = await openOrder(buyerCookie);

    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: "TRK-PAST", paidAt: new Date(Date.now() - 86_400_000).toISOString() })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: "TRK-FUTURE", paidAt: new Date(Date.now() + 86_400_000).toISOString() })
      .expect(400);
  });

  it("will not let a buyer confirm their own payment", async () => {
    const { payment } = await openOrder(buyerCookie);

    // An order id that does not exist is a 404, not a leak of anything.
    await request(app.getHttpServer())
      .post(`/me/orders/no-such-order/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: "TRK-UNKNOWN", paidAt: new Date().toISOString() })
      .expect(404);

    // The confirm endpoint is staff-only. Without this, the whole card flow
    // would be a buyer marking their own order paid.
    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/confirm`)
      .set("Cookie", buyerCookie)
      .expect(403);
  });

  it("grants access only once an operator confirms, and not twice", async () => {
    const { orderId, payment } = await openOrder(buyerCookie);

    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: `TRK-${suffix}`, paidAt: new Date().toISOString(), fromCardLast4: "1234" })
      .expect(201);

    // It is in the operator's queue, still granting nothing.
    const queue = await request(app.getHttpServer())
      .get("/admin/payments?status=AWAITING_REVIEW")
      .set("Cookie", adminCookie)
      .expect(200);
    expect(queue.body.some((row: { id: string }) => row.id === payment.id)).toBe(true);

    let order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PENDING");

    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/confirm`)
      .set("Cookie", adminCookie)
      .expect(201);

    order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");

    const entitlements = await request(app.getHttpServer())
      .get("/me/entitlements")
      .set("Cookie", buyerCookie)
      .expect(200);
    expect(entitlements.body.some((row: { productId: string }) => row.productId === productId)).toBe(true);

    const before = await prisma.entitlement.count({ where: { userId: (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).userId } });

    // Confirming again must not grant a second entitlement.
    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/confirm`)
      .set("Cookie", adminCookie)
      .expect(400);

    const after = await prisma.entitlement.count({ where: { userId: (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).userId } });
    expect(after).toBe(before);
  });

  it("lets a rejected buyer correct their claim and try again", async () => {
    const { orderId, payment } = await openOrder(buyerCookie);

    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: "TRK-WRONG", paidAt: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/reject`)
      .set("Cookie", adminCookie)
      .send({ reason: "این کد رهگیری در صورت‌حساب پیدا نشد" })
      .expect(201);

    let stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("REJECTED");
    expect(stored.rejectionReason).toContain("صورت‌حساب");

    // The usual reason for a rejection is a mistyped code, so resubmission is
    // allowed and clears the previous verdict.
    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: "TRK-CORRECTED", paidAt: new Date().toISOString() })
      .expect(201);

    stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("AWAITING_REVIEW");
    expect(stored.rejectionReason).toBeNull();
    expect(stored.receiptTrackingCode).toBe("TRK-CORRECTED");
  });

  it("refuses to reject a payment that was already confirmed", async () => {
    const { orderId, payment } = await openOrder(buyerCookie);
    await request(app.getHttpServer())
      .post(`/me/orders/${orderId}/receipt`)
      .set("Cookie", buyerCookie)
      .send({ trackingCode: `TRK-FINAL-${suffix}`, paidAt: new Date().toISOString() })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/confirm`)
      .set("Cookie", adminCookie)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/payments/${payment.id}/reject`)
      .set("Cookie", adminCookie)
      .send({ reason: "changed my mind" })
      .expect(400);
  });

  it("refuses to open an order when no card is configured to receive money", async () => {
    await prisma.bankAccount.updateMany({ data: { isActive: false } });
    try {
      await request(app.getHttpServer())
        .post("/checkout")
        .set("Cookie", buyerCookie)
        .send({ productId })
        .expect(400);
    } finally {
      await prisma.bankAccount.updateMany({ data: { isActive: true } });
    }
  });

  it("keeps destination cards out of reach of buyers", async () => {
    await request(app.getHttpServer()).get("/admin/bank-accounts").set("Cookie", buyerCookie).expect(403);
    await request(app.getHttpServer())
      .post("/admin/bank-accounts")
      .set("Cookie", buyerCookie)
      .send({ bankName: "x", holderName: "y", cardNumber: "6037000000000000" })
      .expect(403);
  });
});
