import type { INestApplication } from "@nestjs/common";
import request from "supertest";

/**
 * Buys a product the way a real buyer does: open the order, state the
 * transfer, and have an operator confirm it.
 *
 * Checkout no longer grants anything on its own -- payment is card-to-card,
 * so the money lands in a bank account nothing here can query and only a
 * person who has seen the statement may confirm it. Tests that used to expect
 * one call to produce access now go through all three steps, because that is
 * what a buyer actually experiences.
 */
export async function purchaseProduct(
  app: INestApplication,
  {
    buyerCookie,
    adminCookie,
    productId,
    trackingCode,
  }: { buyerCookie: string; adminCookie: string; productId: string; trackingCode?: string },
) {
  const checkout = await request(app.getHttpServer())
    .post("/checkout")
    .set("Cookie", buyerCookie)
    .send({ productId })
    .expect(201);

  const orderId: string = checkout.body.id;
  const payment = checkout.body.payments[0];

  await request(app.getHttpServer())
    .post(`/me/orders/${orderId}/receipt`)
    .set("Cookie", buyerCookie)
    .send({
      trackingCode: trackingCode ?? `TRK-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      paidAt: new Date().toISOString(),
      fromCardLast4: "4321",
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/admin/payments/${payment.id}/confirm`)
    .set("Cookie", adminCookie)
    .expect(201);

  return { orderId, paymentId: payment.id as string, referenceCode: payment.referenceCode as string };
}

/** The confirm half of `purchaseProduct`, for a test that has already called
 * checkout itself and wants to assert on what it returned. */
export async function purchaseConfirm(
  app: INestApplication,
  {
    buyerCookie,
    adminCookie,
    orderId,
    paymentId,
  }: { buyerCookie: string; adminCookie: string; orderId: string; paymentId: string },
) {
  await request(app.getHttpServer())
    .post(`/me/orders/${orderId}/receipt`)
    .set("Cookie", buyerCookie)
    .send({
      trackingCode: `TRK-${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      paidAt: new Date().toISOString(),
    })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/admin/payments/${paymentId}/confirm`)
    .set("Cookie", adminCookie)
    .expect(201);
}
