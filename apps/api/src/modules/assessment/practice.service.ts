import { randomUUID } from "node:crypto";
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { AttemptStatus, ExamMode, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { ProfileService } from "../identity/profile/profile.service";
import { AssessmentService } from "./assessment.service";
import { BuildPracticeDto, PracticeSource, PreviewPracticeDto } from "./dto/build-practice.dto";

/** A student may build this many practice exams per rolling day. Each one is
 * a row set in exams/exam_forms/exam_items, so the cap keeps a script from
 * filling the tables; no honest study day comes near it. */
export const PRACTICE_DAILY_LIMIT = 30;

/** Default time per question when the student does not set one: close to
 * the pace of the computer-engineering master's konkur. */
export const PRACTICE_MINUTES_PER_QUESTION = 1.5;

const SOURCE_LABEL: Record<PracticeSource, string> = {
  ALL: "همهٔ سؤال‌ها",
  UNSEEN: "سؤال‌های ندیده",
  MISTAKES: "سؤال‌هایی که اشتباه زده‌ام",
};

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface CountRow {
  subjectCode: string;
  topicCode: string | null;
  isSample: boolean;
  count: bigint;
}

/**
 * The student test builder. A practice exam is an ordinary STATIC exam whose
 * form is drawn once, at build time, from the questions this student may see:
 * public samples of any subject, plus every question of a subject whose bank
 * they have bought (directly or with a course). The attempt, timer, autosave,
 * grading and report are the shared assessment flow, so a practice exam can
 * never reveal more than the bank itself would.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly profiles: ProfileService,
    private readonly assessment: AssessmentService,
  ) {}

  /**
   * What the builder form offers: every subject with questions in the bank,
   * its topics, and for each how many questions exist and how many of them
   * this student can draw. The counts are real so the form can say plainly
   * "8 of 120 are open to you" rather than failing after submit.
   */
  async options(userId: string) {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT q."subjectCode", t."topicCode", q."isSample", COUNT(*)::bigint AS "count"
      FROM "questions" q
      LEFT JOIN LATERAL unnest(q."topicCodes") AS t("topicCode") ON TRUE
      WHERE q."retiredAt" IS NULL
      GROUP BY q."subjectCode", t."topicCode", q."isSample"
    `);
    // Subject totals must count each question once, not once per topic.
    const subjectRows = await this.prisma.question.groupBy({
      by: ["subjectCode", "isSample"],
      where: { retiredAt: null },
      _count: { _all: true },
    });

    const subjectCodes = [...new Set(subjectRows.map((row) => row.subjectCode))];
    const [accessible, subjects, topics] = await Promise.all([
      this.access.accessibleQuestionBankSubjects(userId, subjectCodes),
      this.prisma.subject.findMany({ where: { code: { in: subjectCodes } }, select: { code: true, title: true, slug: true, order: true } }),
      this.prisma.topic.findMany({
        where: { subject: { code: { in: subjectCodes } } },
        select: { code: true, title: true, order: true },
      }),
    ]);
    const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));
    const topicByCode = new Map(topics.map((topic) => [topic.code, topic]));

    const totals = new Map<string, { total: number; sample: number }>();
    for (const row of subjectRows) {
      const entry = totals.get(row.subjectCode) ?? { total: 0, sample: 0 };
      entry.total += row._count._all;
      if (row.isSample) entry.sample += row._count._all;
      totals.set(row.subjectCode, entry);
    }
    const topicTotals = new Map<string, Map<string, { total: number; sample: number }>>();
    for (const row of rows) {
      if (!row.topicCode) continue;
      const bySubject = topicTotals.get(row.subjectCode) ?? new Map<string, { total: number; sample: number }>();
      const entry = bySubject.get(row.topicCode) ?? { total: 0, sample: 0 };
      entry.total += Number(row.count);
      if (row.isSample) entry.sample += Number(row.count);
      bySubject.set(row.topicCode, entry);
      topicTotals.set(row.subjectCode, bySubject);
    }

    return subjectCodes
      .map((code) => {
        const hasBankAccess = accessible.has(code);
        const count = totals.get(code)!;
        const subject = subjectByCode.get(code);
        return {
          code,
          title: subject?.title ?? code,
          slug: subject?.slug ?? null,
          order: subject?.order ?? Number.MAX_SAFE_INTEGER,
          hasBankAccess,
          total: count.total,
          available: hasBankAccess ? count.total : count.sample,
          topics: [...(topicTotals.get(code) ?? new Map()).entries()]
            .map(([topicCode, topicCount]) => ({
              code: topicCode,
              title: topicByCode.get(topicCode)?.title ?? topicCode,
              order: topicByCode.get(topicCode)?.order ?? Number.MAX_SAFE_INTEGER,
              total: topicCount.total,
              available: hasBankAccess ? topicCount.total : topicCount.sample,
            }))
            .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "fa")),
        };
      })
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "fa"));
  }

  /** Questions this student has answered, split into the ones whose latest
   * graded answer was wrong. Only finished attempts count: an answer in an
   * attempt still under way has not been marked yet. */
  private async history(userId: string, subjectCode: string) {
    const answers = await this.prisma.answer.findMany({
      where: {
        attempt: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] } },
        question: { subjectCode },
      },
      orderBy: { answeredAt: "asc" },
      select: { questionId: true, selectedOption: true, question: { select: { correctOption: true } } },
    });
    const seen = new Set<string>();
    const latestWrong = new Map<string, boolean>();
    for (const answer of answers) {
      seen.add(answer.questionId);
      if (answer.selectedOption == null) continue;
      latestWrong.set(answer.questionId, answer.selectedOption !== answer.question.correctOption);
    }
    return { seen, mistakes: new Set([...latestWrong].filter(([, wrong]) => wrong).map(([id]) => id)) };
  }

  /** The question ids this student may draw for one choice of subject,
   * topics and source. Shared by the preview and the build, so the number the
   * form shows is the number the build works with. */
  private async candidates(userId: string, dto: PreviewPracticeDto) {
    const subject = await this.prisma.subject.findUnique({ where: { code: dto.subjectCode }, select: { title: true } });
    const hasBankAccess = await this.access.hasActiveQuestionBankAccess(userId, dto.subjectCode);
    const topicCodes = [...new Set(dto.topicCodes ?? [])];

    const where: Prisma.QuestionWhereInput = { subjectCode: dto.subjectCode, retiredAt: null };
    if (!hasBankAccess) where.isSample = true;
    if (topicCodes.length) where.topicCodes = { hasSome: topicCodes };
    const pool = await this.prisma.question.findMany({ where, select: { id: true } });
    if (pool.length === 0 && !subject) {
      const exists = await this.prisma.question.count({ where: { subjectCode: dto.subjectCode, retiredAt: null } });
      if (!exists) throw new NotFoundException("subject not found");
    }

    const source = dto.source ?? "ALL";
    let ids = pool.map((question) => question.id);
    if (source !== "ALL") {
      const { seen, mistakes } = await this.history(userId, dto.subjectCode);
      ids = ids.filter((id) => (source === "UNSEEN" ? !seen.has(id) : mistakes.has(id)));
    }
    return { ids, hasBankAccess, subject, topicCodes, source };
  }

  async preview(userId: string, dto: PreviewPracticeDto) {
    const { ids, hasBankAccess } = await this.candidates(userId, dto);
    return { available: ids.length, hasBankAccess };
  }

  async build(userId: string, dto: BuildPracticeDto) {
    // Checked before anything is written, so a student missing their profile
    // does not leave a practice exam they cannot start.
    await this.profiles.assertExamReady(userId);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const builtToday = await this.prisma.exam.count({ where: { ownerUserId: userId, isPractice: true, createdAt: { gte: since } } });
    if (builtToday >= PRACTICE_DAILY_LIMIT) {
      throw new HttpException(
        `you can build at most ${PRACTICE_DAILY_LIMIT} practice exams a day`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { ids: candidates, hasBankAccess, subject, topicCodes, source } = await this.candidates(userId, dto);

    // Too few for the exact count asked is refused, not quietly shortened:
    // the student set the count as part of their plan, and the message says
    // what is available so the form can offer it.
    if (candidates.length < dto.questionCount) {
      throw new BadRequestException({
        statusCode: 400,
        error: "Bad Request",
        message: "not enough questions for this practice exam",
        available: candidates.length,
        hasBankAccess,
      });
    }

    const chosen = shuffle(candidates).slice(0, dto.questionCount);
    const durationMinutes = dto.durationMinutes ?? Math.ceil(dto.questionCount * PRACTICE_MINUTES_PER_QUESTION);
    const topics = topicCodes.length
      ? await this.prisma.topic.findMany({ where: { code: { in: topicCodes } }, select: { title: true } })
      : [];
    const scope = topics.length ? topics.map((topic) => topic.title).join("، ") : "همهٔ مباحث";

    const exam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          slug: `practice-${randomUUID()}`,
          title: `آزمون تمرینی ${subject?.title ?? dto.subjectCode}`,
          description: `${dto.questionCount} سؤال · ${scope} · ${SOURCE_LABEL[source]}`,
          mode: ExamMode.STATIC,
          durationMinutes,
          subjectCode: dto.subjectCode,
          questionCount: dto.questionCount,
          isPublished: false,
          isPractice: true,
          ownerUserId: userId,
          createdBy: userId,
        },
      });
      const form = await tx.examForm.create({ data: { examId: created.id } });
      await tx.examItem.createMany({
        data: chosen.map((questionId, order) => ({ examFormId: form.id, questionId, order })),
      });
      return created;
    });

    const attempt = await this.assessment.startAttempt(exam.id, userId);
    return { examId: exam.id, attempt };
  }

  /** The student's practice exams, newest first, with their latest attempt,
   * so the builder page can offer "continue" and "retake". */
  async list(userId: string) {
    const exams = await this.prisma.exam.findMany({
      where: { ownerUserId: userId, isPractice: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        questionCount: true,
        subjectCode: true,
        createdAt: true,
        attempts: {
          where: { userId },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            deadlineAt: true,
            submittedAt: true,
            score: { select: { correctCount: true, wrongCount: true, unansweredCount: true, percentCorrect: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
    return exams.map(({ attempts, _count, ...exam }) => ({
      ...exam,
      attemptCount: _count.attempts,
      latestAttempt: attempts[0] ?? null,
    }));
  }
}
