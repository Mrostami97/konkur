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

describe("Discount codes (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpProvider: CapturingOtpProvider;
  let adminCookie: string;
  let productId: string;
  let otherProductId: string;
  let courseId: string;

  const suffix = Date.now();
  const tag = String(suffix).slice(-8);

  async function login(phone: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = otpProvider.sent[otpProvider.sent.length - 1].code;
    const res = await request(app.getHttpServer()).post("/auth/otp/verify").send({ phone, code }).expect(200);
    return res.headers["set-cookie"][0] as string;
  }

  function createCode(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post("/admin/discount-codes").set("Cookie", adminCookie).send(body);
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

    const course = await prisma.course.create({
      data: { slug: `disc-course-${suffix}`, title: "Discounted course", description: "d", isPublished: true },
    });
    courseId = course.id;
    const product = await prisma.product.create({
      data: {
        slug: `disc-product-${suffix}`,
        title: "Discounted course",
        description: "d",
        kind: "COURSE",
        courseId: course.id,
        courseGrants: { create: [{ courseId: course.id }] },
        prices: { create: [{ amountRial: 2_500_000, isActive: true }] },
      },
    });
    productId = product.id;
    const other = await prisma.product.create({
      data: {
        slug: `disc-other-${suffix}`,
        title: "Another product",
        description: "d",
        kind: "COURSE",
        prices: { create: [{ amountRial: 1_000_000, isActive: true }] },
      },
    });
    otherProductId = other.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("is managed by staff only, and a code is stored in capitals", async () => {
    const student = await login(randomPhone());
    await request(app.getHttpServer())
      .post("/admin/discount-codes")
      .set("Cookie", student)
      .send({ code: `NOPE${tag}`, percentOff: 10 })
      .expect(403);

    const res = await createCode({ code: ` pct${tag} `, percentOff: 20 }).expect(201);
    expect(res.body.code).toBe(`PCT${tag}`);
    // The same code twice, or a code with both kinds of discount, is refused.
    await createCode({ code: `PCT${tag}`, percentOff: 5 }).expect(409);
    await createCode({ code: `BOTH${tag}`, percentOff: 5, amountOffRial: 1000 }).expect(400);
  });

  it("quotes and charges the discounted amount, typed in any case", async () => {
    const buyer = await login(randomPhone());
    const quote = await request(app.getHttpServer())
      .post("/checkout/quote")
      .set("Cookie", buyer)
      .send({ productId, discountCode: `pct${tag}` })
      .expect(201);
    expect(quote.body).toEqual({ code: `PCT${tag}`, subtotalRial: 2_500_000, discountRial: 500_000, totalRial: 2_000_000 });

    const order = await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", buyer)
      .send({ productId, discountCode: `pct${tag}` })
      .expect(201);
    expect(order.body.status).toBe("PENDING");
    expect(order.body.totalAmountRial).toBe(2_000_000);
    expect(order.body.discountRial).toBe(500_000);
    expect(order.body.payments[0].amountRial).toBe(2_000_000);
    // The line keeps the list price, so the order shows what was taken off.
    expect(order.body.items[0].amountRial).toBe(2_500_000);

    // One use per buyer by default: the open order holds it.
    await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", buyer)
      .send({ productId, discountCode: `PCT${tag}` })
      .expect(400);
  });

  it("refuses unknown, switched-off, expired, not-yet-started and other-product codes", async () => {
    const buyer = await login(randomPhone());
    const quote = (code: string, id = productId) =>
      request(app.getHttpServer()).post("/checkout/quote").set("Cookie", buyer).send({ productId: id, discountCode: code });

    await quote(`MISSING${tag}`).expect(400);

    const off = await createCode({ code: `OFF${tag}`, percentOff: 10 }).expect(201);
    await request(app.getHttpServer()).patch(`/admin/discount-codes/${off.body.id}`).set("Cookie", adminCookie).send({ isActive: false }).expect(200);
    await quote(`OFF${tag}`).expect(400);

    await createCode({ code: `OLD${tag}`, percentOff: 10, endsAt: new Date(Date.now() - 60_000).toISOString() }).expect(201);
    await quote(`OLD${tag}`).expect(400);

    await createCode({ code: `SOON${tag}`, percentOff: 10, startsAt: new Date(Date.now() + 3_600_000).toISOString() }).expect(201);
    await quote(`SOON${tag}`).expect(400);

    await createCode({ code: `ONLY${tag}`, amountOffRial: 100_000, productIds: [otherProductId] }).expect(201);
    await quote(`ONLY${tag}`).expect(400);
    const ok = await quote(`ONLY${tag}`, otherProductId).expect(201);
    expect(ok.body.totalRial).toBe(900_000);
  });

  it("stops at its total number of uses", async () => {
    await createCode({ code: `ONE${tag}`, amountOffRial: 300_000, maxRedemptions: 1 }).expect(201);
    const first = await login(randomPhone());
    const second = await login(randomPhone());
    await request(app.getHttpServer()).post("/checkout").set("Cookie", first).send({ productId, discountCode: `ONE${tag}` }).expect(201);
    await request(app.getHttpServer()).post("/checkout").set("Cookie", second).send({ productId, discountCode: `ONE${tag}` }).expect(400);
  });

  it("makes an order free when it covers the whole price, and grants access at once", async () => {
    const created = await createCode({ code: `FREE${tag}`, percentOff: 100 }).expect(201);
    const buyer = await login(randomPhone());
    const order = await request(app.getHttpServer())
      .post("/checkout")
      .set("Cookie", buyer)
      .send({ productId, discountCode: `FREE${tag}` })
      .expect(201);
    expect(order.body.status).toBe("PAID");
    expect(order.body.totalAmountRial).toBe(0);
    expect(order.body.payments[0]).toMatchObject({ provider: "discount", status: "SUCCEEDED", amountRial: 0 });

    const entitlements = await request(app.getHttpServer()).get("/me/entitlements").set("Cookie", buyer).expect(200);
    expect(entitlements.body.some((row: { productId: string }) => row.productId === productId)).toBe(true);
    const user = await prisma.user.findFirstOrThrow({ where: { orders: { some: { id: order.body.id } } } });
    expect(await prisma.enrollment.count({ where: { userId: user.id, courseId } })).toBe(1);

    // The admin list counts the use; a used code can only be switched off.
    const list = await request(app.getHttpServer()).get("/admin/discount-codes").set("Cookie", adminCookie).expect(200);
    const row = list.body.find((c: { id: string }) => c.id === created.body.id);
    expect(row).toMatchObject({ paidUses: 1, pendingUses: 0, discountGivenRial: 2_500_000 });
    await request(app.getHttpServer()).delete(`/admin/discount-codes/${created.body.id}`).set("Cookie", adminCookie).expect(409);
  });

  it("deletes a code nobody used", async () => {
    const created = await createCode({ code: `GONE${tag}`, percentOff: 15 }).expect(201);
    await request(app.getHttpServer()).delete(`/admin/discount-codes/${created.body.id}`).set("Cookie", adminCookie).expect(200);
    expect(await prisma.discountCode.count({ where: { id: created.body.id } })).toBe(0);
  });

  it("keeps the price before discount above the price", async () => {
    await request(app.getHttpServer())
      .post(`/admin/products/${otherProductId}/prices`)
      .set("Cookie", adminCookie)
      .send({ amountRial: 1_000_000, compareAtRial: 900_000 })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post(`/admin/products/${otherProductId}/prices`)
      .set("Cookie", adminCookie)
      .send({ amountRial: 1_000_000, compareAtRial: 1_500_000 })
      .expect(201);
    expect(res.body.compareAtRial).toBe(1_500_000);
  });
});
