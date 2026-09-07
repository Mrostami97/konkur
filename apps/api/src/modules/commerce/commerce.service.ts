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
    const courseIds = [...new Set([...(dto.courseIds ?? []), ...(dto.courseId ? [dto.courseId] : [])])];
    const resourceIds = [...new Set(dto.resourceIds ?? [])];
    if (dto.kind === "COURSE" && (courseIds.length !== 1 || resourceIds.length > 0)) {
      throw new BadRequestException("COURSE products must grant exactly one course");
    }
    if (dto.kind === "RESOURCE" && (resourceIds.length !== 1 || courseIds.length > 0)) {
      throw new BadRequestException("RESOURCE products must grant exactly one resource");
    }
    if (dto.kind === "BUNDLE" && courseIds.length + resourceIds.length < 2) {
      throw new BadRequestException("BUNDLE products must grant at least two courses or resources");
    }

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

  async checkout(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        prices: { where: { isActive: true }, take: 1 },
        course: { select: { isPublished: true } },
        courseGrants: { include: { course: { select: { isPublished: true } } } },
        resourceGrants: { include: { resource: { select: { reviewStatus: true } } } },
      },
    });
    if (
      !product ||
      !product.isActive ||
      product.prices.length === 0 ||
      (product.courseId && !product.course?.isPublished) ||
      product.courseGrants.some((grant) => !grant.course.isPublished) ||
      product.resourceGrants.some((grant) => grant.resource.reviewStatus !== "PUBLISHED")
    ) {
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
      for (const courseId of this.productCourseIds(product)) {
        await this.learning.enrollFromEntitlement(userId, courseId, tx);
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
      include: { items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async listMyEntitlements(userId: string) {
    const entitlements = await this.prisma.entitlement.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            courseGrants: {
              where: { course: { isPublished: true } },
              include: { course: { select: { id: true, slug: true, title: true } } },
            },
            resourceGrants: {
              where: { resource: { reviewStatus: "PUBLISHED" } },
              include: { resource: { select: { id: true, slug: true, title: true } } },
            },
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
    const resources = new Map<string, unknown>();
    for (const entitlement of active) {
      for (const grant of entitlement.product.courseGrants) courses.set(grant.course.id, grant.course);
      for (const grant of entitlement.product.resourceGrants) resources.set(grant.resource.id, grant.resource);
    }
    return { courses: [...courses.values()], resources: [...resources.values()] };
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
