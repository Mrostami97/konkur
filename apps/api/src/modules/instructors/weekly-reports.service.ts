import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttemptStatus, CoachPlanStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CoachPlansService } from "./coach-plans.service";
import { ReviewWeeklyReportDto, SaveWeeklyReportDto } from "./dto/weekly-report.dto";

/** Iran has kept UTC+03:30 all year since 2022. */
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_WEEKS = 12;

/** The Saturday (UTC midnight, as Prisma stores a @db.Date) of the Tehran week `at` falls in. */
export function weekStartOf(at: Date): Date {
  const tehran = new Date(at.getTime() + TEHRAN_OFFSET_MS);
  const day = Date.UTC(tehran.getUTCFullYear(), tehran.getUTCMonth(), tehran.getUTCDate());
  const sinceSaturday = (new Date(day).getUTCDay() + 1) % 7;
  return new Date(day - sinceSaturday * DAY_MS);
}

/** The instants a Tehran week covers: Saturday 00:00 to the next Saturday 00:00. */
function weekRange(weekStart: Date) {
  const from = new Date(weekStart.getTime() - TEHRAN_OFFSET_MS);
  return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
}

const REPORT_SELECT = {
  id: true,
  weekStart: true,
  testsSolved: true,
  energy: true,
  wentWell: true,
  obstacles: true,
  questions: true,
  submittedAt: true,
  coachNote: true,
  reviewedAt: true,
  reviewedBy: { select: { displayName: true } },
} as const;

/**
 * The weekly report of a consultation student. The student writes what the
 * site cannot know (tests solved elsewhere, how the week went, what to ask);
 * everything the site already knows -- study minutes, exams taken, plan
 * tasks done -- is read from its own records for the same week, so the
 * consultant sees one picture before the weekly session.
 */
@Injectable()
export class WeeklyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly coaches: CoachPlansService,
  ) {}

  /** What the site recorded for each of these weeks. */
  private async summaries(studentUserId: string, weekStarts: Date[]) {
    if (weekStarts.length === 0) return new Map<number, WeekSummary>();
    const sorted = [...weekStarts].sort((a, b) => a.getTime() - b.getTime());
    const span = { from: weekRange(sorted[0]).from, to: weekRange(sorted[sorted.length - 1]).to };
    const [sessions, attempts, items] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId: studentUserId, loggedAt: { gte: span.from, lt: span.to } },
        select: { loggedAt: true, minutes: true, subjectCode: true },
      }),
      this.prisma.attempt.findMany({
        where: { userId: studentUserId, status: AttemptStatus.SUBMITTED, submittedAt: { gte: span.from, lt: span.to } },
        select: { submittedAt: true, exam: { select: { title: true } }, score: { select: { percentCorrect: true } } },
      }),
      this.prisma.coachPlanItem.findMany({
        where: {
          plan: { studentUserId, status: CoachPlanStatus.PUBLISHED },
          day: { gte: sorted[0], lt: new Date(sorted[sorted.length - 1].getTime() + 7 * DAY_MS) },
        },
        select: { day: true, completedAt: true },
      }),
    ]);

    const result = new Map<number, WeekSummary>();
    for (const start of weekStarts) {
      const { from, to } = weekRange(start);
      const inWeek = (at: Date | null) => Boolean(at && at >= from && at < to);
      const bySubject = new Map<string, number>();
      let studyMinutes = 0;
      for (const session of sessions) {
        if (!inWeek(session.loggedAt)) continue;
        studyMinutes += session.minutes;
        bySubject.set(session.subjectCode, (bySubject.get(session.subjectCode) ?? 0) + session.minutes);
      }
      const weekItems = items.filter((item) => item.day >= start && item.day.getTime() < start.getTime() + 7 * DAY_MS);
      result.set(start.getTime(), {
        studyMinutes,
        studyBySubject: [...bySubject.entries()].map(([subjectCode, minutes]) => ({ subjectCode, minutes })).sort((a, b) => b.minutes - a.minutes),
        exams: attempts
          .filter((attempt) => inWeek(attempt.submittedAt))
          .map((attempt) => ({ title: attempt.exam.title, submittedAt: attempt.submittedAt, percentCorrect: attempt.score?.percentCorrect ?? null })),
        planTasks: weekItems.length,
        planTasksDone: weekItems.filter((item) => item.completedAt).length,
      });
    }
    return result;
  }

  /** The last weeks, newest first, each with the report (if any) and the site's own figures. */
  private async weeks(studentUserId: string, now = new Date()) {
    const current = weekStartOf(now);
    const weekStarts = Array.from({ length: HISTORY_WEEKS }, (_, index) => new Date(current.getTime() - index * 7 * DAY_MS));
    const [reports, summaries] = await Promise.all([
      this.prisma.weeklyReport.findMany({
        where: { studentUserId, weekStart: { gte: weekStarts[weekStarts.length - 1] } },
        select: REPORT_SELECT,
      }),
      this.summaries(studentUserId, weekStarts),
    ]);
    const byWeek = new Map(reports.map((report) => [report.weekStart.getTime(), report]));
    return weekStarts.map((weekStart) => ({
      weekStart,
      report: byWeek.get(weekStart.getTime()) ?? null,
      summary: summaries.get(weekStart.getTime())!,
    }));
  }

  // --- the student ------------------------------------------------------------

  async mine(userId: string) {
    const weeks = await this.weeks(userId);
    return { currentWeekStart: weeks[0].weekStart, weeks };
  }

  /** Writes this week's report; `submit` marks it ready for the consultant. */
  async saveCurrent(userId: string, dto: SaveWeeklyReportDto) {
    const weekStart = weekStartOf(new Date());
    const clean = (value: string | undefined) => value?.trim() || null;
    const data = {
      testsSolved: dto.testsSolved,
      energy: dto.energy ?? null,
      wentWell: clean(dto.wentWell),
      obstacles: clean(dto.obstacles),
      questions: clean(dto.questions),
      ...(dto.submit ? { submittedAt: new Date() } : {}),
    };
    if (dto.submit && !data.wentWell && !data.obstacles && !data.questions) {
      throw new BadRequestException("پیش از ارسال، دست‌کم یکی از بخش‌های متنی گزارش را بنویس.");
    }
    const report = await this.prisma.weeklyReport.upsert({
      where: { studentUserId_weekStart: { studentUserId: userId, weekStart } },
      update: data,
      create: { studentUserId: userId, weekStart, ...data },
      select: REPORT_SELECT,
    });
    if (dto.submit) {
      await this.audit.log({ actorUserId: userId, action: "weekly_report.submitted", targetType: "WeeklyReport", targetId: report.id });
    }
    return report;
  }

  // --- the consultant ---------------------------------------------------------

  async forCoach(coachUserId: string, studentUserId: string) {
    const coach = await this.coaches.requireCoach(coachUserId);
    await this.coaches.assertCoachOf(coach.id, studentUserId);
    return this.weeks(studentUserId);
  }

  /** The consultant's feedback on a report, shown to the student. */
  async review(coachUserId: string, reportId: string, dto: ReviewWeeklyReportDto) {
    const coach = await this.coaches.requireCoach(coachUserId);
    const report = await this.prisma.weeklyReport.findUnique({ where: { id: reportId }, select: { studentUserId: true } });
    if (!report) throw new NotFoundException("report not found");
    await this.coaches.assertCoachOf(coach.id, report.studentUserId);
    const updated = await this.prisma.weeklyReport.update({
      where: { id: reportId },
      data: { coachNote: dto.coachNote.trim(), reviewedAt: new Date(), reviewedByProfileId: coach.id },
      select: REPORT_SELECT,
    });
    await this.audit.log({ actorUserId: coachUserId, action: "weekly_report.reviewed", targetType: "WeeklyReport", targetId: reportId });
    return updated;
  }
}

export interface WeekSummary {
  studyMinutes: number;
  studyBySubject: { subjectCode: string; minutes: number }[];
  exams: { title: string; submittedAt: Date | null; percentCorrect: number | null }[];
  planTasks: number;
  planTasksDone: number;
}
