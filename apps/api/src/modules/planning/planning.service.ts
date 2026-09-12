import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AccessMode,
  Degree,
  PlanStatus,
  Prisma,
  ReviewStatus,
  SelfReportedLevel,
  StudySessionSource,
  TaskStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LearningService } from "../learning/learning.service";
import { UpsertGoalDto } from "./dto/upsert-goal.dto";
import { LogStudySessionDto } from "./dto/log-study-session.dto";
import { StudyHistoryQueryDto } from "./dto/study-history-query.dto";

const MASTERY_RULE_VERSION = "mastery-rule.v1";
const MASTERY_THRESHOLD = 0.6;
const RECENCY_HALF_LIFE_DAYS = 30;
const MAX_TASKS_PER_DAY = 3;
const PLAN_HORIZON_DAYS = 7;

type TaskCandidate = {
  subjectCode: string;
  topicCode?: string;
  title: string;
  lessonId?: string;
  resourceId?: string;
  estimatedMinutes?: number;
  reasonCode: string;
  score: number;
};

type PlanningDb = PrismaService | Prisma.TransactionClient;
type HistoryCursorKind = "session" | "plan";

type HistoryCursor = {
  v: 1;
  kind: HistoryCursorKind;
  sortAt: string;
  id: string;
};

function encodeHistoryCursor(kind: HistoryCursorKind, sortAt: Date, id: string) {
  const value: HistoryCursor = { v: 1, kind, sortAt: sortAt.toISOString(), id };
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeHistoryCursor(value: string, expectedKind: HistoryCursorKind) {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<HistoryCursor>;
    const sortAt = typeof decoded.sortAt === "string" ? new Date(decoded.sortAt) : null;
    if (
      decoded.v !== 1 ||
      decoded.kind !== expectedKind ||
      typeof decoded.id !== "string" ||
      decoded.id.length === 0 ||
      !sortAt ||
      Number.isNaN(sortAt.getTime())
    ) {
      throw new Error("invalid cursor payload");
    }
    return { sortAt, id: decoded.id };
  } catch {
    throw new BadRequestException(`invalid ${expectedKind} history cursor`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** Only explicit, numeric editorial metadata is treated as exam importance.
 * Missing metadata stays neutral and never becomes an invented exam claim. */
function examImportance(metadata: Prisma.JsonValue, degree: Degree, field: string): number | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata.examImportance ?? metadata.examWeight;
  const direct = positiveNumber(raw);
  if (direct !== null) return direct;
  if (!isRecord(raw)) return null;
  return (
    positiveNumber(raw[`${degree}:${field}`]) ??
    positiveNumber(raw[field]) ??
    positiveNumber(raw[degree]) ??
    positiveNumber(raw.default)
  );
}

function resourceMinutes(metadata: Prisma.JsonValue): number | undefined {
  if (!isRecord(metadata)) return undefined;
  const value = positiveNumber(metadata.estimatedMinutes ?? metadata.durationMinutes);
  return value === null ? undefined : Math.min(180, Math.max(5, Math.round(value)));
}

const tehranParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function dateParts(date: Date) {
  const parts = Object.fromEntries(tehranParts.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** UTC instant corresponding to midnight in the product's study timezone. */
export function startOfStudyDay(date: Date): Date {
  const local = dateParts(date);
  const noonProbe = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
  const noonLocal = dateParts(noonProbe);
  const offset = Date.UTC(
    noonLocal.year,
    noonLocal.month - 1,
    noonLocal.day,
    noonLocal.hour,
    noonLocal.minute,
    noonLocal.second,
  ) - noonProbe.getTime();
  return new Date(Date.UTC(local.year, local.month - 1, local.day) - offset);
}

export function canonicalGoalField(value: string) {
  const normalized = value.trim().toLowerCase().replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("‌", " ").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    "مهندسی کامپیوتر": "computer-engineering",
    "مهندسی و علم کامپیوتر": "computer-engineering",
    "computer engineering": "computer-engineering",
    "computer_engineering": "computer-engineering",
    "فناوری اطلاعات": "information-technology",
    "مهندسی فناوری اطلاعات": "information-technology",
    "آی تی": "information-technology",
    "آیتی": "information-technology",
    "it": "information-technology",
    "information_technology": "information-technology",
    "علوم کامپیوتر": "computer-science",
    "علم کامپیوتر": "computer-science",
    "computer science": "computer-science",
    "computer_science": "computer-science",
  };
  return aliases[normalized] ?? normalized;
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learning: LearningService,
  ) {}

  // --- Goal -------------------------------------------------------------

  async upsertGoal(userId: string, dto: UpsertGoalDto) {
    return this.prisma.goal.upsert({
      where: { userId },
      update: {
        degree: dto.degree as Degree,
        field: canonicalGoalField(dto.field),
        targetExamDate: dto.targetExamDate ? new Date(dto.targetExamDate) : null,
        weeklyHours: dto.weeklyHours,
        ...(dto.selfReportedLevel
          ? { selfReportedLevel: dto.selfReportedLevel as SelfReportedLevel }
          : {}),
      },
      create: {
        userId,
        degree: dto.degree as Degree,
        field: canonicalGoalField(dto.field),
        targetExamDate: dto.targetExamDate ? new Date(dto.targetExamDate) : null,
        weeklyHours: dto.weeklyHours,
        selfReportedLevel: (dto.selfReportedLevel ?? "UNKNOWN") as SelfReportedLevel,
      },
    });
  }

  async getGoal(userId: string) {
    return this.prisma.goal.findUnique({ where: { userId } });
  }

  // --- Mastery (doc §7: fixed formula -- correctness x recency, versioned) ---

  /**
   * Weighted-average correctness per topic, weighted by recency (a 30-day
   * half-life decay). Deliberately does NOT weight by item difficulty --
   * that would need a global per-question difficulty lookup that isn't
   * wired between Assessment and Planning yet (see AGENTS.md).
   */
  async computeMastery(userId: string, db: PlanningDb = this.prisma) {
    const answers = await db.answer.findMany({
      where: {
        selectedOption: { not: null },
        attempt: { userId, status: { in: ["SUBMITTED", "EXPIRED"] } },
      },
      include: { question: { select: { topicCodes: true, subjectCode: true, correctOption: true } } },
    });

    const byTopic = new Map<string, { subjectCode: string; weightedCorrect: number; weightTotal: number; count: number }>();
    const now = Date.now();

    for (const answer of answers) {
      const isCorrect = answer.selectedOption === answer.question.correctOption;
      const daysAgo = (now - answer.answeredAt.getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);

      for (const topicCode of answer.question.topicCodes) {
        const bucket = byTopic.get(topicCode) ?? {
          subjectCode: answer.question.subjectCode,
          weightedCorrect: 0,
          weightTotal: 0,
          count: 0,
        };
        bucket.weightedCorrect += (isCorrect ? 1 : 0) * weight;
        bucket.weightTotal += weight;
        bucket.count += 1;
        byTopic.set(topicCode, bucket);
      }
    }

    const results = [];
    for (const [topicCode, bucket] of byTopic) {
      const masteryScore = bucket.weightTotal > 0 ? bucket.weightedCorrect / bucket.weightTotal : 0;
      const confidence = bucket.count < 3 ? "LOW" : bucket.count < 8 ? "MEDIUM" : "HIGH";
      const state = await db.masteryState.upsert({
        where: { userId_topicCode: { userId, topicCode } },
        update: {
          subjectCode: bucket.subjectCode,
          masteryScore,
          confidence,
          evidenceCount: bucket.count,
          ruleVersion: MASTERY_RULE_VERSION,
          computedAt: new Date(),
        },
        create: {
          userId,
          subjectCode: bucket.subjectCode,
          topicCode,
          masteryScore,
          confidence,
          evidenceCount: bucket.count,
          ruleVersion: MASTERY_RULE_VERSION,
        },
      });
      results.push(state);
    }
    return results;
  }

  async getMasteryMap(userId: string) {
    const items = await this.prisma.masteryState.findMany({
      where: { userId },
      orderBy: { masteryScore: "asc" },
    });
    return items.map((item) => ({
      ...item,
      basis: "ASSESSMENT_EVIDENCE" as const,
      interpretation: "این امتیاز فقط از پاسخ‌های ارزیابی‌شده محاسبه شده است.",
    }));
  }

  // --- Plan / replan (doc §7 "کار بعدی" + "بازبرنامه‌ریزی") ------------------

  private async getActivePlan(userId: string) {
    return this.prisma.plan.findFirst({
      where: { userId, status: PlanStatus.ACTIVE },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: { tasks: true },
    });
  }

  private async canAccessResourceInPlan(
    db: PlanningDb,
    userId: string,
    resourceId: string,
    accessMode: AccessMode,
  ) {
    if (accessMode === AccessMode.PUBLIC || accessMode === AccessMode.ACCOUNT) return true;
    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: {
        userId,
        startAt: { lte: now },
        revokedAt: null,
        OR: [{ endAt: null }, { endAt: { gt: now } }],
        product: { resourceGrants: { some: { resourceId } } },
      },
      select: { id: true },
    });
    return Boolean(entitlement);
  }

  /** Deterministic planning from real assessment evidence, published learning
   * content, explicit prerequisites and the student's stated starting point.
   * A missing signal stays missing; it is never converted into fake mastery. */
  private async buildTasksForNewPlan(planId: string, userId: string, db: PlanningDb = this.prisma) {
    const goal = await db.goal.findUniqueOrThrow({ where: { userId } });
    const goalField = canonicalGoalField(goal.field);
    const masteryStates = await db.masteryState.findMany({
      where: { userId, masteryScore: { lt: MASTERY_THRESHOLD } },
      orderBy: { masteryScore: "asc" },
    });
    const masteryTopics = await db.topic.findMany({
      where: { code: { in: masteryStates.map((state) => state.topicCode) } },
      include: {
        subject: true,
        prerequisites: {
          include: { prerequisite: { include: { subject: true } } },
        },
      },
    });
    const topicByCode = new Map(masteryTopics.map((topic) => [topic.code, topic]));
    const prerequisiteCodes = new Set(
      masteryTopics.flatMap((topic) => topic.prerequisites.map((link) => link.prerequisite.code)),
    );

    const courses = await db.course.findMany({
      where: {
        isPublished: true,
        AND: [
          { OR: [{ degreeTargets: { isEmpty: true } }, { degreeTargets: { has: goal.degree } }] },
          { OR: [{ fieldTargets: { isEmpty: true } }, { fieldTargets: { has: goalField } }] },
        ],
      },
      include: {
        subject: {
          include: { prerequisites: { include: { prerequisite: true } } },
        },
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                topics: { include: { topic: { include: { subject: true } } } },
                progress: { where: { userId }, select: { completedAt: true } },
              },
            },
          },
        },
      },
    });
    const accessibleCourses = [];
    for (const course of courses) {
      if (
        course.accessMode !== AccessMode.ENTITLEMENT ||
        (await this.learning.hasActiveCourseEntitlement(userId, course.id, db))
      ) {
        accessibleCourses.push(course);
      }
    }

    const resources = await db.resource.findMany({
      where: {
        reviewStatus: ReviewStatus.PUBLISHED,
        AND: [
          { OR: [{ taxonomyDegrees: { isEmpty: true } }, { taxonomyDegrees: { has: goal.degree } }] },
          { OR: [{ taxonomyFields: { isEmpty: true } }, { taxonomyFields: { has: goalField } }] },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    const saved = await db.savedResource.findMany({
      where: { userId },
      select: { resourceId: true, completedAt: true },
    });
    const savedIds = new Set(saved.map((item) => item.resourceId));
    const completedSavedIds = new Set(
      saved.filter((item) => item.completedAt !== null).map((item) => item.resourceId),
    );

    const candidates = new Map<string, TaskCandidate>();
    const addCandidate = (key: string, candidate: TaskCandidate) => {
      const current = candidates.get(key);
      if (!current || candidate.score > current.score) candidates.set(key, candidate);
    };

    for (const state of masteryStates) {
      const topic = topicByCode.get(state.topicCode);
      for (const link of topic?.prerequisites ?? []) {
        const prerequisite = link.prerequisite;
        addCandidate(`topic:${prerequisite.code}`, {
          subjectCode: prerequisite.subject.code,
          topicCode: prerequisite.code,
          title: `مرور پیش‌نیاز «${prerequisite.title}»`,
          reasonCode: "PREREQUISITE_FOR_WEAK_TOPIC",
          score: 150 + (1 - state.masteryScore) * 20,
        });
      }
      const importance = examImportance(topic?.metadata ?? {}, goal.degree, goalField);
      addCandidate(`topic:${state.topicCode}`, {
        subjectCode: state.subjectCode,
        topicCode: state.topicCode,
        title: `مرور مبحث «${topic?.title ?? state.topicCode}»`,
        reasonCode: importance === null ? "LOW_MASTERY" : "LOW_MASTERY_AND_EXAM_IMPORTANCE",
        score: 120 + (1 - state.masteryScore) * 40 + (importance ?? 0) * 5,
      });
    }

    for (const course of accessibleCourses) {
      const courseImportance = examImportance(course.subject?.metadata ?? {}, goal.degree, goalField);
      for (const link of course.subject?.prerequisites ?? []) {
        addCandidate(`subject:${link.prerequisite.code}`, {
          subjectCode: link.prerequisite.code,
          title: `مرور پیش‌نیاز «${link.prerequisite.title}»`,
          reasonCode: "SUBJECT_PREREQUISITE",
          score: goal.selfReportedLevel === SelfReportedLevel.BEGINNER ? 140 : 95,
        });
      }

      const lessons = course.modules.flatMap((module) => module.lessons);
      const orderedLessons = goal.selfReportedLevel === SelfReportedLevel.ADVANCED
        ? [...lessons].reverse()
        : lessons;
      for (const [pathIndex, lesson] of orderedLessons.entries()) {
        if (lesson.progress.some((progress) => progress.completedAt)) continue;
        const topic = lesson.topics[0]?.topic;
        const subjectCode = course.subject?.code ?? topic?.subject.code ?? course.slug;
        const importance = examImportance(topic?.metadata ?? {}, goal.degree, goalField) ?? courseImportance;
        const isPrerequisite = lesson.topics.some((link) => prerequisiteCodes.has(link.topic.code));
        const levelReason = goal.selfReportedLevel === SelfReportedLevel.BEGINNER
          ? "SELF_REPORTED_BEGINNER"
          : goal.selfReportedLevel === SelfReportedLevel.ADVANCED
            ? "SELF_REPORTED_ADVANCED"
            : "CONTINUE_LEARNING_PATH";
        addCandidate(`lesson:${lesson.id}`, {
          subjectCode,
          topicCode: topic?.code,
          lessonId: lesson.id,
          title: `مطالعهٔ «${lesson.title}»`,
          reasonCode: isPrerequisite ? "PREREQUISITE_LESSON" : importance === null ? levelReason : "EXAM_IMPORTANCE",
          score:
            (isPrerequisite ? 130 : goal.selfReportedLevel === SelfReportedLevel.BEGINNER ? 110 : 80) +
            (importance ?? 0) * 5 - pathIndex / 100,
        });
      }
    }

    for (const resource of resources) {
      if (resource.subjectCodes.length === 0) continue;
      // A user-completed resource stays out of automatic proposals. The
      // explicit "add to plan" action below can intentionally reopen it.
      if (completedSavedIds.has(resource.id)) continue;
      if (!(await this.canAccessResourceInPlan(db, userId, resource.id, resource.accessMode))) continue;
      const importance = examImportance(resource.metadata, goal.degree, goalField);
      addCandidate(`resource:${resource.id}`, {
        subjectCode: resource.subjectCodes[0],
        topicCode: resource.topicCodes[0],
        resourceId: resource.id,
        title: `مطالعهٔ منبع «${resource.title}»`,
        estimatedMinutes: resourceMinutes(resource.metadata),
        reasonCode: savedIds.has(resource.id) ? "SAVED_RESOURCE" : importance === null ? "PUBLISHED_RESOURCE" : "EXAM_IMPORTANCE",
        score: (savedIds.has(resource.id) ? 115 : 70) + (importance ?? 0) * 5,
      });
    }

    const ranked = [...candidates.values()].sort((left, right) =>
      right.score - left.score || left.title.localeCompare(right.title, "fa"),
    );
    if (ranked.length === 0) return [];

    const weeklyMinutes = goal.weeklyHours * 60;
    const affordableTasks = Math.max(1, Math.floor(weeklyMinutes / 15));
    const taskCount = Math.min(ranked.length, PLAN_HORIZON_DAYS * MAX_TASKS_PER_DAY, affordableTasks);
    const baseMinutes = Math.min(90, Math.max(15, Math.floor(weeklyMinutes / taskCount)));
    const tasksData: Prisma.TaskCreateManyInput[] = ranked.slice(0, taskCount).map((candidate, index) => ({
      planId,
      subjectCode: candidate.subjectCode,
      topicCode: candidate.topicCode,
      lessonId: candidate.lessonId,
      resourceId: candidate.resourceId,
      title: candidate.title,
      estimatedMinutes: Math.min(candidate.estimatedMinutes ?? baseMinutes, baseMinutes),
      scheduledFor: new Date(startOfStudyDay(new Date()).getTime() + Math.floor(index / MAX_TASKS_PER_DAY) * 24 * 60 * 60 * 1000),
      priority: index + 1,
      reasonCode: candidate.reasonCode,
    }));
    await db.task.createMany({ data: tasksData });
    return tasksData;
  }

  private async generateFreshPlan(userId: string, reasonCode: string, summary: string) {
    // The per-user transaction lock serializes all fresh-plan replacements.
    // Archiving the old plan, creating/populating its replacement and writing
    // the revision either all commit or all roll back together.
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const goal = await tx.goal.findUnique({ where: { userId } });
      if (!goal) throw new BadRequestException("set a goal before generating a plan");

      await this.computeMastery(userId, tx);
      const latest = await tx.plan.findFirst({
        where: { userId },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        select: { version: true },
      });
      await tx.plan.updateMany({
        where: { userId, status: PlanStatus.ACTIVE },
        data: { status: PlanStatus.ARCHIVED },
      });

      const plan = await tx.plan.create({
        data: {
          goalId: goal.id,
          userId,
          version: (latest?.version ?? 0) + 1,
          goalDegree: goal.degree,
          goalField: goal.field,
          goalWeeklyHours: goal.weeklyHours,
          goalTargetExamDate: goal.targetExamDate,
          goalSelfReportedLevel: goal.selfReportedLevel,
        },
      });
      const tasks = await this.buildTasksForNewPlan(plan.id, userId, tx);
      await tx.planRevision.create({
        data: { planId: plan.id, reasonCode, summary: `${summary} (${tasks.length} کار ایجاد شد)` },
      });
      return tx.plan.findUniqueOrThrow({ where: { id: plan.id }, include: { tasks: true } });
    }, { timeout: 30_000 });
  }

  /** The DoD's explicit "falling behind" scenario: move overdue PENDING
   * tasks into the first days with free visible slots. */
  private async availableStudySlots(
    planId: string,
    count: number,
    excludedTaskIds: string[] = [],
    db: PlanningDb = this.prisma,
  ) {
    const today = startOfStudyDay(new Date());
    const scheduled = await db.task.findMany({
      where: {
        planId,
        status: TaskStatus.PENDING,
        scheduledFor: { gte: today },
        ...(excludedTaskIds.length > 0 ? { id: { notIn: excludedTaskIds } } : {}),
      },
      select: { scheduledFor: true },
    });
    const counts = new Map<string, number>();
    for (const task of scheduled) {
      const key = startOfStudyDay(task.scheduledFor).toISOString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const slots: Date[] = [];
    for (let day = 0; slots.length < count; day += 1) {
      const date = new Date(today.getTime() + day * 24 * 60 * 60 * 1000);
      const key = date.toISOString();
      const capacity = Math.max(0, MAX_TASKS_PER_DAY - (counts.get(key) ?? 0));
      for (let index = 0; index < capacity && slots.length < count; index += 1) slots.push(date);
    }
    return slots;
  }

  private async rescheduleOverdueTasks(userId: string, summary: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const plan = await tx.plan.findFirst({
        where: { userId, status: PlanStatus.ACTIVE },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        include: { tasks: true },
      });
      if (!plan) return { kind: "NO_PLAN" as const };
      const today = startOfStudyDay(new Date());
      const overdue = await tx.task.findMany({
        where: { planId: plan.id, status: TaskStatus.PENDING, scheduledFor: { lt: today } },
        orderBy: { priority: "asc" },
      });
      if (overdue.length === 0) return { kind: "NO_OVERDUE" as const };

      const slots = await this.availableStudySlots(plan.id, overdue.length, overdue.map((task) => task.id), tx);
      for (const [index, task] of overdue.entries()) {
        await tx.task.update({
          where: { id: task.id },
          data: { scheduledFor: slots[index], priority: index + 1 },
        });
      }
      await tx.plan.update({ where: { id: plan.id }, data: { version: { increment: 1 } } });
      await tx.planRevision.create({
        data: { planId: plan.id, reasonCode: "FALLING_BEHIND", summary: `${summary} (${overdue.length} کار عقب‌افتاده در نخستین ظرفیت‌های آزاد توزیع شد)` },
      });
      const updated = await tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { tasks: true },
      });
      return { kind: "RESCHEDULED" as const, plan: updated };
    }, { timeout: 30_000 });
  }

  async replan(userId: string, reasonCode: string | undefined, note: string | undefined) {
    const summary = note ?? "درخواست بازبرنامه‌ریزی";

    if (!reasonCode || reasonCode === "FALLING_BEHIND") {
      const outcome = await this.rescheduleOverdueTasks(userId, summary);
      if (outcome.kind === "RESCHEDULED") {
        return outcome.plan;
      }
      if (reasonCode === "FALLING_BEHIND" && outcome.kind === "NO_OVERDUE") {
        throw new BadRequestException("no overdue tasks to reschedule");
      }
      if (!reasonCode) {
        return this.generateFreshPlan(
          userId,
          outcome.kind === "NO_PLAN" ? "INITIAL_GENERATION" : "MANUAL_REQUEST",
          summary,
        );
      }
    }

    return this.generateFreshPlan(userId, reasonCode ?? "MANUAL_REQUEST", summary);
  }

  async getPlan(userId: string) {
    const plan = await this.getActivePlan(userId);
    if (!plan) throw new NotFoundException("no active plan; generate one first");
    return plan;
  }

  async getToday(userId: string) {
    const plan = await this.getActivePlan(userId);
    if (!plan) {
      return {
        tasks: [],
        summary: {
          totalTasks: 0,
          completedTasks: 0,
          plannedMinutes: 0,
          completedMinutes: 0,
          progressPercent: 0,
          message: "هنوز برنامه‌ای ساخته نشده است.",
        },
      };
    }
    const today = startOfStudyDay(new Date());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const [pending, completedToday] = await Promise.all([
      this.prisma.task.findMany({
        where: { planId: plan.id, status: TaskStatus.PENDING, scheduledFor: { lt: tomorrow } },
        include: {
          resource: { select: { slug: true } },
          lesson: {
            select: { id: true, courseModule: { select: { course: { select: { slug: true } } } } },
          },
        },
        orderBy: { priority: "asc" },
        take: MAX_TASKS_PER_DAY,
      }),
      this.prisma.task.findMany({
        where: {
          planId: plan.id,
          status: TaskStatus.DONE,
          completedAt: { gte: today, lt: tomorrow },
        },
        select: { id: true, status: true, estimatedMinutes: true },
      }),
    ]);
    const topicCodes = pending.flatMap((task) => task.topicCode ? [task.topicCode] : []);
    const subjectCodes = pending.map((task) => task.subjectCode);
    const [topics, subjects, mastery] = await Promise.all([
      this.prisma.topic.findMany({ where: { code: { in: topicCodes } }, select: { code: true, slug: true } }),
      this.prisma.subject.findMany({ where: { code: { in: subjectCodes } }, select: { code: true, slug: true } }),
      this.prisma.masteryState.findMany({
        where: { userId, topicCode: { in: topicCodes } },
        select: { topicCode: true, evidenceCount: true },
      }),
    ]);
    const topicSlugs = new Map(topics.map((topic) => [topic.code, topic.slug]));
    const subjectSlugs = new Map(subjects.map((subject) => [subject.code, subject.slug]));
    const evidence = new Map(mastery.map((state) => [state.topicCode, state.evidenceCount]));
    const tasks = pending.map((task) => ({
      ...task,
      actionType: task.lessonId ? "LESSON" : task.resourceId ? "RESOURCE" : task.topicCode ? "TOPIC" : "SUBJECT",
      href: task.lessonId
        ? `/lessons/${task.lessonId}`
        : task.resource?.slug
          ? `/resources/${task.resource.slug}`
          : task.topicCode && topicSlugs.has(task.topicCode)
            ? `/topics/${topicSlugs.get(task.topicCode)}`
            : subjectSlugs.has(task.subjectCode)
              ? `/subjects/${subjectSlugs.get(task.subjectCode)}`
              : null,
      reason: this.taskReason(task.reasonCode, task.topicCode ? evidence.get(task.topicCode) : undefined),
    }));
    const actualMinutes = completedToday.length > 0
      ? await this.prisma.studySession.aggregate({
          where: {
            userId,
            taskId: { in: completedToday.map((task) => task.id) },
            loggedAt: { gte: today, lt: tomorrow },
          },
          _sum: { minutes: true },
        })
      : null;
    const totalTasks = completedToday.length + pending.length;
    const hasFutureTasks = plan.tasks.some(
      (task) => task.status === TaskStatus.PENDING && task.scheduledFor.getTime() >= tomorrow.getTime(),
    );
    return {
      tasks,
      summary: {
        totalTasks,
        completedTasks: completedToday.length,
        plannedMinutes:
          completedToday.reduce((sum, task) => sum + task.estimatedMinutes, 0) +
          pending.reduce((sum, task) => sum + task.estimatedMinutes, 0),
        completedMinutes: actualMinutes?._sum.minutes ?? 0,
        progressPercent: totalTasks > 0 ? Math.round((completedToday.length / totalTasks) * 100) : 0,
        message: totalTasks === 0
          ? hasFutureTasks
            ? "اقدام‌های بعدی در روزهای آیندهٔ برنامه قرار دارند و برای امروز کاری باقی نمانده است."
            : plan.tasks.length > 0
              ? "اقدام‌های برنامهٔ فعلی تکمیل شده‌اند؛ در صورت نیاز برنامه را تازه‌سازی کن."
              : "محتوای منتشرشده و قابل‌دسترسی متناسب با هدف فعلی پیدا نشد؛ پیشنهاد ساختگی تولید نشد."
          : undefined,
      },
    };
  }

  private taskReason(reasonCode: string, evidenceCount?: number) {
    const evidenceSuffix = evidenceCount === undefined ? "" : ` (${evidenceCount} پاسخ ارزیابی‌شده)`;
    const reasons: Record<string, string> = {
      LOW_MASTERY: `این مبحث در شواهد آزمون فعلی نیاز به تمرین بیشتری دارد${evidenceSuffix}.`,
      LOW_MASTERY_AND_EXAM_IMPORTANCE: `هم شواهد آزمون نیاز به تمرین را نشان می‌دهد و هم اهمیت آزمونی برای آن ثبت شده است${evidenceSuffix}.`,
      PREREQUISITE_FOR_WEAK_TOPIC: "این مبحث پیش‌نیاز یک موضوع ضعیف‌تر در شواهد آزمون است.",
      SUBJECT_PREREQUISITE: "این درس پیش‌نیاز مسیر یادگیری انتخاب‌شده است.",
      PREREQUISITE_LESSON: "این درس پیش‌نیاز یک موضوع بعدی در مسیر فعلی است.",
      SELF_REPORTED_BEGINNER: "با توجه به سطح شروعی که خودت ثبت کرده‌ای، این درس زودتر پیشنهاد شده است.",
      SELF_REPORTED_ADVANCED: "با توجه به سطح پیشرفته‌ای که خودت ثبت کرده‌ای، این بخش جلوتر از مسیر قرار گرفته است.",
      CONTINUE_LEARNING_PATH: "این درس، گام بعدی تکمیل‌نشده در مسیر منتشرشده است.",
      EXAM_IMPORTANCE: "برای این محتوا اهمیت آزمونی صریح در دادهٔ تحریریه ثبت شده است.",
      SAVED_RESOURCE: "این همان منبعی است که قبلاً برای ادامه ذخیره کرده‌ای.",
      PUBLISHED_RESOURCE: "این منبع منتشرشده با مقطع و رشتهٔ هدف تو هماهنگ است.",
      USER_ADDED_RESOURCE: "این منبع را خودت به برنامهٔ مطالعه اضافه کرده‌ای.",
    };
    return reasons[reasonCode] ?? "این اقدام از اطلاعات واقعی هدف و مسیر فعلی انتخاب شده است.";
  }

  async getPlanRevisions(userId: string) {
    return this.prisma.planRevision.findMany({
      where: { plan: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }

  async completeTask(taskId: string, userId: string, actualMinutes?: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const task = await tx.task.findUnique({ where: { id: taskId }, include: { plan: true } });
      if (!task) throw new NotFoundException("task not found");
      if (task.plan.userId !== userId) throw new ForbiddenException("not your task");
      const currentPlan = await tx.plan.findFirst({
        where: { userId, status: PlanStatus.ACTIVE },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      if (task.plan.status !== PlanStatus.ACTIVE || currentPlan?.id !== task.planId) {
        throw new BadRequestException("task belongs to an archived plan; refresh the current plan");
      }
      const completedAt = new Date();
      const claimed = await tx.task.updateMany({
        where: { id: taskId, status: { not: TaskStatus.DONE } },
        data: { status: TaskStatus.DONE, completedAt },
      });
      if (claimed.count === 0) {
        const completed = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
        return { ...completed, studySessionRecorded: false };
      }
      if (actualMinutes !== undefined) {
        await tx.studySession.create({
          data: {
            userId,
            subjectCode: task.subjectCode,
            topicCode: task.topicCode,
            minutes: actualMinutes,
            taskId: task.id,
            source: StudySessionSource.TASK_ACTUAL,
          },
        });
      }
      if (task.lessonId) {
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: task.lessonId } },
          update: { completedAt, lastViewedAt: completedAt },
          create: { userId, lessonId: task.lessonId, completedAt, lastViewedAt: completedAt },
        });
      }
      if (task.resourceId) {
        await tx.savedResource.upsert({
          where: { userId_resourceId: { userId, resourceId: task.resourceId } },
          update: { completedAt },
          create: { userId, resourceId: task.resourceId, plannedAt: task.createdAt, completedAt },
        });
      }
      const completed = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
      return { ...completed, studySessionRecorded: actualMinutes !== undefined };
    }, { timeout: 30_000 });
  }

  // --- Study log --------------------------------------------------------

  async logStudySession(userId: string, dto: LogStudySessionDto) {
    return this.prisma.studySession.create({
      data: {
        userId,
        subjectCode: dto.subjectCode,
        topicCode: dto.topicCode,
        minutes: dto.minutes,
        taskId: dto.taskId,
        source: StudySessionSource.MANUAL,
      },
    });
  }

  async getStudyHistory(userId: string, query: StudyHistoryQueryDto = new StudyHistoryQueryDto()) {
    const limit = query.limit ?? 20;
    const section = query.section ?? "all";
    const sessionsCursor = query.sessionsCursor
      ? decodeHistoryCursor(query.sessionsCursor, "session")
      : null;
    const plansCursor = query.plansCursor
      ? decodeHistoryCursor(query.plansCursor, "plan")
      : null;
    const sessionWhere: Prisma.StudySessionWhereInput = {
      userId,
      ...(sessionsCursor
        ? {
            OR: [
              { loggedAt: { lt: sessionsCursor.sortAt } },
              { loggedAt: sessionsCursor.sortAt, id: { lt: sessionsCursor.id } },
            ],
          }
        : {}),
    };
    const planWhere: Prisma.PlanWhereInput = {
      userId,
      ...(plansCursor
        ? {
            OR: [
              { createdAt: { lt: plansCursor.sortAt } },
              { createdAt: plansCursor.sortAt, id: { lt: plansCursor.id } },
            ],
          }
        : {}),
    };
    const [sessionRows, planRows] = await Promise.all([
      section === "plans"
        ? Promise.resolve([])
        : this.prisma.studySession.findMany({
            where: sessionWhere,
            orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
            take: limit + 1,
          }),
      section === "sessions"
        ? Promise.resolve([])
        : this.prisma.plan.findMany({
            where: planWhere,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            select: {
              id: true,
              status: true,
              version: true,
              createdAt: true,
              goalDegree: true,
              goalField: true,
              goalWeeklyHours: true,
              goalTargetExamDate: true,
              goalSelfReportedLevel: true,
              _count: { select: { tasks: true, revisions: true } },
            },
          }),
    ]);
    const hasMoreSessions = sessionRows.length > limit;
    const hasMorePlans = planRows.length > limit;
    const sessions = sessionRows.slice(0, limit);
    const plans = planRows.slice(0, limit);
    const lastSession = sessions.at(-1);
    const lastPlan = plans.at(-1);
    return {
      basis: "RECORDED_ACTIVITY",
      sessions,
      plans: plans.map((plan) => ({
        ...plan,
        goalSnapshot: {
          degree: plan.goalDegree,
          field: plan.goalField,
          weeklyHours: plan.goalWeeklyHours,
          targetExamDate: plan.goalTargetExamDate,
          selfReportedLevel: plan.goalSelfReportedLevel,
        },
      })),
      pagination: {
        limit,
        sessions: {
          nextCursor: hasMoreSessions && lastSession
            ? encodeHistoryCursor("session", lastSession.loggedAt, lastSession.id)
            : null,
        },
        plans: {
          nextCursor: hasMorePlans && lastPlan
            ? encodeHistoryCursor("plan", lastPlan.createdAt, lastPlan.id)
            : null,
        },
      },
    };
  }

  async listSavedResources(userId: string) {
    const items = await this.prisma.savedResource.findMany({
      where: { userId, resource: { reviewStatus: ReviewStatus.PUBLISHED } },
      orderBy: { savedAt: "desc" },
      include: {
        resource: {
          select: {
            slug: true,
            title: true,
            summary: true,
            kind: true,
            accessMode: true,
            subjectCodes: true,
            topicCodes: true,
          },
        },
      },
    });
    return { items };
  }

  private async publishedResourceBySlug(resourceSlug: string) {
    const resource = await this.prisma.resource.findUnique({ where: { slug: resourceSlug } });
    if (!resource || resource.reviewStatus !== ReviewStatus.PUBLISHED) {
      throw new NotFoundException("resource not found");
    }
    return resource;
  }

  async saveResource(userId: string, resourceSlug: string) {
    const resource = await this.publishedResourceBySlug(resourceSlug);
    return this.prisma.savedResource.upsert({
      where: { userId_resourceId: { userId, resourceId: resource.id } },
      update: { savedAt: new Date() },
      create: { userId, resourceId: resource.id },
      include: { resource: { select: { slug: true, title: true } } },
    });
  }

  async removeSavedResource(userId: string, resourceSlug: string) {
    const resource = await this.publishedResourceBySlug(resourceSlug);
    const result = await this.prisma.savedResource.deleteMany({ where: { userId, resourceId: resource.id } });
    return { removed: result.count > 0 };
  }

  async addResourceToPlan(userId: string, resourceSlug: string) {
    const resource = await this.publishedResourceBySlug(resourceSlug);
    const subjectCode = resource.subjectCodes[0];
    if (!subjectCode) {
      throw new BadRequestException("resource needs a subject taxonomy before it can be planned");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      if (!(await this.canAccessResourceInPlan(tx, userId, resource.id, resource.accessMode))) {
        throw new ForbiddenException("no active access to this resource");
      }
      const goal = await tx.goal.findUnique({ where: { userId } });
      if (!goal) throw new BadRequestException("set a goal before adding content to a plan");
      let plan = await tx.plan.findFirst({
        where: { userId, status: PlanStatus.ACTIVE },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      });
      if (!plan) {
        const previous = await tx.plan.findFirst({
          where: { userId },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
          select: { version: true },
        });
        plan = await tx.plan.create({
          data: {
            goalId: goal.id,
            userId,
            version: (previous?.version ?? 0) + 1,
            goalDegree: goal.degree,
            goalField: goal.field,
            goalWeeklyHours: goal.weeklyHours,
            goalTargetExamDate: goal.targetExamDate,
            goalSelfReportedLevel: goal.selfReportedLevel,
          },
        });
        await tx.planRevision.create({
          data: { planId: plan.id, reasonCode: "CONTENT_ADDED", summary: "برنامه برای محتوای انتخاب‌شده ساخته شد" },
        });
      }
      const estimatedMinutes = resourceMinutes(resource.metadata)
        ?? Math.min(60, Math.max(15, Math.round(goal.weeklyHours * 60 / 21)));
      const existing = await tx.task.findFirst({ where: { planId: plan.id, resourceId: resource.id } });
      if (existing?.status === TaskStatus.PENDING) {
        const plannedAt = new Date();
        await tx.savedResource.upsert({
          where: { userId_resourceId: { userId, resourceId: resource.id } },
          update: { plannedAt, completedAt: null },
          create: { userId, resourceId: resource.id, plannedAt },
        });
        return;
      }
      const maxPriority = await tx.task.aggregate({
        where: { planId: plan.id },
        _max: { priority: true },
      });
      const [scheduledFor] = await this.availableStudySlots(plan.id, 1, [], tx);
      if (existing) {
        await tx.task.update({
          where: { id: existing.id },
          data: {
            status: TaskStatus.PENDING,
            completedAt: null,
            estimatedMinutes,
            scheduledFor,
            priority: (maxPriority._max.priority ?? 0) + 1,
            reasonCode: "USER_ADDED_RESOURCE",
          },
        });
      } else {
        await tx.task.create({
          data: {
            planId: plan.id,
            resourceId: resource.id,
            subjectCode,
            topicCode: resource.topicCodes[0],
            title: `مطالعهٔ منبع «${resource.title}»`,
            estimatedMinutes,
            scheduledFor,
            priority: (maxPriority._max.priority ?? 0) + 1,
            reasonCode: "USER_ADDED_RESOURCE",
          },
        });
      }
      const plannedAt = new Date();
      await tx.savedResource.upsert({
        where: { userId_resourceId: { userId, resourceId: resource.id } },
        update: { plannedAt, completedAt: null },
        create: { userId, resourceId: resource.id, plannedAt },
      });
      await tx.planRevision.create({
        data: { planId: plan.id, reasonCode: "RESOURCE_ADDED", summary: `منبع «${resource.title}» به برنامه اضافه شد` },
      });
    }, { timeout: 30_000 });
    return this.getToday(userId);
  }
}
