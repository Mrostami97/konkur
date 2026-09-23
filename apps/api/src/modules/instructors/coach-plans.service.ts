import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttemptStatus, CoachPlanStatus, ConsultationBookingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CoachPlanDto, CompleteCoachItemDto } from "./dto/coach-plan.dto";

const MAX_SPAN_DAYS = 31;

/** A YYYY-MM-DD string as the Date Prisma stores in a DATE column. */
function asDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`invalid date ${value}`);
  return date;
}

/** Today in Tehran, as a DATE-column value. */
function tehranToday(now: Date = new Date()) {
  return asDate(now.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" }));
}

const STUDENT_SUMMARY = {
  id: true,
  phone: true,
  profile: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      educationStatus: true,
      universityName: true,
      fieldOfStudy: true,
      targetDegree: true,
      targetField: true,
      targetExamYear: true,
    },
  },
} satisfies Prisma.UserSelect;

const ITEM_SELECT = {
  id: true,
  day: true,
  kind: true,
  title: true,
  subjectSlug: true,
  targetMinutes: true,
  targetCount: true,
  href: true,
  note: true,
  order: true,
  completedAt: true,
  actualMinutes: true,
  studentNote: true,
} satisfies Prisma.CoachPlanItemSelect;

const PLAN_SELECT = {
  id: true,
  title: true,
  startsOn: true,
  endsOn: true,
  note: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  items: { select: ITEM_SELECT, orderBy: [{ day: "asc" }, { order: "asc" }] },
} satisfies Prisma.CoachPlanSelect;

function progress(items: { completedAt: Date | null }[]) {
  const done = items.filter((item) => item.completedAt).length;
  return { total: items.length, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/**
 * Weekly study plans written by a consultant for a student they advise.
 *
 * The relationship is the consultation booking: an instructor may plan only
 * for a student who has booked them (any booking not cancelled). Anyone else
 * gets a 404, so the endpoints never confirm that a student or plan exists.
 * A student sees only published plans, and may only tick off their own tasks.
 */
@Injectable()
export class CoachPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- consultant ------------------------------------------------------------

  private async requireCoach(userId: string) {
    const coach = await this.prisma.contributorProfile.findUnique({
      where: { userId },
      select: { id: true, displayName: true },
    });
    if (!coach) throw new ForbiddenException("this account is not linked to an instructor profile");
    return coach;
  }

  private async assertCoachOf(coachId: string, studentUserId: string) {
    const booking = await this.prisma.consultationBooking.findFirst({
      where: {
        instructorProfileId: coachId,
        studentUserId,
        status: { not: ConsultationBookingStatus.CANCELLED },
      },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException("student not found");
  }

  private async ownedPlan(coachId: string, planId: string) {
    const plan = await this.prisma.coachPlan.findFirst({
      where: { id: planId, coachProfileId: coachId },
      select: { id: true, studentUserId: true, status: true, publishedAt: true },
    });
    if (!plan) throw new NotFoundException("plan not found");
    return plan;
  }

  private validatePlan(dto: CoachPlanDto) {
    const startsOn = asDate(dto.startsOn);
    const endsOn = asDate(dto.endsOn);
    if (endsOn < startsOn) throw new BadRequestException("endsOn must not be before startsOn");
    if ((endsOn.getTime() - startsOn.getTime()) / 86_400_000 > MAX_SPAN_DAYS) {
      throw new BadRequestException(`a plan covers at most ${MAX_SPAN_DAYS} days`);
    }
    for (const item of dto.items) {
      const day = asDate(item.day);
      if (day < startsOn || day > endsOn) {
        throw new BadRequestException(`task "${item.title}" falls outside the plan's dates`);
      }
    }
    return { startsOn, endsOn };
  }

  private itemData(item: CoachPlanDto["items"][number], order: number) {
    return {
      day: asDate(item.day),
      kind: item.kind,
      title: item.title.trim(),
      subjectSlug: item.subjectSlug ?? null,
      targetMinutes: item.targetMinutes ?? null,
      targetCount: item.targetCount ?? null,
      href: item.href ?? null,
      note: item.note?.trim() || null,
      order,
    };
  }

  /** Everyone who has booked this consultant, with their latest plan. */
  async listStudents(userId: string) {
    const coach = await this.requireCoach(userId);
    const bookings = await this.prisma.consultationBooking.findMany({
      where: { instructorProfileId: coach.id, status: { not: ConsultationBookingStatus.CANCELLED } },
      select: { studentUserId: true, status: true, scheduledAt: true, student: { select: STUDENT_SUMMARY } },
      orderBy: { createdAt: "desc" },
    });
    const students = new Map<string, { student: (typeof bookings)[number]["student"]; sessions: number; nextSessionAt: Date | null }>();
    const now = new Date();
    for (const booking of bookings) {
      const entry = students.get(booking.studentUserId) ?? { student: booking.student, sessions: 0, nextSessionAt: null };
      entry.sessions += 1;
      if (
        booking.status === ConsultationBookingStatus.CONFIRMED &&
        booking.scheduledAt &&
        booking.scheduledAt > now &&
        (!entry.nextSessionAt || booking.scheduledAt < entry.nextSessionAt)
      ) {
        entry.nextSessionAt = booking.scheduledAt;
      }
      students.set(booking.studentUserId, entry);
    }
    const plans = await this.prisma.coachPlan.findMany({
      where: { coachProfileId: coach.id, studentUserId: { in: [...students.keys()] }, status: { not: CoachPlanStatus.ARCHIVED } },
      orderBy: { startsOn: "desc" },
      select: { id: true, studentUserId: true, title: true, status: true, startsOn: true, endsOn: true, items: { select: { completedAt: true } } },
    });
    return [...students.values()].map((entry) => {
      const latest = plans.find((plan) => plan.studentUserId === entry.student.id);
      return {
        student: entry.student,
        sessions: entry.sessions,
        nextSessionAt: entry.nextSessionAt,
        latestPlan: latest
          ? { id: latest.id, title: latest.title, status: latest.status, startsOn: latest.startsOn, endsOn: latest.endsOn, ...progress(latest.items) }
          : null,
      };
    });
  }

  /** One advised student: profile, recent exam results and every plan. */
  async getStudent(userId: string, studentUserId: string) {
    const coach = await this.requireCoach(userId);
    await this.assertCoachOf(coach.id, studentUserId);
    const [student, attempts, plans] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: studentUserId }, select: STUDENT_SUMMARY }),
      this.prisma.attempt.findMany({
        where: { userId: studentUserId, status: AttemptStatus.SUBMITTED },
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: {
          id: true,
          submittedAt: true,
          exam: { select: { title: true } },
          score: { select: { percentCorrect: true, correctCount: true, wrongCount: true, unansweredCount: true } },
        },
      }),
      this.prisma.coachPlan.findMany({
        where: { coachProfileId: coach.id, studentUserId },
        orderBy: { startsOn: "desc" },
        select: PLAN_SELECT,
      }),
    ]);
    return { student, attempts, plans: plans.map((plan) => ({ ...plan, progress: progress(plan.items) })) };
  }

  async createPlan(userId: string, studentUserId: string, dto: CoachPlanDto) {
    const coach = await this.requireCoach(userId);
    await this.assertCoachOf(coach.id, studentUserId);
    const { startsOn, endsOn } = this.validatePlan(dto);
    if (dto.items.some((item) => item.id)) throw new BadRequestException("a new plan cannot reference existing tasks");
    const plan = await this.prisma.coachPlan.create({
      data: {
        studentUserId,
        coachProfileId: coach.id,
        title: dto.title.trim(),
        startsOn,
        endsOn,
        note: dto.note?.trim() || null,
        items: { create: dto.items.map((item, index) => this.itemData(item, index)) },
      },
      select: PLAN_SELECT,
    });
    await this.audit.log({
      actorUserId: userId,
      action: "coach_plan.created",
      targetType: "CoachPlan",
      targetId: plan.id,
      metadata: { studentUserId, items: dto.items.length },
    });
    return plan;
  }

  /**
   * Replaces the plan's contents. Tasks sent with their id are updated in
   * place and keep what the student already ticked off; tasks left out are
   * removed; tasks without an id are added.
   */
  async updatePlan(userId: string, planId: string, dto: CoachPlanDto) {
    const coach = await this.requireCoach(userId);
    const plan = await this.ownedPlan(coach.id, planId);
    const { startsOn, endsOn } = this.validatePlan(dto);
    const existing = await this.prisma.coachPlanItem.findMany({ where: { planId }, select: { id: true } });
    const existingIds = new Set(existing.map((item) => item.id));
    const keptIds = dto.items.flatMap((item) => (item.id ? [item.id] : []));
    if (keptIds.some((id) => !existingIds.has(id))) throw new BadRequestException("a task does not belong to this plan");

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.coachPlanItem.deleteMany({ where: { planId, id: { notIn: keptIds } } });
      for (const [index, item] of dto.items.entries()) {
        if (item.id) {
          await tx.coachPlanItem.update({ where: { id: item.id }, data: this.itemData(item, index) });
        } else {
          await tx.coachPlanItem.create({ data: { planId, ...this.itemData(item, index) } });
        }
      }
      return tx.coachPlan.update({
        where: { id: planId },
        data: { title: dto.title.trim(), startsOn, endsOn, note: dto.note?.trim() || null },
        select: PLAN_SELECT,
      });
    });
    await this.audit.log({
      actorUserId: userId,
      action: "coach_plan.updated",
      targetType: "CoachPlan",
      targetId: planId,
      metadata: { studentUserId: plan.studentUserId, items: dto.items.length },
    });
    return updated;
  }

  async setStatus(userId: string, planId: string, status: "PUBLISHED" | "ARCHIVED") {
    const coach = await this.requireCoach(userId);
    const plan = await this.ownedPlan(coach.id, planId);
    const updated = await this.prisma.coachPlan.update({
      where: { id: planId },
      data: {
        status,
        ...(status === "PUBLISHED" && !plan.publishedAt ? { publishedAt: new Date() } : {}),
      },
      select: PLAN_SELECT,
    });
    await this.audit.log({
      actorUserId: userId,
      action: status === "PUBLISHED" ? "coach_plan.published" : "coach_plan.archived",
      targetType: "CoachPlan",
      targetId: planId,
      metadata: { studentUserId: plan.studentUserId },
    });
    return updated;
  }

  /** Only a draft can be deleted: once the student has seen a plan, it is
   * archived instead, so what they ticked off is not silently lost. */
  async deleteDraft(userId: string, planId: string) {
    const coach = await this.requireCoach(userId);
    const plan = await this.ownedPlan(coach.id, planId);
    if (plan.status !== CoachPlanStatus.DRAFT) {
      throw new BadRequestException("only a draft can be deleted; archive a published plan instead");
    }
    await this.prisma.coachPlan.delete({ where: { id: planId } });
    await this.audit.log({
      actorUserId: userId,
      action: "coach_plan.deleted",
      targetType: "CoachPlan",
      targetId: planId,
      metadata: { studentUserId: plan.studentUserId },
    });
    return { id: planId, deleted: true };
  }

  // --- student ---------------------------------------------------------------

  /** The student's published plans: the ones covering today or later first,
   * then the most recent past ones. */
  async listForStudent(userId: string) {
    const today = tehranToday();
    const plans = await this.prisma.coachPlan.findMany({
      where: { studentUserId: userId, status: CoachPlanStatus.PUBLISHED },
      orderBy: { startsOn: "desc" },
      take: 12,
      select: { ...PLAN_SELECT, coach: { select: { displayName: true, slug: true, avatarUrl: true } } },
    });
    return {
      today: today.toISOString().slice(0, 10),
      plans: plans.map((plan) => ({ ...plan, progress: progress(plan.items), isCurrent: plan.startsOn <= today && plan.endsOn >= today })),
    };
  }

  private async studentItem(userId: string, itemId: string) {
    const item = await this.prisma.coachPlanItem.findFirst({
      where: { id: itemId, plan: { studentUserId: userId, status: CoachPlanStatus.PUBLISHED } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException("task not found");
    return item;
  }

  async completeItem(userId: string, itemId: string, dto: CompleteCoachItemDto) {
    await this.studentItem(userId, itemId);
    return this.prisma.coachPlanItem.update({
      where: { id: itemId },
      data: {
        completedAt: new Date(),
        actualMinutes: dto.actualMinutes ?? null,
        studentNote: dto.studentNote?.trim() || null,
      },
      select: ITEM_SELECT,
    });
  }

  async reopenItem(userId: string, itemId: string) {
    await this.studentItem(userId, itemId);
    return this.prisma.coachPlanItem.update({
      where: { id: itemId },
      data: { completedAt: null, actualMinutes: null },
      select: ITEM_SELECT,
    });
  }
}
