import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EntitlementGrantSource, OrderStatus, PaymentStatus, ProductKind } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LearningService } from "../learning/learning.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreatePriceDto } from "./dto/create-price.dto";
import { PAYMENT_PROVIDER, PaymentProvider } from "./payment-provider";

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly learning: LearningService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  // --- Admin catalog management ---------------------------------------------

  async createProduct(actorId: string, dto: CreateProductDto) {
    if (dto.kind === "COURSE" && !dto.courseId) {
      throw new BadRequestException("courseId is required for a COURSE product");
    }
    const product = await this.prisma.product.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        kind: dto.kind as ProductKind,
        courseId: dto.courseId,
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
      include: { prices: true, course: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async listActiveProducts() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { prices: { where: { isActive: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return products.filter((p) => p.prices.length > 0);
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { prices: { where: { isActive: true }, take: 1 } },
    });
    if (!product || !product.isActive || product.prices.length === 0) {
      throw new NotFoundException("product not found");
    }
    return product;
  }

  // --- Checkout ---------------------------------------------------------------

  async checkout(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { prices: { where: { isActive: true }, take: 1 } },
    });
    if (!product || !product.isActive || product.prices.length === 0) {
      throw new NotFoundException("product not available for purchase");
    }
    const price = product.prices[0];

    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        totalAmountRial: price.amountRial,
        items: {
          create: [{ productId, priceId: price.id, quantity: 1, amountRial: price.amountRial }],
        },
      },
    });

    const charge = await this.paymentProvider.charge(order.id, price.amountRial);

    if (!charge.succeeded) {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } }),
        this.prisma.payment.create({
          data: {
            orderId: order.id,
            provider: this.paymentProvider.name,
            providerRef: charge.providerRef,
            status: PaymentStatus.FAILED,
            amountRial: price.amountRial,
          },
        }),
      ]);
      throw new BadRequestException("payment failed");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: this.paymentProvider.name,
          providerRef: charge.providerRef,
          status: PaymentStatus.SUCCEEDED,
          amountRial: price.amountRial,
          paidAt: new Date(),
        },
      });
      const entitlement = await tx.entitlement.create({
        data: { userId, productId, grantedVia: EntitlementGrantSource.ORDER },
      });
      if (product.kind === ProductKind.COURSE && product.courseId) {
        await this.learning.enrollFromEntitlement(userId, product.courseId, tx);
      }
      await tx.outboxEvent.create({
        data: {
          eventType: "EntitlementActivated",
          payload: { userId, productId, entitlementId: entitlement.id, orderId: order.id },
        },
      });
      return { entitlement };
    });

    await this.audit.log({
      actorUserId: userId,
      action: "order.paid",
      targetType: "Order",
      targetId: order.id,
      metadata: { productId, amountRial: price.amountRial },
    });

    return this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
  }

  // --- Manual / gift entitlements (doc §8.1: admin can grant gift/trial/
  // compensatory access, all changes audited) --------------------------------

  async grantManualEntitlement(
    adminId: string,
    userId: string,
    productId: string,
    grantedVia: "GIFT" | "TRIAL" | "MANUAL",
    reason: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException("product not found");

    const entitlement = await this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.entitlement.create({
        data: {
          userId,
          productId,
          grantedVia: grantedVia as EntitlementGrantSource,
          reason,
          grantedByUserId: adminId,
        },
      });
      if (product.kind === ProductKind.COURSE && product.courseId) {
        await this.learning.enrollFromEntitlement(userId, product.courseId, tx);
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
    const product = await this.prisma.product.findUnique({ where: { id: entitlement.productId } });

    await this.prisma.$transaction(async (tx) => {
      await tx.entitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date() } });
      if (product?.kind === ProductKind.COURSE && product.courseId) {
        await this.learning.revokeEnrollment(entitlement.userId, product.courseId, tx);
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
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async listMyEntitlements(userId: string) {
    return this.prisma.entitlement.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
