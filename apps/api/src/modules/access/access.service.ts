import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type AccessTx = PrismaService | Prisma.TransactionClient;

/**
 * Single source of truth for "does this user have an active entitlement
 * granting X". Before this service existed, the entitlement-window
 * predicate (`startAt <= now`, `revokedAt: null`, `endAt` null or in the
 * future) was hand-copied in three places:
 *   - learning.service.ts `hasActiveCourseEntitlement`
 *   - content/editorial.service.ts `canAccessResource`
 *   - planning/planning.service.ts `canAccessResourceInPlan`
 * All three now delegate to the methods below so a future fix to the window
 * logic (grace periods, refund handling, etc.) protects every caller at
 * once instead of needing three coordinated edits.
 *
 * Access is resolved by reading Entitlement -> Product -> grant tables at
 * request time. There is no separate "access" table to keep in sync.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  private entitlementWindow(now: Date): Prisma.EntitlementWhereInput {
    return {
      startAt: { lte: now },
      revokedAt: null,
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    };
  }

  private async hasActiveGrant(
    userId: string,
    productWhere: Prisma.ProductWhereInput,
    tx?: AccessTx,
  ): Promise<boolean> {
    const db = tx ?? this.prisma;
    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: { userId, ...this.entitlementWindow(now), product: productWhere },
      select: { id: true },
    });
    return Boolean(entitlement);
  }

  /**
   * The active entitlements a user holds for one product, oldest first.
   *
   * Unlike the boolean helpers, this returns the rows themselves, because
   * consultation session quota is counted per entitlement: buying the same
   * package twice gives two independent quotas, and a booking has to say
   * which one it draws against. Oldest first so the quota that expires
   * soonest is the one spent first.
   */
  async activeEntitlementsForProduct(userId: string, productId: string, tx?: AccessTx) {
    const db = tx ?? this.prisma;
    return db.entitlement.findMany({
      where: { userId, productId, ...this.entitlementWindow(new Date()) },
      select: { id: true, startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });
  }

  /** Course access: bought directly (Product.courseId) or via an explicit
   * ProductCourseGrant (a bundle/multi-course product). */
  async hasActiveCourseAccess(userId: string, courseId: string, tx?: AccessTx): Promise<boolean> {
    return this.hasActiveGrant(userId, { OR: [{ courseId }, { courseGrants: { some: { courseId } } }] }, tx);
  }

  /** Resource access via an explicit ProductResourceGrant. */
  async hasActiveResourceAccess(userId: string, resourceId: string, tx?: AccessTx): Promise<boolean> {
    return this.hasActiveGrant(userId, { resourceGrants: { some: { resourceId } } }, tx);
  }

  /**
   * Question-bank access is SUBJECT-scoped (owner decision): a grant unlocks
   * the bank for one subject, not the whole bank and not per-topic. Reached
   * either through a standalone QUESTION_BANK product or through a Course
   * product that also carries a ProductQuestionBankGrant for its subject.
   */
  async hasActiveQuestionBankAccess(userId: string, subjectCode: string, tx?: AccessTx): Promise<boolean> {
    return this.hasActiveGrant(userId, { questionBankGrants: { some: { subjectCode } } }, tx);
  }

  /**
   * Batched form for list endpoints: given the distinct subjectCodes on a
   * page of questions, returns the subset the user has active bank access
   * to, in one query instead of one-per-row.
   */
  async accessibleQuestionBankSubjects(
    userId: string,
    subjectCodes: string[],
    tx?: AccessTx,
  ): Promise<Set<string>> {
    const distinct = [...new Set(subjectCodes)];
    if (distinct.length === 0) return new Set();
    const db = tx ?? this.prisma;
    const now = new Date();
    const entitlements = await db.entitlement.findMany({
      where: {
        userId,
        ...this.entitlementWindow(now),
        product: { questionBankGrants: { some: { subjectCode: { in: distinct } } } },
      },
      select: {
        product: {
          select: {
            questionBankGrants: { where: { subjectCode: { in: distinct } }, select: { subjectCode: true } },
          },
        },
      },
    });
    const accessible = new Set<string>();
    for (const entitlement of entitlements) {
      for (const grant of entitlement.product.questionBankGrants) accessible.add(grant.subjectCode);
    }
    return accessible;
  }
}
