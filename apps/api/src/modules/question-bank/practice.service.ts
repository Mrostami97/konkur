import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AnswerConfidence, PracticeErrorReason, PracticeOutcome, Prisma, QuestionKeyState, QuestionQuality } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { isAcceptedAnswer } from "../ingestion/question-payload";

/** How many past outcomes a question's history line shows. */
const HISTORY_LENGTH = 6;

/**
 * The smart collections a student can practise from, built from their own
 * answers and marks:
 * - unseen: never answered;
 * - wrong: wrong at least once;
 * - never_right: answered, never once right;
 * - last_two_wrong: the last two answers both wrong (the question is not theirs yet);
 * - last_wrong: the last answer wrong;
 * - sure_but_wrong: wrong while marked "sure" -- a misconception, not a gap;
 * - starred, noted: their own marks.
 */
export const COLLECTIONS = ["unseen", "wrong", "never_right", "last_two_wrong", "last_wrong", "sure_but_wrong", "starred", "noted"] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface QuestionHistory {
  seen: number;
  /** Oldest first, at most HISTORY_LENGTH. */
  outcomes: PracticeOutcome[];
  lastAt: string | null;
  starred: boolean;
  note: string | null;
}

/**
 * Practice outside exams: a student answers a bank question, the server
 * grades it from the key and keeps the answer, so the question can say how it
 * has gone for them and the bank can serve their weak spots back to them.
 * Only a question the student may read (a sample, or their bank) is graded.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async readable(userId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, retiredAt: null, qualityTier: { not: QuestionQuality.DRAFT } },
      select: { id: true, subjectCode: true, isSample: true, correctOption: true, acceptedOptions: true, keyState: true },
    });
    if (!question) throw new NotFoundException("question not found");
    if (!question.isSample && !(await this.access.hasActiveQuestionBankAccess(userId, question.subjectCode))) {
      throw new ForbiddenException("this question opens with its subject's bank");
    }
    return question;
  }

  async record(userId: string, questionId: string, input: { selectedOption: number; confidence?: AnswerConfidence; timeSpentMs?: number }) {
    const question = await this.readable(userId, questionId);
    const outcome =
      question.keyState === QuestionKeyState.DELETED
        ? PracticeOutcome.VOID
        : isAcceptedAnswer(question, input.selectedOption)
          ? PracticeOutcome.CORRECT
          : PracticeOutcome.WRONG;
    const answer = await this.prisma.practiceAnswer.create({
      data: {
        userId,
        questionId,
        selectedOption: input.selectedOption,
        outcome,
        confidence: input.confidence ?? null,
        timeSpentMs: input.timeSpentMs != null ? Math.max(0, Math.min(Math.round(input.timeSpentMs), 6 * 3600 * 1000)) : null,
      },
      select: { id: true, outcome: true },
    });
    const history = await this.history(userId, [questionId]);
    return { answerId: answer.id, outcome: answer.outcome, history: history[questionId] };
  }

  /** The student's own reason for a wrong answer; only their own, only a wrong one. */
  async setReason(userId: string, answerId: string, reason: PracticeErrorReason | null) {
    const { count } = await this.prisma.practiceAnswer.updateMany({
      where: { id: answerId, userId, outcome: PracticeOutcome.WRONG },
      data: { errorReason: reason },
    });
    if (count === 0) throw new NotFoundException("answer not found");
    return { answerId, errorReason: reason };
  }

  /** Each question's history line and the student's marks on it. */
  async history(userId: string, questionIds: string[]): Promise<Record<string, QuestionHistory>> {
    const ids = [...new Set(questionIds)].slice(0, 200);
    if (ids.length === 0) return {};
    const [answers, marks] = await Promise.all([
      this.prisma.practiceAnswer.findMany({
        where: { userId, questionId: { in: ids } },
        orderBy: { createdAt: "asc" },
        select: { questionId: true, outcome: true, createdAt: true },
      }),
      this.prisma.questionMark.findMany({ where: { userId, questionId: { in: ids } }, select: { questionId: true, starred: true, note: true } }),
    ]);
    const result: Record<string, QuestionHistory> = {};
    for (const id of ids) result[id] = { seen: 0, outcomes: [], lastAt: null, starred: false, note: null };
    for (const answer of answers) {
      const entry = result[answer.questionId];
      entry.seen += 1;
      entry.outcomes.push(answer.outcome);
      entry.lastAt = answer.createdAt.toISOString();
    }
    for (const entry of Object.values(result)) entry.outcomes = entry.outcomes.slice(-HISTORY_LENGTH);
    for (const mark of marks) Object.assign(result[mark.questionId], { starred: mark.starred, note: mark.note });
    return result;
  }

  /**
   * The student's progress on one subject, per syllabus topic: how many of its
   * questions they have answered at least once, and how many they got right the
   * last time (a deleted question's VOID does not count either way).
   */
  async progress(userId: string, subjectCode: string): Promise<Record<string, { seen: number; right: number }>> {
    const answers = await this.prisma.practiceAnswer.findMany({
      where: { userId, question: { subjectCode, retiredAt: null } },
      orderBy: { createdAt: "asc" },
      select: { questionId: true, outcome: true, question: { select: { topicCodes: true } } },
    });
    const last = new Map<string, { topics: string[]; outcome: PracticeOutcome | null }>();
    for (const answer of answers) {
      const entry = last.get(answer.questionId) ?? { topics: answer.question.topicCodes, outcome: null };
      if (answer.outcome !== PracticeOutcome.VOID) entry.outcome = answer.outcome;
      last.set(answer.questionId, entry);
    }
    const result: Record<string, { seen: number; right: number }> = {};
    for (const { topics, outcome } of last.values()) {
      for (const topic of topics) {
        const row = (result[topic] ??= { seen: 0, right: 0 });
        row.seen += 1;
        if (outcome === PracticeOutcome.CORRECT) row.right += 1;
      }
    }
    return result;
  }

  /** Per subject, how many distinct questions the student has answered and how many were right the last time. */
  async progressSummary(userId: string): Promise<Record<string, { seen: number; right: number }>> {
    const answers = await this.prisma.practiceAnswer.findMany({
      where: { userId, question: { retiredAt: null } },
      orderBy: { createdAt: "asc" },
      select: { questionId: true, outcome: true, question: { select: { subjectCode: true } } },
    });
    const last = new Map<string, { subject: string; outcome: PracticeOutcome | null }>();
    for (const answer of answers) {
      const entry = last.get(answer.questionId) ?? { subject: answer.question.subjectCode, outcome: null };
      if (answer.outcome !== PracticeOutcome.VOID) entry.outcome = answer.outcome;
      last.set(answer.questionId, entry);
    }
    const result: Record<string, { seen: number; right: number }> = {};
    for (const { subject, outcome } of last.values()) {
      const row = (result[subject] ??= { seen: 0, right: 0 });
      row.seen += 1;
      if (outcome === PracticeOutcome.CORRECT) row.right += 1;
    }
    return result;
  }

  /** Stars or notes a question the student can see listed. An empty note clears it. */
  async mark(userId: string, questionId: string, input: { starred?: boolean; note?: string | null }) {
    const exists = await this.prisma.question.findFirst({ where: { id: questionId, retiredAt: null }, select: { id: true } });
    if (!exists) throw new NotFoundException("question not found");
    const note = input.note === undefined ? undefined : input.note?.trim() ? input.note.trim().slice(0, 2000) : null;
    const mark = await this.prisma.questionMark.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: { ...(input.starred !== undefined ? { starred: input.starred } : {}), ...(note !== undefined ? { note } : {}) },
      create: { userId, questionId, starred: input.starred ?? false, note: note ?? null },
      select: { starred: true, note: true },
    });
    return mark;
  }

  /**
   * The question filter for one smart collection. "unseen" is a relation
   * filter; the others are id sets from the student's own (small) history.
   */
  async collectionFilter(userId: string, collection: Collection): Promise<Prisma.QuestionWhereInput> {
    if (collection === "unseen") return { practiceAnswers: { none: { userId } } };
    if (collection === "starred") return { marks: { some: { userId, starred: true } } };
    if (collection === "noted") return { marks: { some: { userId, note: { not: null } } } };
    if (collection === "wrong") return { practiceAnswers: { some: { userId, outcome: PracticeOutcome.WRONG } } };
    if (collection === "sure_but_wrong") return { practiceAnswers: { some: { userId, outcome: PracticeOutcome.WRONG, confidence: AnswerConfidence.SURE } } };
    if (collection === "never_right") {
      return { practiceAnswers: { some: { userId, outcome: PracticeOutcome.WRONG }, none: { userId, outcome: PracticeOutcome.CORRECT } } };
    }
    // The last one or two answers per question: a window over the student's own answers.
    const depth = collection === "last_two_wrong" ? 2 : 1;
    const rows = await this.prisma.$queryRaw<{ questionId: string }[]>`
      SELECT "questionId" FROM (
        SELECT "questionId", "outcome", row_number() OVER (PARTITION BY "questionId" ORDER BY "createdAt" DESC) AS rn,
               count(*) OVER (PARTITION BY "questionId") AS n
        FROM "practice_answers" WHERE "userId" = ${userId} AND "outcome" <> 'VOID'
      ) recent
      WHERE rn <= ${depth} AND n >= ${depth}
      GROUP BY "questionId"
      HAVING bool_and("outcome" = 'WRONG')`;
    return { id: { in: rows.map((row) => row.questionId) } };
  }
}
