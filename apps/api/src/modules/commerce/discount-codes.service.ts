import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateDiscountCodeDto, UpdateDiscountCodeDto, normaliseCode } from "./dto/discount-code.dto";

type Db = PrismaService | Prisma.TransactionClient;

/** An order holds a use of its code while it is open or paid; a cancelled one gives it back. */
const COUNTED: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PAID];

export interface DiscountQuote {
  discountCodeId: string;
  code: string;
  discountRial: number;
}

@Injectable()
export class DiscountCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * What a code takes off this product's price for this buyer, or why it
   * cannot be used. Call it inside the checkout transaction with `lock`, so
   * two buyers cannot both take a code's last use.
   */
  async quote(db: Db, input: { code: string; productId: string; userId: string; priceRial: number; lock?: boolean }): Promise<DiscountQuote> {
    const code = String(normaliseCode(input.code));
    const found = await db.discountCode.findUnique({ where: { code }, include: { products: { select: { productId: true } } } });
    if (!found || !found.isActive) throw new BadRequestException("این کد تخفیف معتبر نیست.");
    if (input.lock) await db.$queryRaw`SELECT "id" FROM "discount_codes" WHERE "id" = ${found.id} FOR UPDATE`;
    const now = new Date();
    if (found.startsAt && found.startsAt > now) throw new BadRequestException("این کد تخفیف هنوز فعال نشده است.");
    if (found.endsAt && found.endsAt <= now) throw new BadRequestException("مهلت این کد تخفیف تمام شده است.");
    if (found.products.length > 0 && !found.products.some((p) => p.productId === input.productId)) {
      throw new BadRequestException("این کد تخفیف برای این محصول نیست.");
    }
    if (found.maxRedemptions !== null) {
      const used = await db.order.count({ where: { discountCodeId: found.id, status: { in: COUNTED } } });
      if (used >= found.maxRedemptions) throw new BadRequestException("ظرفیت این کد تخفیف تمام شده است.");
    }
    const usedByBuyer = await db.order.count({ where: { discountCodeId: found.id, userId: input.userId, status: { in: COUNTED } } });
    if (usedByBuyer >= found.maxPerUser) throw new BadRequestException("این کد تخفیف را قبلاً استفاده کرده‌ای.");

    const raw = found.percentOff !== null ? Math.floor((input.priceRial * found.percentOff) / 100) : (found.amountOffRial ?? 0);
    // Whole tomans, and never more than the price.
    const discountRial = Math.min(input.priceRial, Math.floor(raw / 10) * 10);
    return { discountCodeId: found.id, code: found.code, discountRial };
  }

  // --- admin ------------------------------------------------------------------

  async list() {
    const codes = await this.prisma.discountCode.findMany({
      include: { products: { include: { product: { select: { id: true, title: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    const uses = await this.prisma.order.groupBy({
      by: ["discountCodeId", "status"],
      where: { discountCodeId: { in: codes.map((c) => c.id) } },
      _count: { _all: true },
      _sum: { discountRial: true },
    });
    return codes.map(({ products, ...code }) => {
      const mine = uses.filter((u) => u.discountCodeId === code.id);
      const of = (status: OrderStatus) => mine.find((u) => u.status === status);
      return {
        ...code,
        products: products.map((p) => p.product),
        paidUses: of(OrderStatus.PAID)?._count._all ?? 0,
        pendingUses: of(OrderStatus.PENDING)?._count._all ?? 0,
        discountGivenRial: of(OrderStatus.PAID)?._sum.discountRial ?? 0,
      };
    });
  }

  async create(actorId: string, dto: CreateDiscountCodeDto) {
    this.checkKind(dto.percentOff, dto.amountOffRial);
    this.checkWindow(dto.startsAt, dto.endsAt);
    await this.checkProducts(dto.productIds ?? []);
    if (await this.prisma.discountCode.findUnique({ where: { code: dto.code }, select: { id: true } })) {
      throw new ConflictException("کدی با همین نوشته از قبل هست.");
    }
    const created = await this.prisma.discountCode.create({
      data: {
        code: dto.code,
        note: dto.note?.trim() || null,
        percentOff: dto.percentOff ?? null,
        amountOffRial: dto.amountOffRial ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        maxRedemptions: dto.maxRedemptions ?? null,
        maxPerUser: dto.maxPerUser ?? 1,
        products: { create: (dto.productIds ?? []).map((productId) => ({ productId })) },
      },
    });
    await this.audit.log({ actorUserId: actorId, action: "discount_code.created", targetType: "DiscountCode", targetId: created.id, metadata: { code: created.code } });
    return created;
  }

  async update(actorId: string, id: string, dto: UpdateDiscountCodeDto) {
    const current = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("discount code not found");
    // Switching between a percentage and an amount: the new one replaces the old.
    const percentOff = dto.percentOff !== undefined ? dto.percentOff : dto.amountOffRial !== undefined ? null : current.percentOff;
    const amountOffRial = dto.amountOffRial !== undefined ? dto.amountOffRial : dto.percentOff !== undefined ? null : current.amountOffRial;
    this.checkKind(percentOff ?? undefined, amountOffRial ?? undefined);
    const startsAt = dto.startsAt === undefined ? current.startsAt : dto.startsAt === null ? null : new Date(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? current.endsAt : dto.endsAt === null ? null : new Date(dto.endsAt);
    this.checkWindow(startsAt?.toISOString(), endsAt?.toISOString());
    if (dto.productIds) await this.checkProducts(dto.productIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.productIds) {
        await tx.discountCodeProduct.deleteMany({ where: { discountCodeId: id } });
        if (dto.productIds.length) await tx.discountCodeProduct.createMany({ data: dto.productIds.map((productId) => ({ discountCodeId: id, productId })) });
      }
      return tx.discountCode.update({
        where: { id },
        data: {
          isActive: dto.isActive ?? undefined,
          note: dto.note !== undefined ? dto.note.trim() || null : undefined,
          percentOff,
          amountOffRial,
          startsAt,
          endsAt,
          maxRedemptions: dto.maxRedemptions === undefined ? undefined : dto.maxRedemptions,
          maxPerUser: dto.maxPerUser ?? undefined,
        },
      });
    });
    await this.audit.log({ actorUserId: actorId, action: "discount_code.updated", targetType: "DiscountCode", targetId: id, metadata: { code: updated.code } });
    return updated;
  }

  /** A code no order has used can go; one that has been used stays for the record and can only be switched off. */
  async remove(actorId: string, id: string) {
    const code = await this.prisma.discountCode.findUnique({ where: { id }, select: { code: true, _count: { select: { orders: true } } } });
    if (!code) throw new NotFoundException("discount code not found");
    if (code._count.orders > 0) throw new ConflictException("این کد در سفارش‌ها استفاده شده و حذف نمی‌شود؛ غیرفعالش کن.");
    await this.prisma.discountCode.delete({ where: { id } });
    await this.audit.log({ actorUserId: actorId, action: "discount_code.deleted", targetType: "DiscountCode", targetId: id, metadata: { code: code.code } });
    return { deleted: true };
  }

  private checkKind(percentOff?: number, amountOffRial?: number) {
    if ((percentOff === undefined) === (amountOffRial === undefined)) {
      throw new BadRequestException("یکی از «درصد تخفیف» یا «مبلغ تخفیف» را وارد کن، نه هر دو.");
    }
  }

  private checkWindow(startsAt?: string, endsAt?: string) {
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) throw new BadRequestException("پایان باید بعد از شروع باشد.");
  }

  private async checkProducts(productIds: string[]) {
    if (!productIds.length) return;
    const found = await this.prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== new Set(productIds).size) throw new BadRequestException("یکی از محصول‌های انتخاب‌شده پیدا نشد.");
  }
}
