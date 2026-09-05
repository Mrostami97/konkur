import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree, PlanStatus, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpsertGoalDto } from "./dto/upsert-goal.dto";
import { LogStudySessionDto } from "./dto/log-study-session.dto";

const MASTERY_RULE_VERSION = "mastery-rule.v1";
const MASTERY_THRESHOLD = 0.6;
const RECENCY_HALF_LIFE_DAYS = 30;
const MINUTES_PER_TASK = 30;
const MAX_TASKS_PER_DAY = 5;
const PLAN_HORIZON_DAYS = 7;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Goal -------------------------------------------------------------

  async upsertGoal(userId: string, dto: UpsertGoalDto) {
    return this.prisma.goal.upsert({
      where: { userId },
      update: {
        degree: dto.degree as Degree,
        field: dto.field,
        targetExamDate: dto.targetExamDate ? new Date(dto.targetExamDate) : null,
        weeklyHours: dto.weeklyHours,
      },
      create: {
        userId,
        degree: dto.degree as Degree,
        field: dto.field,
        targetExamDate: dto.targetExamDate ? new Date(dto.targetExamDate) : null,
        weeklyHours: dto.weeklyHours,
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
  async computeMastery(userId: string) {
    const answers = await this.prisma.answer.findMany({
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
      const state = await this.prisma.masteryState.upsert({
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
    return this.prisma.masteryState.findMany({ where: { userId }, orderBy: { masteryScore: "asc" } });
  }

  // --- Plan / replan (doc §7 "کار بعدی" + "بازبرنامه‌ریزی") ------------------

  private async getActivePlan(userId: string) {
    return this.prisma.plan.findFirst({
      where: { userId, status: PlanStatus.ACTIVE },
      include: { tasks: true },
    });
  }

  /**
   * Rule-based task generation, no generative text: pick the weakest topics
   * (mastery < 0.6, or "no evidence yet" topics are simply skipped -- a
   * documented cold-start gap, see AGENTS.md) and round-robin them across
   * the next 7 days at a pace derived from the goal's weeklyHours.
   */
  private async buildTasksForNewPlan(planId: string, userId: string) {
    const masteryStates = await this.prisma.masteryState.findMany({
      where: { userId, masteryScore: { lt: MASTERY_THRESHOLD } },
      orderBy: { masteryScore: "asc" },
    });
    if (masteryStates.length === 0) return [];

    const goal = await this.prisma.goal.findUniqueOrThrow({ where: { userId } });
    const dailyMinutes = (goal.weeklyHours * 60) / 7;
    const tasksPerDay = Math.min(MAX_TASKS_PER_DAY, Math.max(1, Math.round(dailyMinutes / MINUTES_PER_TASK)));

    const tasksData = [];
    let cursor = 0;
    for (let day = 0; day < PLAN_HORIZON_DAYS; day++) {
      const scheduledFor = startOfDay(new Date(Date.now() + day * 24 * 60 * 60 * 1000));
      for (let slot = 0; slot < tasksPerDay; slot++) {
        const topic = masteryStates[cursor % masteryStates.length];
        cursor += 1;
        tasksData.push({
          planId,
          subjectCode: topic.subjectCode,
          topicCode: topic.topicCode,
          title: `مرور مبحث ${topic.topicCode}`,
          estimatedMinutes: MINUTES_PER_TASK,
          scheduledFor,
          priority: day * tasksPerDay + slot + 1,
          reasonCode: "LOW_MASTERY",
        });
      }
    }
    await this.prisma.task.createMany({ data: tasksData });
    return tasksData;
  }

  private async generateFreshPlan(userId: string, reasonCode: string, summary: string) {
    const goal = await this.prisma.goal.findUnique({ where: { userId } });
    if (!goal) throw new BadRequestException("set a goal before generating a plan");

    await this.computeMastery(userId);

    const previous = await this.getActivePlan(userId);
    if (previous) {
      await this.prisma.plan.update({ where: { id: previous.id }, data: { status: PlanStatus.ARCHIVED } });
    }

    const plan = await this.prisma.plan.create({
      data: { goalId: goal.id, userId, version: (previous?.version ?? 0) + 1 },
    });
    const tasks = await this.buildTasksForNewPlan(plan.id, userId);
    await this.prisma.planRevision.create({
      data: { planId: plan.id, reasonCode, summary: `${summary} (${tasks.length} کار ایجاد شد)` },
    });
    return this.prisma.plan.findUniqueOrThrow({ where: { id: plan.id }, include: { tasks: true } });
  }

  /** The DoD's explicit "falling behind" scenario: move overdue PENDING
   * tasks to today rather than rebuilding the whole plan from scratch. */
  private async rescheduleOverdueTasks(planId: string, summary: string) {
    const today = startOfDay(new Date());
    const overdue = await this.prisma.task.findMany({
      where: { planId, status: TaskStatus.PENDING, scheduledFor: { lt: today } },
    });
    if (overdue.length === 0) return null;

    for (const [index, task] of overdue.entries()) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { scheduledFor: today, priority: index + 1 },
      });
    }
    await this.prisma.plan.update({ where: { id: planId }, data: { version: { increment: 1 } } });
    await this.prisma.planRevision.create({
      data: { planId, reasonCode: "FALLING_BEHIND", summary: `${summary} (${overdue.length} کار عقب‌افتاده به امروز منتقل شد)` },
    });
    return overdue.length;
  }

  async replan(userId: string, reasonCode: string | undefined, note: string | undefined) {
    const activePlan = await this.getActivePlan(userId);
    const summary = note ?? "درخواست بازبرنامه‌ریزی";

    if (!activePlan) {
      return this.generateFreshPlan(userId, reasonCode ?? "INITIAL_GENERATION", summary);
    }

    if (!reasonCode || reasonCode === "FALLING_BEHIND") {
      const rescheduledCount = await this.rescheduleOverdueTasks(activePlan.id, summary);
      if (rescheduledCount !== null) {
        return this.prisma.plan.findUniqueOrThrow({ where: { id: activePlan.id }, include: { tasks: true } });
      }
      if (reasonCode === "FALLING_BEHIND") {
        throw new BadRequestException("no overdue tasks to reschedule");
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
    if (!plan) return { tasks: [] };
    const today = startOfDay(new Date());
    const tasks = await this.prisma.task.findMany({
      where: { planId: plan.id, status: TaskStatus.PENDING, scheduledFor: { lte: today } },
      orderBy: { priority: "asc" },
      take: 3,
    });
    return { tasks };
  }

  async getPlanRevisions(userId: string) {
    return this.prisma.planRevision.findMany({
      where: { plan: { userId } },
      orderBy: { createdAt: "desc" },
    });
  }

  async completeTask(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { plan: true } });
    if (!task) throw new NotFoundException("task not found");
    if (task.plan.userId !== userId) throw new ForbiddenException("not your task");

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.DONE, completedAt: new Date() },
    });
    await this.prisma.studySession.create({
      data: {
        userId,
        subjectCode: task.subjectCode,
        topicCode: task.topicCode,
        minutes: task.estimatedMinutes,
        taskId: task.id,
      },
    });
    return updated;
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
      },
    });
  }
}
