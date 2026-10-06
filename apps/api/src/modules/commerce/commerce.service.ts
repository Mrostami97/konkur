import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { EntitlementGrantSource, OrderStatus, PaymentStatus, ProductKind } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LearningService } from "../learning/learning.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { BankAccountDto } from "./dto/bank-account.dto";
import { SubmitReceiptDto } from "./dto/submit-receipt.dto";

/** Recorded on Payment.provider so the card flow's rows stay distinguishable
 * from anything a future online gateway writes. */
export const CARD_TRANSFER_PROVIDER = "card-transfer";

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly learning: LearningService,
  ) {}

  // --- Admin catalog management ---------------------------------------------

  /** An inactive product leaves the store and cannot be bought; what people
   * already bought stays theirs. */
  async setProductActive(actorId: string, productId: string, isActive: boolean) {
    const product = await this.prisma.product.update({ where: { id: productId }, data: { isActive } }).catch(() => null);
    if (!product) throw new NotFoundException("product not found");
    await this.audit.log({
      actorUserId: actorId,
      action: isActive ? "product.activated" : "product.deactivated",
      targetType: "Product",
      targetId: productId,
    });
    return product;
  }

  /** Orders and entitlements are financial and access records; a product
   * anyone has ordered or holds is deactivated, never deleted. */
  async deleteProduct(actorId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true, _count: { select: { orderItems: true, entitlements: true } } },
    });
    if (!product) throw new NotFoundException("product not found");
    if (product._count.orderItems + product._count.entitlements > 0) {
      throw new ConflictException("این محصول سفارش یا دسترسی ثبت‌شده دارد و سوابق مالی به آن وابسته‌اند؛ به‌جای حذف، غیرفعالش کنید.");
    }
    await this.prisma.product.delete({ where: { id: productId } });
    await this.audit.log({ actorUserId: actorId, action: "product.deleted", targetType: "Product", targetId: productId, metadata: { slug: product.slug } });
    return { deleted: true };
  }

  async createProduct(actorId: string, dto: CreateProductDto) {
    const courseIds = [...new Set([...(dto.courseIds ?? []), ...(dto.courseId ? [dto.courseId] : [])])];
    const resourceIds = [...new Set(dto.resourceIds ?? [])];
    // Bank access is SUBJECT-scoped (owner decision): a grant unlocks the
    // bank for one subject. The bank is sold separately from courses (owner,
    // 2026-10-06): a COURSE product grants its course and nothing else, a
    // QUESTION_BANK product exactly one subject, and a course sold together
    // with its bank is a BUNDLE like any other combination.
    const bankSubjectCodes = [...new Set(dto.questionBankSubjectCodes ?? [])];
    if (dto.kind === "COURSE" && (courseIds.length !== 1 || resourceIds.length > 0 || bankSubjectCodes.length > 0)) {
      throw new BadRequestException("COURSE products must grant exactly one course");
    }
    if (
      dto.kind === "RESOURCE" &&
      (resourceIds.length !== 1 || courseIds.length > 0 || bankSubjectCodes.length > 0)
    ) {
      throw new BadRequestException("RESOURCE products must grant exactly one resource");
    }
    if (
      dto.kind === "QUESTION_BANK" &&
      (bankSubjectCodes.length !== 1 || courseIds.length > 0 || resourceIds.length > 0)
    ) {
      throw new BadRequestException("QUESTION_BANK products must grant exactly one subject");
    }
    if (dto.kind === "BUNDLE" && courseIds.length + resourceIds.length + bankSubjectCodes.length < 2) {
      throw new BadRequestException("BUNDLE products must grant at least two courses, resources, or bank subjects");
    }

    // The slug is unique; without this a repeat would surface as a 500,
    // which the CDN replaces with its own error page.
    const taken = await this.prisma.product.findUnique({ where: { slug: dto.slug }, select: { id: true } });
    if (taken) throw new ConflictException("product slug already exists");

    const product = await this.prisma.product.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        kind: dto.kind as ProductKind,
        // Legacy pointer stays populated for existing clients; authorization
        // resolves the explicit grant tables below.
        courseId: dto.kind === "COURSE" ? courseIds[0] : undefined,
        courseGrants: courseIds.length ? { create: courseIds.map((courseId) => ({ courseId })) } : undefined,
        resourceGrants: resourceIds.length
          ? { create: resourceIds.map((resourceId) => ({ resourceId })) }
          : undefined,
        questionBankGrants: bankSubjectCodes.length
          ? { create: bankSubjectCodes.map((subjectCode) => ({ subjectCode })) }
          : undefined,
      },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "product.created",
      targetType: "Product",
      targetId: product.id,
    });
    return product;
  }

  async addPrice(productId: string, dto: CreatePriceDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("product not found");
    // Only one active price at a time keeps "the" price for checkout unambiguous.
    await this.prisma.price.updateMany({ where: { productId, isActive: true }, data: { isActive: false } });
    return this.prisma.price.create({ data: { productId, amountRial: dto.amountRial } });
  }

  async listAllProducts() {
    return this.prisma.product.findMany({
      include: {
        prices: true,
        course: true,
        courseGrants: { include: { course: true } },
        resourceGrants: { include: { resource: { select: { id: true, slug: true, title: true } } } },
        questionBankGrants: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listActiveProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        prices: { where: { isActive: true }, take: 1 },
        courseGrants: { include: { course: { select: { id: true, slug: true, title: true, isPublished: true } } } },
        resourceGrants: { include: { resource: { select: { id: true, slug: true, title: true, reviewStatus: true } } } },
        questionBankGrants: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return products.filter(
      (product) =>
        product.prices.length > 0 &&
        product.courseGrants.every((grant) => grant.course.isPublished) &&
        product.resourceGrants.every((grant) => grant.resource.reviewStatus === "PUBLISHED"),
    );
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        prices: { where: { isActive: true }, take: 1 },
        courseGrants: { include: { course: { select: { id: true, slug: true, title: true, isPublished: true } } } },
        resourceGrants: { include: { resource: { select: { id: true, slug: true, title: true, reviewStatus: true } } } },
        questionBankGrants: true,
      },
    });
    if (
      !product ||
      !product.isActive ||
      product.prices.length === 0 ||
      product.courseGrants.some((grant) => !grant.course.isPublished) ||
      product.resourceGrants.some((grant) => grant.resource.reviewStatus !== "PUBLISHED")
    ) {
      throw new NotFoundException("product not found");
    }
    return product;
  }

  // --- Checkout ---------------------------------------------------------------

  /**
   * Opens an order and asks the buyer to transfer the money.
   *
   * Nothing is granted here. A card transfer lands in a bank account this
   * system cannot query, so the only thing that can say the money arrived is
   * a person looking at the statement -- see `confirmPayment`. Checkout used
   * to charge a sandbox provider and grant access in the same transaction,
   * which is how an online gateway behaves and is exactly wrong for this.
   */
  async checkout(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        prices: { where: { isActive: true }, take: 1 },
        course: { select: { isPublished: true } },
        courseGrants: { include: { course: { select: { isPublished: true } } } },
        resourceGrants: { include: { resource: { select: { reviewStatus: true } } } },
        consultationOffering: { select: { isActive: true, validUntil: true } },
      },
    });
    if (
      !product ||
      !product.isActive ||
      product.prices.length === 0 ||
      (product.courseId && !product.course?.isPublished) ||
      product.courseGrants.some((grant) => !grant.course.isPublished) ||
      product.resourceGrants.some((grant) => grant.resource.reviewStatus !== "PUBLISHED") ||
      // A consultation whose offering is switched off, or whose deadline has
      // passed, must not be sellable: the student would be buying sessions
      // they could never book.
      (product.consultationOffering &&
        (!product.consultationOffering.isActive ||
          (product.consultationOffering.validUntil !== null &&
            product.consultationOffering.validUntil <= new Date())))
    ) {
      throw new NotFoundException("این محصول الان برای خرید باز نیست.");
    }
    const price = product.prices[0];

    // Without a destination card there is nowhere to send the money, so an
    // order would strand the buyer. Better to refuse than to take an order
    // nobody can pay.
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!bankAccount) {
      throw new BadRequestException("ثبت سفارش الان ممکن نیست، چون هنوز کارتی برای دریافت پول تنظیم نشده. به پشتیبانی خبر بده.");
    }

    const referenceCode = await this.allocateReferenceCode();

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          totalAmountRial: price.amountRial,
          items: {
            create: [{ productId, priceId: price.id, quantity: 1, amountRial: price.amountRial }],
          },
        },
      });
      await tx.payment.create({
        data: {
          orderId: created.id,
          provider: CARD_TRANSFER_PROVIDER,
          providerRef: `card-${referenceCode}`,
          status: PaymentStatus.PENDING,
          amountRial: price.amountRial,
          bankAccountId: bankAccount.id,
          referenceCode,
        },
      });
      return created;
    });

    await this.audit.log({
      actorUserId: userId,
      action: "order.opened",
      targetType: "Order",
      targetId: order.id,
      metadata: { productId, amountRial: price.amountRial, referenceCode },
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: { include: { bankAccount: true } } },
    });
  }

  /**
   * A short code the buyer writes in the transfer description and the
   * operator matches against the statement.
   *
   * The alphabet leaves out characters that are misread when copied off a
   * screen into a banking app by hand (0/O, 1/I/L), because a mistyped code
   * is a transfer nobody can match. Unique in the database; the retry is for
   * the rare collision rather than correctness, which the constraint holds.
   */
  private async allocateReferenceCode(): Promise<string> {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = randomBytes(8);
      const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
      const existing = await this.prisma.payment.findUnique({
        where: { referenceCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException("could not allocate a payment reference code");
  }

  /**
   * The buyer states they have transferred, and gives what an operator needs
   * to find it on the statement.
   *
   * Nothing here is trusted: it moves the payment into the review queue and
   * no further. Resubmission is allowed after a rejection, because the usual
   * reason for one is a mistyped tracking code.
   */
  async submitReceipt(userId: string, orderId: string, dto: SubmitReceiptDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    // Not "not yours" -- a buyer has no business learning that an order id
    // exists on someone else's account.
    if (!order || order.userId !== userId) throw new NotFoundException("order not found");
    if (order.status === OrderStatus.PAID) throw new BadRequestException("this order is already paid");
    if (order.status === OrderStatus.CANCELED) throw new BadRequestException("this order was cancelled");

    const payment = order.payments.find((row) => row.provider === CARD_TRANSFER_PROVIDER);
    if (!payment) throw new BadRequestException("this order has no card transfer to confirm");
    if (payment.status === PaymentStatus.SUCCEEDED) {
      throw new BadRequestException("this payment is already confirmed");
    }
    if (payment.status === PaymentStatus.AWAITING_REVIEW) {
      throw new BadRequestException("this receipt is already waiting to be checked");
    }

    const paidAt = new Date(dto.paidAt);
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException("paidAt must be a valid date");
    // A transfer cannot have happened before the order existed or in the
    // future; both mean the buyer picked the wrong date.
    if (paidAt.getTime() > Date.now() + 60_000) {
      throw new BadRequestException("paidAt cannot be in the future");
    }
    if (paidAt < order.createdAt) {
      throw new BadRequestException("paidAt cannot be before the order was opened");
    }

    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status },
      data: {
        status: PaymentStatus.AWAITING_REVIEW,
        receiptTrackingCode: dto.trackingCode,
        receiptPaidAt: paidAt,
        receiptFromCardLast4: dto.fromCardLast4,
        receiptNote: dto.note,
        receiptSubmittedAt: new Date(),
        // A resubmission clears the previous verdict, so the queue does not
        // show a rejection reason next to a fresh claim.
        rejectionReason: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
    });
    if (claimed.count !== 1) throw new BadRequestException("payment changed; refresh before submitting a receipt");
    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { bankAccount: true } });

    await this.audit.log({
      actorUserId: userId,
      action: "payment.receipt_submitted",
      targetType: "Payment",
      targetId: payment.id,
      metadata: { orderId, trackingCode: dto.trackingCode },
    });
    return updated;
  }

  /** The review queue: card transfers a buyer says they have made. */
  async listPaymentsForReview(status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: {
        provider: CARD_TRANSFER_PROVIDER,
        status: status ?? PaymentStatus.AWAITING_REVIEW,
      },
      orderBy: { receiptSubmittedAt: "asc" },
      include: {
        bankAccount: true,
        order: {
          include: {
            user: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
            items: { include: { product: { select: { id: true, title: true, kind: true } } } },
          },
        },
      },
    });
  }

  /**
   * An operator has found the transfer on the statement. This is the only
   * path in the card flow that grants anything.
   *
   * The whole fulfilment runs in one transaction and re-reads the payment
   * inside it, so two operators clicking confirm at the same moment cannot
   * both grant an entitlement for the same order.
   */
  async confirmPayment(adminId: string, paymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`;
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { order: { include: { items: true } } },
      });
      if (!payment) throw new NotFoundException("payment not found");
      if (payment.status === PaymentStatus.SUCCEEDED) {
        throw new BadRequestException("this payment is already confirmed");
      }
      if (payment.order.status === OrderStatus.PAID) {
        throw new BadRequestException("this order is already paid");
      }
      if (payment.order.status === OrderStatus.CANCELED) throw new BadRequestException("this order was cancelled");

      const productId = payment.order.items[0]?.productId;
      if (!productId) throw new BadRequestException("this order has no items");

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          courseGrants: true,
          consultationOffering: { select: { validUntil: true } },
        },
      });
      if (!product) throw new NotFoundException("product not found");

      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: payment.receiptPaidAt ?? now,
          reviewedAt: now,
          reviewedByUserId: adminId,
          rejectionReason: null,
        },
      });
      const paidOrder = await tx.order.updateMany({
        where: { id: payment.orderId, status: { notIn: [OrderStatus.PAID, OrderStatus.CANCELED] } },
        data: { status: OrderStatus.PAID },
      });
      if (paidOrder.count !== 1) throw new BadRequestException("order changed; refresh before confirming");

      const entitlement = await tx.entitlement.create({
        data: {
          userId: payment.order.userId,
          productId,
          grantedVia: EntitlementGrantSource.ORDER,
          // A consultation package runs to a deadline -- the konkur date for
          // the annual product. Carrying it onto the entitlement means expiry
          // is evaluated by AccessService like every other entitlement,
          // rather than by a rule that only consultations would know about.
          endAt: product.consultationOffering?.validUntil ?? undefined,
        },
      });
      for (const courseId of this.productCourseIds(product)) {
        await this.learning.enrollFromEntitlement(payment.order.userId, courseId, tx);
      }
      await tx.outboxEvent.create({
        data: {
          eventType: "EntitlementActivated",
          payload: {
            userId: payment.order.userId,
            productId,
            entitlementId: entitlement.id,
            orderId: payment.orderId,
          },
        },
      });

      return { orderId: payment.orderId, userId: payment.order.userId, productId, entitlementId: entitlement.id };
    });

    await this.audit.log({
      actorUserId: adminId,
      action: "payment.confirmed",
      targetType: "Payment",
      targetId: paymentId,
      metadata: result,
    });

    return this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: { include: { items: true } } },
    });
  }

  /** The transfer was not on the statement, or did not match. The buyer can
   * correct their claim and submit again. */
  async rejectPayment(adminId: string, paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException("payment not found");
    if (payment.status === PaymentStatus.SUCCEEDED) {
      throw new BadRequestException("a confirmed payment cannot be rejected; revoke the entitlement instead");
    }

    const rejected = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: payment.status },
      data: {
        status: PaymentStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedByUserId: adminId,
        rejectionReason: reason,
      },
    });
    if (rejected.count !== 1) throw new BadRequestException("payment changed; refresh before rejecting");
    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    await this.audit.log({
      actorUserId: adminId,
      action: "payment.rejected",
      targetType: "Payment",
      targetId: paymentId,
      metadata: { orderId: payment.orderId, reason },
    });
    return updated;
  }

  // --- destination cards -----------------------------------------------------

  async listBankAccounts() {
    return this.prisma.bankAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  }

  async createBankAccount(adminId: string, dto: BankAccountDto) {
    const cardNumber = dto.cardNumber.replace(/\D/g, "");
    if (cardNumber.length !== 16) throw new BadRequestException("cardNumber must be 16 digits");

    const account = await this.prisma.bankAccount.create({
      data: {
        bankName: dto.bankName,
        holderName: dto.holderName,
        cardNumber,
        iban: dto.iban,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      actorUserId: adminId,
      action: "bank_account.created",
      targetType: "BankAccount",
      targetId: account.id,
      // The card number is what this row is; the audit records the last four
      // so a change is traceable without copying the whole number around.
      metadata: { bankName: dto.bankName, holderName: dto.holderName, last4: cardNumber.slice(-4) },
    });
    return account;
  }

  async updateBankAccount(adminId: string, id: string, dto: BankAccountDto) {
    const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("bank account not found");

    const cardNumber = dto.cardNumber.replace(/\D/g, "");
    if (cardNumber.length !== 16) throw new BadRequestException("cardNumber must be 16 digits");

    const account = await this.prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: dto.bankName,
        holderName: dto.holderName,
        cardNumber,
        iban: dto.iban,
        isActive: dto.isActive ?? existing.isActive,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
      },
    });
    await this.audit.log({
      actorUserId: adminId,
      action: "bank_account.updated",
      targetType: "BankAccount",
      targetId: id,
      metadata: { isActive: account.isActive, last4: cardNumber.slice(-4) },
    });
    return account;
  }

  // --- Manual / gift entitlements (doc §8.1: admin can grant gift/trial/
  // compensatory access, all changes audited) --------------------------------

  async grantManualEntitlement(
    adminId: string,
    userId: string,
    productId: string,
    grantedVia: "GIFT" | "TRIAL" | "MANUAL",
    reason: string,
    startAt?: Date,
    endAt?: Date,
  ) {
    if (startAt && endAt && endAt <= startAt) {
      throw new BadRequestException("endAt must be after startAt");
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { courseGrants: true },
    });
    if (!product) throw new NotFoundException("product not found");

    const entitlement = await this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.entitlement.create({
        data: {
          userId,
          productId,
          grantedVia: grantedVia as EntitlementGrantSource,
          reason,
          grantedByUserId: adminId,
          startAt,
          endAt,
        },
      });
      const now = new Date();
      if ((!startAt || startAt <= now) && (!endAt || endAt > now)) {
        for (const courseId of this.productCourseIds(product)) {
          await this.learning.enrollFromEntitlement(userId, courseId, tx);
        }
      }
      return entitlement;
    });

    await this.audit.log({
      actorUserId: adminId,
      action: "entitlement.granted_manually",
      targetType: "Entitlement",
      targetId: entitlement.id,
      metadata: { userId, productId, grantedVia, reason },
    });

    return entitlement;
  }

  async revokeEntitlement(adminId: string, entitlementId: string, reason?: string) {
    const entitlement = await this.prisma.entitlement.findUnique({ where: { id: entitlementId } });
    if (!entitlement) throw new NotFoundException("entitlement not found");
    const product = await this.prisma.product.findUnique({
      where: { id: entitlement.productId },
      include: { courseGrants: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date() } });
      if (product) {
        for (const courseId of this.productCourseIds(product)) {
          await this.learning.revokeEnrollment(entitlement.userId, courseId, tx);
        }
      }
    });

    await this.audit.log({
      actorUserId: adminId,
      action: "entitlement.revoked",
      targetType: "Entitlement",
      targetId: entitlementId,
      metadata: reason ? { reason } : undefined,
    });
  }

  async listAllOrders() {
    return this.prisma.order.findMany({
      include: { items: true, payments: true, user: { select: { id: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: { select: { id: true, slug: true, title: true, kind: true } } } },
        // The destination card comes with the order: an unpaid order is
        // useless to the buyer without somewhere to send the money.
        payments: { include: { bankAccount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** One order, for the page where a buyer pays for it. */
  async getMyOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { id: true, slug: true, title: true, kind: true } } } },
        payments: { include: { bankAccount: true } },
      },
    });
    if (!order || order.userId !== userId) throw new NotFoundException("order not found");
    return order;
  }

  async listMyEntitlements(userId: string) {
    // A course's handouts, listed with the course they come with.
    const courseWithHandouts = {
      select: {
        id: true,
        slug: true,
        title: true,
        isPublished: true,
        materials: {
          where: { resource: { reviewStatus: "PUBLISHED" as const } },
          orderBy: { position: "asc" as const },
          select: {
            resource: {
              select: { id: true, slug: true, title: true, summary: true, kind: true, hostingMode: true, subjectCodes: true, publishedAt: true },
            },
          },
        },
      },
    };
    const entitlements = await this.prisma.entitlement.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            course: courseWithHandouts,
            courseGrants: {
              where: { course: { isPublished: true } },
              include: { course: courseWithHandouts },
            },
            resourceGrants: {
              where: { resource: { reviewStatus: "PUBLISHED" } },
              // Enough to list a handout in the student's library; the file
              // itself is only ever served by the access-checked content route.
              include: {
                resource: {
                  select: { id: true, slug: true, title: true, summary: true, kind: true, hostingMode: true, subjectCodes: true, publishedAt: true },
                },
              },
            },
            questionBankGrants: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return entitlements.map((entitlement) => ({
      ...entitlement,
      status: entitlement.revokedAt
        ? "REVOKED"
        : entitlement.startAt > now
          ? "SCHEDULED"
          : entitlement.endAt && entitlement.endAt <= now
            ? "EXPIRED"
            : "ACTIVE",
    }));
  }

  async listMyLibrary(userId: string) {
    const active = (await this.listMyEntitlements(userId)).filter((item) => item.status === "ACTIVE");
    const courses = new Map<string, unknown>();
    const resources = new Map<string, { id: string } & Record<string, unknown>>();
    const acquiredAt = new Map<string, Date>();
    const questionBankSubjects = new Set<string>();
    const note = (resourceId: string, startAt: Date) => {
      const earlier = acquiredAt.get(resourceId);
      if (!earlier || startAt < earlier) acquiredAt.set(resourceId, startAt);
    };
    for (const entitlement of active) {
      const granted = entitlement.product.courseGrants.map((grant) => grant.course);
      const direct = entitlement.product.course;
      const reachable = direct?.isPublished ? [direct, ...granted] : granted;
      for (const { materials, id, slug, title } of reachable) {
        const course = { id, slug, title };
        courses.set(id, course);
        for (const { resource } of materials) {
          // Bought on its own too? Then it is simply the student's; the
          // course label is only for handouts they have through the course.
          if (!resources.has(resource.id)) resources.set(resource.id, { ...resource, course: { slug: course.slug, title: course.title } });
          note(resource.id, entitlement.startAt);
        }
      }
      for (const grant of entitlement.product.resourceGrants) {
        resources.set(grant.resource.id, grant.resource);
        note(grant.resource.id, entitlement.startAt);
      }
      for (const grant of entitlement.product.questionBankGrants) questionBankSubjects.add(grant.subjectCode);
    }
    return {
      courses: [...courses.values()],
      // Newest acquisition first, so what the student just bought is on top.
      resources: [...resources.values()]
        .map((resource) => ({ ...resource, acquiredAt: acquiredAt.get(resource.id) ?? null }))
        .sort((left, right) => (right.acquiredAt?.getTime() ?? 0) - (left.acquiredAt?.getTime() ?? 0)),
      questionBankSubjects: [...questionBankSubjects],
    };
  }

  async addCourseGrant(productId: string, courseId: string) {
    await this.ensureBundle(productId);
    return this.prisma.productCourseGrant.upsert({
      where: { productId_courseId: { productId, courseId } },
      update: {},
      create: { productId, courseId },
    });
  }

  async addResourceGrant(productId: string, resourceId: string) {
    await this.ensureBundle(productId);
    return this.prisma.productResourceGrant.upsert({
      where: { productId_resourceId: { productId, resourceId } },
      update: {},
      create: { productId, resourceId },
    });
  }

  async addBankGrant(productId: string, subjectCode: string) {
    await this.ensureBundle(productId);
    return this.prisma.productQuestionBankGrant.upsert({
      where: { productId_subjectCode: { productId, subjectCode } },
      update: {},
      create: { productId, subjectCode },
    });
  }

  private async ensureBundle(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("product not found");
    if (product.kind !== ProductKind.BUNDLE) {
      throw new BadRequestException("grants can only be appended to BUNDLE products");
    }
  }

  private productCourseIds(product: { courseId: string | null; courseGrants: { courseId: string }[] }) {
    return [
      ...new Set([
        ...(product.courseId ? [product.courseId] : []),
        ...product.courseGrants.map((grant) => grant.courseId),
      ]),
    ];
  }
}
