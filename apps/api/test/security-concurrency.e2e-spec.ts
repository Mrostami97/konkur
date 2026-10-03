import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/prisma/prisma.service";
import { AssessmentService } from "../src/modules/assessment/assessment.service";
import { PlanningService } from "../src/modules/planning/planning.service";
import { ConsultationsService } from "../src/modules/instructors/consultations.service";
import { AccessService } from "../src/modules/access/access.service";
import { IdentityService } from "../src/modules/identity/identity.service";
import { CommerceService, CARD_TRANSFER_PROVIDER } from "../src/modules/commerce/commerce.service";
import { LearningService } from "../src/modules/learning/learning.service";
import { PaymentStatus } from "@prisma/client";

describe("security concurrency on an explicitly isolated database", () => {
  const db = new PrismaService();
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const assessment = new AssessmentService(db, audit as never, {} as never);
  const access = new AccessService(db);
  const planning = new PlanningService(db, {} as never, access);
  const consultations = new ConsultationsService(db, access, audit as never);
  const learning = new LearningService(db, audit as never, access, {} as never);
  const commerce = new CommerceService(db, audit as never, learning);
  const prefix = `security-${randomUUID()}`;
  let userId: string;
  let formId: string;
  let examId: string;
  let validQuestionId: string;
  let foreignQuestionId: string;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (process.env.SECURITY_TEST_DATABASE !== "1" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("This suite requires SECURITY_TEST_DATABASE=1 and an explicit disposable loopback database");
    }
    await db.$connect();
    const user = await db.user.create({ data: { phone: `${prefix}-student` } });
    userId = user.id;
    const makeQuestion = (suffix: string) => db.question.create({ data: {
      externalId: `${prefix}-${suffix}`, examDegree: "MASTER", examMajor: "computer-engineering", examYear: 1405,
      subjectCode: prefix, topicCodes: [`${prefix}-${suffix}`], stemBlocks: [], options: [],
      correctOption: 2, solutionBlocks: [], provenance: {},
    } });
    validQuestionId = (await makeQuestion("valid")).id;
    foreignQuestionId = (await makeQuestion("foreign")).id;
    const exam = await db.exam.create({ data: {
      slug: prefix, title: "Isolated concurrency fixture", description: "Synthetic test only", mode: "STATIC",
      durationMinutes: 10, forms: { create: { items: { create: { questionId: validQuestionId, order: 1 } } } },
    }, include: { forms: true } });
    examId = exam.id;
    formId = exam.forms[0].id;
  });
  afterAll(async () => { await db.$disconnect(); });

  const attempt = () => db.attempt.create({ data: {
    userId, examId, examFormId: formId, deadlineAt: new Date(Date.now() + 60_000),
  } });

  async function paymentFixture(label: string, status: PaymentStatus = PaymentStatus.AWAITING_REVIEW) {
    const course = await db.course.create({ data: { slug: `${prefix}-${label}`, title: "Synthetic payment course", description: "Isolated fixture" } });
    const product = await db.product.create({ data: {
      slug: `${prefix}-${label}`, title: "Synthetic payment product", description: "Isolated fixture", kind: "COURSE", courseId: course.id,
    } });
    const price = await db.price.create({ data: { productId: product.id, amountRial: 100_000 } });
    const order = await db.order.create({ data: {
      userId, totalAmountRial: price.amountRial,
      items: { create: { productId: product.id, priceId: price.id, amountRial: price.amountRial } },
    } });
    const payment = await db.payment.create({ data: {
      orderId: order.id, provider: CARD_TRANSFER_PROVIDER, providerRef: `${prefix}-${label}`, amountRial: price.amountRial, status,
      ...(status === PaymentStatus.AWAITING_REVIEW ? { receiptTrackingCode: `${prefix}-receipt`, receiptPaidAt: new Date() } : {}),
    } });
    return { course, product, order, payment };
  }

  it("rejects foreign questions and ignores historical foreign mastery evidence", async () => {
    const row = await attempt();
    await expect(assessment.saveAnswer(row.id, userId, foreignQuestionId, 2)).rejects.toThrow("not part");
    expect(await db.answer.count({ where: { attemptId: row.id } })).toBe(0);
    await assessment.saveAnswer(row.id, userId, validQuestionId, 2);
    await assessment.submitAttempt(row.id, userId);
    // Simulate an old invalid record in this disposable fixture only.
    await db.answer.create({ data: { attemptId: row.id, questionId: foreignQuestionId, selectedOption: 2 } });
    await db.masteryState.create({ data: {
      userId, subjectCode: prefix, topicCode: `${prefix}-foreign`, masteryScore: 1,
      confidence: "LOW", evidenceCount: 1, ruleVersion: "mastery-rule.v1",
    } });
    const states = await planning.computeMastery(userId);
    expect(states.some((s) => s.topicCode === `${prefix}-foreign`)).toBe(false);
    expect(await db.masteryState.count({ where: { userId, topicCode: `${prefix}-foreign` } })).toBe(0);
    expect(states.find((s) => s.topicCode === `${prefix}-valid`)?.ruleVersion).toBe("mastery-rule.v2");
    const psychometrics = await assessment.getPsychometrics(examId);
    expect(psychometrics.items.some((item) => item.questionId === foreignQuestionId)).toBe(false);
    expect(psychometrics.items.find((item) => item.questionId === validQuestionId)?.sampleSize).toBe(1);
  });

  it("keeps answers and grading consistent under overlapping save/submit", async () => {
    for (let i = 0; i < 5; i++) {
      const row = await attempt();
      const calls = i % 2 === 0
        ? [assessment.saveAnswer(row.id, userId, validQuestionId, 2), assessment.submitAttempt(row.id, userId)]
        : [assessment.submitAttempt(row.id, userId), assessment.saveAnswer(row.id, userId, validQuestionId, 2)];
      await Promise.allSettled(calls);
      const finalized = await db.attempt.findUniqueOrThrow({ where: { id: row.id }, include: { answers: true, score: true } });
      expect(finalized.status).toBe("SUBMITTED");
      expect(finalized.score).not.toBeNull();
      expect(finalized.score!.correctCount).toBe(finalized.answers.some((a) => a.selectedOption === 2) ? 1 : 0);
      await expect(assessment.saveAnswer(row.id, userId, validQuestionId, 1)).rejects.toThrow("no longer");
      expect(await db.score.count({ where: { attemptId: row.id } })).toBe(1);
    }
  });

  it("allows exactly one concurrent booking against one remaining session", async () => {
    const instructor = await db.contributorProfile.create({ data: { slug: prefix, displayName: "Synthetic instructor" } });
    const product = await db.product.create({ data: { slug: prefix, title: "Synthetic package", description: "Test", kind: "CONSULTATION" } });
    const offering = await db.consultationOffering.create({ data: {
      productId: product.id, instructorProfileId: instructor.id, kind: "SINGLE_SESSION", sessionQuota: 1,
      headline: "Test session", description: "Synthetic", durationMinutes: 45,
    } });
    const entitlement = await db.entitlement.create({ data: { userId, productId: product.id, grantedVia: "MANUAL" } });
    const dto = { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] };
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => consultations.requestBooking(userId, dto)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.consultationBooking.count({ where: { entitlementId: entitlement.id } })).toBe(1);
  });

  it("accepts one concurrent receipt and fulfils one payment exactly once", async () => {
    const f = await paymentFixture("payment-once", PaymentStatus.PENDING);
    const receipts = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => commerce.submitReceipt(userId, f.order.id, {
      trackingCode: `${prefix}-transfer-${index}`, paidAt: new Date().toISOString(),
    })));
    expect(receipts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const reviewed = await db.payment.findUniqueOrThrow({ where: { id: f.payment.id } });
    expect(reviewed.status).toBe(PaymentStatus.AWAITING_REVIEW);
    expect(await db.entitlement.count({ where: { userId, productId: f.product.id } })).toBe(0);

    const confirmations = await Promise.allSettled(Array.from({ length: 6 }, () => commerce.confirmPayment(userId, f.payment.id)));
    expect(confirmations.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("PAID");
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).status).toBe(PaymentStatus.SUCCEEDED);
    expect(await db.entitlement.count({ where: { userId, productId: f.product.id, grantedVia: "ORDER" } })).toBe(1);
    expect(await db.enrollment.count({ where: { userId, courseId: f.course.id, revokedAt: null } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { eventType: "EntitlementActivated", payload: { path: ["orderId"], equals: f.order.id } } })).toBe(1);
    await expect(commerce.rejectPayment(userId, f.payment.id, "Synthetic stale rejection")).rejects.toThrow("confirmed payment");
    await expect(commerce.submitReceipt(userId, f.order.id, { trackingCode: "late-receipt", paidAt: new Date().toISOString() })).rejects.toThrow("already paid");
  });

  it("never leaves a rejected payment with fulfilled access when review actions overlap", async () => {
    for (let index = 0; index < 3; index += 1) {
      const f = await paymentFixture(`payment-review-${index}`);
      const actions = index % 2 === 0
        ? [commerce.confirmPayment(userId, f.payment.id), commerce.rejectPayment(userId, f.payment.id, "Synthetic rejected transfer")]
        : [commerce.rejectPayment(userId, f.payment.id, "Synthetic rejected transfer"), commerce.confirmPayment(userId, f.payment.id)];
      const results = await Promise.allSettled(actions);
      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      const payment = await db.payment.findUniqueOrThrow({ where: { id: f.payment.id } });
      const paid = payment.status === PaymentStatus.SUCCEEDED;
      expect([PaymentStatus.SUCCEEDED, PaymentStatus.REJECTED]).toContain(payment.status);
      expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe(paid ? "PAID" : "PENDING");
      expect(await db.entitlement.count({ where: { userId, productId: f.product.id } })).toBe(paid ? 1 : 0);
      expect(await db.enrollment.count({ where: { userId, courseId: f.course.id } })).toBe(paid ? 1 : 0);
      expect(await db.outboxEvent.count({ where: { eventType: "EntitlementActivated", payload: { path: ["orderId"], equals: f.order.id } } })).toBe(paid ? 1 : 0);
    }
    const cancelled = await paymentFixture("payment-cancelled");
    await db.order.update({ where: { id: cancelled.order.id }, data: { status: "CANCELED" } });
    await expect(commerce.confirmPayment(userId, cancelled.payment.id)).rejects.toThrow("cancelled");
    expect(await db.entitlement.count({ where: { userId, productId: cancelled.product.id } })).toBe(0);
  });

  it("keeps spent quota after a completion race and after a missed session", async () => {
    const instructorUser = await db.user.create({ data: { phone: `${prefix}-race-instructor` } });
    const instructor = await db.contributorProfile.create({ data: { slug: `${prefix}-race`, displayName: "Synthetic instructor", userId: instructorUser.id } });
    const product = await db.product.create({ data: { slug: `${prefix}-race`, title: "Synthetic package", description: "Test", kind: "CONSULTATION" } });
    const offering = await db.consultationOffering.create({ data: {
      productId: product.id, instructorProfileId: instructor.id, kind: "SINGLE_SESSION", sessionQuota: 1,
      headline: "Test session", description: "Synthetic", durationMinutes: 45,
    } });
    const entitlement = await db.entitlement.create({ data: { userId, productId: product.id, grantedVia: "MANUAL" } });
    const booking = await consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] });
    await consultations.confirmBooking(instructorUser.id, booking.id, { scheduledAt: new Date(Date.now() + 86400_000).toISOString() });

    type ParticipantLoader = { loadParticipantBooking(user: string, booking: string): Promise<{ id: string; status: string; viewerRole: string }> };
    const loader = consultations as unknown as ParticipantLoader;
    const original = loader.loadParticipantBooking.bind(consultations);
    let release!: () => void; let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readFinished = new Promise<void>((resolve) => { entered = resolve; });
    const spy = jest.spyOn(loader, "loadParticipantBooking").mockImplementationOnce(async (...args) => {
      const result = await original(...args); entered(); await gate; return result;
    });
    const pendingCancel = consultations.cancelBooking(userId, booking.id, "Synthetic concurrent cancellation");
    try {
      await readFinished;
      await consultations.closeBooking(instructorUser.id, booking.id, "COMPLETED");
      release();
      await expect(pendingCancel).rejects.toThrow("changed");
      expect((await db.consultationBooking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("COMPLETED");
      expect(await db.consultationBooking.count({ where: { entitlementId: entitlement.id, status: { not: "CANCELLED" } } })).toBe(1);
      await expect(consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] })).rejects.toThrow("no sessions");
    } finally { release(); spy.mockRestore(); }

    // A missed session also spent the instructor's time; cancellation cannot refund it.
    await db.entitlement.create({ data: { userId, productId: product.id, grantedVia: "MANUAL" } });
    const missed = await consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] });
    await consultations.confirmBooking(instructorUser.id, missed.id, { scheduledAt: new Date(Date.now() + 86400_000).toISOString() });
    await consultations.closeBooking(instructorUser.id, missed.id, "NO_SHOW");
    await expect(consultations.cancelBooking(userId, missed.id, "Synthetic late refund")).rejects.toThrow("missed");
    await expect(consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] })).rejects.toThrow("no sessions");
  });

  it("does not resurrect a cancelled booking from a delayed scheduling request", async () => {
    const instructorUser = await db.user.create({ data: { phone: `${prefix}-schedule-instructor` } });
    const instructor = await db.contributorProfile.create({ data: { slug: `${prefix}-schedule`, displayName: "Synthetic instructor", userId: instructorUser.id } });
    const product = await db.product.create({ data: { slug: `${prefix}-schedule`, title: "Synthetic package", description: "Test", kind: "CONSULTATION" } });
    const offering = await db.consultationOffering.create({ data: {
      productId: product.id, instructorProfileId: instructor.id, kind: "SINGLE_SESSION", sessionQuota: 1,
      headline: "Test session", description: "Synthetic", durationMinutes: 45,
    } });
    await db.entitlement.create({ data: { userId, productId: product.id, grantedVia: "MANUAL" } });
    const booking = await consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] });
    const original = db.consultationBooking.findUnique.bind(db.consultationBooking);
    let release!: () => void; let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const readFinished = new Promise<void>((resolve) => { entered = resolve; });
    const spy = jest.spyOn(db.consultationBooking, "findUnique").mockImplementationOnce((args) =>
      original(args).then(async (result) => { entered(); await gate; return result; }) as never);
    const pendingConfirm = consultations.confirmBooking(instructorUser.id, booking.id, { scheduledAt: new Date(Date.now() + 86400_000).toISOString() });
    try {
      await readFinished;
      await consultations.cancelBooking(userId, booking.id, "Synthetic earlier cancellation");
      release();
      await expect(pendingConfirm).rejects.toThrow("changed");
      expect((await db.consultationBooking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
      // The returned quota pays for a new booking, not a resurrected old one.
      const replacement = await consultations.requestBooking(userId, { offeringId: offering.id, requestedSlots: [new Date(Date.now() + 86400_000).toISOString()] });
      expect(replacement.id).not.toBe(booking.id);
    } finally { release(); spy.mockRestore(); }
  });

  it("consumes an OTP once, bounds concurrent guesses and retires older challenges", async () => {
    const sent: string[] = [];
    const identity = new IdentityService(db, audit as never, { send: async (_phone, code) => { sent.push(code); } });
    const phone = `${prefix}-otp`;
    await identity.requestOtp(phone);
    const first = sent[0];
    await identity.requestOtp(phone);
    const current = sent[1];
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => identity.verifyOtp(phone, current, {})));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(identity.verifyOtp(phone, first, {})).rejects.toThrow();
    await identity.requestOtp(phone);
    const wrong = sent[2] === "000000" ? "000001" : "000000";
    await Promise.allSettled(Array.from({ length: 10 }, () => identity.verifyOtp(phone, wrong, {})));
    const user = await db.user.findUniqueOrThrow({ where: { phone } });
    const pending = await db.otpCode.findFirstOrThrow({ where: { userId: user.id, consumedAt: null } });
    expect(pending.attempts).toBe(5);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });
});
