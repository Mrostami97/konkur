import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const FULL_SHARE_BP = 10_000;

/** The public face of an instructor. Deliberately a subset of
 * ContributorProfile: `userId` and the unpublished flag are operational, not
 * public, so they never reach a public projection by being forgotten. */
const PUBLIC_INSTRUCTOR_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  roleTitle: true,
  shortBio: true,
  bioBlocks: true,
  avatarUrl: true,
  thesisUrl: true,
  sameAs: true,
} satisfies Prisma.ContributorProfileSelect;

export interface CourseSales {
  courseId: string;
  slug: string;
  title: string;
  isPublished: boolean;
  revenueShareBp: number;
  students: number;
  grossRial: number;
  shareRial: number;
}

@Injectable()
export class InstructorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- admin: who teaches what -----------------------------------------------

  /**
   * Attaches an instructor to a course on a revenue share.
   *
   * Rejects a set of shares that would sum above 100% for one course. That
   * cannot be a database CHECK -- it spans rows -- so it is enforced here, on
   * the single write path, inside the transaction that performs the write.
   */
  async attachToCourse(
    actorId: string,
    courseId: string,
    contributorProfileId: string,
    revenueShareBp: number,
    sortOrder = 0,
  ) {
    if (!Number.isInteger(revenueShareBp) || revenueShareBp < 0 || revenueShareBp > FULL_SHARE_BP) {
      throw new BadRequestException("revenueShareBp must be an integer between 0 and 10000");
    }

    const [course, profile] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
      this.prisma.contributorProfile.findUnique({
        where: { id: contributorProfileId },
        select: { id: true, displayName: true },
      }),
    ]);
    if (!course) throw new NotFoundException("course not found");
    if (!profile) throw new NotFoundException("contributor profile not found");

    const link = await this.prisma.$transaction(async (tx) => {
      const others = await tx.courseInstructor.findMany({
        where: { courseId, contributorProfileId: { not: contributorProfileId } },
        select: { revenueShareBp: true },
      });
      const committed = others.reduce((sum, row) => sum + row.revenueShareBp, 0);
      if (committed + revenueShareBp > FULL_SHARE_BP) {
        throw new BadRequestException(
          `revenue shares on this course would total ${committed + revenueShareBp} basis points, above 10000`,
        );
      }

      return tx.courseInstructor.upsert({
        where: { courseId_contributorProfileId: { courseId, contributorProfileId } },
        create: { courseId, contributorProfileId, revenueShareBp, sortOrder },
        update: { revenueShareBp, sortOrder },
        include: { contributorProfile: { select: { id: true, slug: true, displayName: true } } },
      });
    });

    await this.audit.log({
      actorUserId: actorId,
      action: "course.instructor_set",
      targetType: "Course",
      targetId: courseId,
      metadata: { contributorProfileId, displayName: profile.displayName, revenueShareBp },
    });
    return link;
  }

  /**
   * Removes an instructor from a course. This is a real delete, unlike the
   * retirement used for questions: the row is a pure edge carrying only the
   * share, no history hangs off it, and past orders are attributed from the
   * orders themselves. The share it carried is recorded in the audit log so a
   * removal is still reconstructable.
   */
  async detachFromCourse(actorId: string, courseId: string, contributorProfileId: string) {
    const existing = await this.prisma.courseInstructor.findUnique({
      where: { courseId_contributorProfileId: { courseId, contributorProfileId } },
      select: { revenueShareBp: true },
    });
    if (!existing) throw new NotFoundException("this instructor is not attached to this course");

    await this.prisma.courseInstructor.delete({
      where: { courseId_contributorProfileId: { courseId, contributorProfileId } },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "course.instructor_removed",
      targetType: "Course",
      targetId: courseId,
      metadata: { contributorProfileId, revenueShareBp: existing.revenueShareBp },
    });
    return { courseId, contributorProfileId, removed: true };
  }

  /** Admin listing: every contributor who teaches at least one course, with
   * their courses and shares. */
  async listInstructors() {
    const profiles = await this.prisma.contributorProfile.findMany({
      where: { taughtCourses: { some: {} } },
      select: {
        id: true,
        slug: true,
        displayName: true,
        roleTitle: true,
        avatarUrl: true,
        isPublished: true,
        userId: true,
        taughtCourses: {
          orderBy: { sortOrder: "asc" },
          select: {
            revenueShareBp: true,
            sortOrder: true,
            course: { select: { id: true, slug: true, title: true, isPublished: true } },
          },
        },
      },
      orderBy: { displayName: "asc" },
    });

    // A profile with no linked user cannot sign in, so it has no panel of its
    // own -- worth surfacing rather than leaving the admin to discover it.
    return profiles.map((profile) => ({ ...profile, canSignIn: profile.userId !== null }));
  }

  // --- the instructor's own view ---------------------------------------------

  /** Resolves the signed-in user to their instructor profile, or refuses.
   * Having the MENTOR role is not enough: the account must actually be linked
   * to a contributor profile, which is what scopes every number below. */
  private async requireOwnProfile(userId: string) {
    const profile = await this.prisma.contributorProfile.findUnique({
      where: { userId },
      select: { id: true, slug: true, displayName: true, roleTitle: true, avatarUrl: true, isPublished: true },
    });
    if (!profile) {
      throw new ForbiddenException("this account is not linked to an instructor profile");
    }
    return profile;
  }

  async getOwnProfile(userId: string) {
    return this.requireOwnProfile(userId);
  }

  async getOwnSales(userId: string) {
    const profile = await this.requireOwnProfile(userId);
    return { profile, ...(await this.salesForProfile(profile.id)) };
  }

  /** Same figures an instructor sees, readable by finance and admin without
   * impersonating them. */
  async getSalesForProfile(profileId: string) {
    const profile = await this.prisma.contributorProfile.findUnique({
      where: { id: profileId },
      select: { id: true, slug: true, displayName: true, roleTitle: true, avatarUrl: true, isPublished: true },
    });
    if (!profile) throw new NotFoundException("contributor profile not found");
    return { profile, ...(await this.salesForProfile(profileId)) };
  }

  /**
   * Attributes paid revenue to one instructor.
   *
   * A product can reach a course two ways -- `Product.courseId` directly, or a
   * ProductCourseGrant on a bundle -- and both are counted. A bundle sells
   * several courses for one price, so its revenue is split evenly across the
   * courses it grants before an instructor's share is applied; there is no
   * per-course price to split it by any other way, and attributing the whole
   * amount to each course would inflate every instructor's figures.
   *
   * The split and the share both round down, so the sum of what instructors
   * are shown never exceeds what was actually collected.
   */
  private async salesForProfile(profileId: string) {
    const taught = await this.prisma.courseInstructor.findMany({
      where: { contributorProfileId: profileId },
      orderBy: { sortOrder: "asc" },
      select: {
        revenueShareBp: true,
        course: { select: { id: true, slug: true, title: true, isPublished: true } },
      },
    });

    const shareByCourse = new Map(taught.map((row) => [row.course.id, row.revenueShareBp]));
    const courseIds = [...shareByCourse.keys()];

    const sales: CourseSales[] = taught.map((row) => ({
      courseId: row.course.id,
      slug: row.course.slug,
      title: row.course.title,
      isPublished: row.course.isPublished,
      revenueShareBp: row.revenueShareBp,
      students: 0,
      grossRial: 0,
      shareRial: 0,
    }));
    const byCourse = new Map(sales.map((row) => [row.courseId, row]));

    if (courseIds.length === 0) {
      return { courses: sales, totals: emptyTotals(), monthly: [] as MonthlyPoint[] };
    }

    const [enrollments, items] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ["courseId"],
        where: { courseId: { in: courseIds } },
        _count: { _all: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { status: OrderStatus.PAID },
          product: {
            OR: [{ courseId: { in: courseIds } }, { courseGrants: { some: { courseId: { in: courseIds } } } }],
          },
        },
        select: {
          amountRial: true,
          order: { select: { createdAt: true, userId: true, totalAmountRial: true, discountRial: true } },
          product: {
            select: { id: true, courseId: true, courseGrants: { select: { courseId: true } } },
          },
        },
      }),
    ]);

    for (const row of enrollments) {
      const course = byCourse.get(row.courseId);
      if (course) course.students = row._count._all;
    }

    const monthly = new Map<string, MonthlyPoint>();

    for (const item of items) {
      const granted = new Set<string>();
      if (item.product.courseId) granted.add(item.product.courseId);
      for (const grant of item.product.courseGrants) granted.add(grant.courseId);
      if (granted.size === 0) continue;

      // A discount code lowers what the buyer paid, and the share is of what was paid.
      const listRial = item.order.totalAmountRial + item.order.discountRial;
      const paidRial = listRial > 0 ? Math.floor((item.amountRial * item.order.totalAmountRial) / listRial) : 0;
      const perCourseRial = Math.floor(paidRial / granted.size);

      for (const courseId of granted) {
        const course = byCourse.get(courseId);
        if (!course) continue; // a co-sold course taught by somebody else

        const shareRial = Math.floor((perCourseRial * course.revenueShareBp) / FULL_SHARE_BP);
        course.grossRial += perCourseRial;
        course.shareRial += shareRial;

        const key = monthKey(item.order.createdAt);
        const point = monthly.get(key) ?? { month: key, grossRial: 0, shareRial: 0, orders: 0 };
        point.grossRial += perCourseRial;
        point.shareRial += shareRial;
        point.orders += 1;
        monthly.set(key, point);
      }
    }

    const totals = sales.reduce(
      (acc, row) => ({
        grossRial: acc.grossRial + row.grossRial,
        shareRial: acc.shareRial + row.shareRial,
        students: acc.students + row.students,
      }),
      { grossRial: 0, shareRial: 0, students: 0 },
    );

    return {
      courses: sales,
      totals,
      monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  // --- public ----------------------------------------------------------------

  /**
   * Public index of instructors. There is deliberately no public instructor
   * *detail* endpoint here: a person already has one canonical public page at
   * /authors/[slug], and that projection now carries their courses. A second
   * URL for the same human would be duplicate content.
   *
   * An instructor is derived from what they actually teach rather than a
   * separate flag, so the listing cannot drift from reality.
   */
  async listPublic() {
    const profiles = await this.prisma.contributorProfile.findMany({
      where: { isPublished: true, taughtCourses: { some: { course: { isPublished: true } } } },
      select: {
        ...PUBLIC_INSTRUCTOR_SELECT,
        taughtCourses: {
          where: { course: { isPublished: true } },
          orderBy: { sortOrder: "asc" },
          select: { course: { select: { slug: true, title: true } } },
        },
      },
      orderBy: { displayName: "asc" },
    });

    return profiles.map(({ taughtCourses, ...rest }) => ({
      ...rest,
      courses: taughtCourses.map((row) => row.course),
    }));
  }
}

export interface MonthlyPoint {
  month: string;
  grossRial: number;
  shareRial: number;
  orders: number;
}

function emptyTotals() {
  return { grossRial: 0, shareRial: 0, students: 0 };
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
