import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttemptStatus, ExamMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { AddExamItemDto } from "./dto/add-exam-item.dto";

const SCORE_VERSION = "score-rule.v1";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Strips the answer key so an in-progress attempt never leaks it to the student. */
function stripAnswerKey<
  T extends { question: { correctOption: number; solutionBlocks: unknown; [key: string]: unknown } },
>(item: T) {
  const { correctOption, solutionBlocks, ...rest } = item.question;
  void correctOption;
  void solutionBlocks;
  return { ...item, question: rest };
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Exam builder (admin) -------------------------------------------------

  async createExam(actorId: string, dto: CreateExamDto) {
    const exam = await this.prisma.exam.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        mode: dto.mode as ExamMode,
        durationMinutes: dto.durationMinutes,
        subjectCode: dto.subjectCode,
        questionCount: dto.questionCount,
        createdBy: actorId,
      },
    });
    if (dto.mode === "STATIC") {
      // STATIC exams share one form that the admin populates via addExamItem.
      await this.prisma.examForm.create({ data: { examId: exam.id } });
    }
    await this.audit.log({
      actorUserId: actorId,
      action: "exam.created",
      targetType: "Exam",
      targetId: exam.id,
    });
    return exam;
  }

  async addExamItem(examId: string, dto: AddExamItemDto) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, include: { forms: true } });
    if (!exam) throw new NotFoundException("exam not found");
    if (exam.mode !== ExamMode.STATIC) {
      throw new BadRequestException("only STATIC exams have a manually-curated form");
    }
    const form = exam.forms[0];
    if (!form) throw new NotFoundException("exam form not found");
    return this.prisma.examItem.create({
      data: {
        examFormId: form.id,
        questionId: dto.questionId,
        order: dto.order,
        points: dto.points ?? 1,
      },
    });
  }

  async publishExam(examId: string, actorId: string) {
    const exam = await this.prisma.exam.update({ where: { id: examId }, data: { isPublished: true } });
    await this.audit.log({
      actorUserId: actorId,
      action: "exam.published",
      targetType: "Exam",
      targetId: examId,
    });
    return exam;
  }

  listAllExams() {
    return this.prisma.exam.findMany({
      include: { forms: { include: { _count: { select: { items: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Public catalog -----------------------------------------------------

  listPublishedExams() {
    return this.prisma.exam.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getExamBySlug(slug: string) {
    const exam = await this.prisma.exam.findUnique({ where: { slug } });
    if (!exam || !exam.isPublished) throw new NotFoundException("exam not found");
    return exam;
  }

  // --- Attempts -------------------------------------------------------------

  async startAttempt(examId: string, userId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, include: { forms: true } });
    if (!exam || !exam.isPublished) throw new NotFoundException("exam not found");

    const inProgress = await this.prisma.attempt.findFirst({
      where: { examId, userId, status: AttemptStatus.IN_PROGRESS },
    });
    if (inProgress) return this.getAttempt(inProgress.id, userId); // resume, don't double-start

    let formId: string;
    if (exam.mode === ExamMode.STATIC) {
      const form = exam.forms[0];
      if (!form) throw new BadRequestException("exam has no form configured yet");
      formId = form.id;
    } else {
      if (!exam.subjectCode || !exam.questionCount) {
        throw new BadRequestException("DYNAMIC exam is missing subjectCode/questionCount");
      }
      const candidates = await this.prisma.question.findMany({
        where: { subjectCode: exam.subjectCode },
        select: { id: true },
      });
      if (candidates.length < exam.questionCount) {
        throw new BadRequestException("not enough published questions to build this exam");
      }
      const chosen = shuffle(candidates).slice(0, exam.questionCount);
      const form = await this.prisma.examForm.create({ data: { examId } });
      await this.prisma.examItem.createMany({
        data: chosen.map((q, index) => ({ examFormId: form.id, questionId: q.id, order: index })),
      });
      formId = form.id;
    }

    const attempt = await this.prisma.attempt.create({
      data: {
        examId,
        examFormId: formId,
        userId,
        deadlineAt: new Date(Date.now() + exam.durationMinutes * 60_000),
      },
    });
    return this.getAttempt(attempt.id, userId);
  }

  /** Resume: current state, remaining time, saved answers, no answer key. */
  async getAttempt(
    attemptId: string,
    userId: string,
  ): Promise<{
    id: string;
    examTitle: string;
    status: AttemptStatus;
    startedAt: Date;
    deadlineAt: Date;
    remainingSeconds: number;
    items: unknown[];
  }> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        examForm: { include: { items: { orderBy: { order: "asc" }, include: { question: true } } } },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");

    if (attempt.status === AttemptStatus.IN_PROGRESS && attempt.deadlineAt < new Date()) {
      await this.finalizeAttempt(attemptId, AttemptStatus.EXPIRED);
      return this.getAttempt(attemptId, userId);
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a.selectedOption]));
    const items = attempt.examForm.items.map((item) => ({
      ...stripAnswerKey(item),
      selectedOption: answerByQuestion.get(item.questionId) ?? null,
    }));

    return {
      id: attempt.id,
      examTitle: attempt.exam.title,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      remainingSeconds: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
      items,
    };
  }

  async saveAnswer(attemptId: string, userId: string, questionId: string, selectedOption: number | null | undefined) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException("attempt is no longer in progress");
    }
    if (attempt.deadlineAt < new Date()) {
      await this.finalizeAttempt(attemptId, AttemptStatus.EXPIRED);
      throw new ForbiddenException("attempt has expired");
    }

    return this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { selectedOption: selectedOption ?? null, answeredAt: new Date() },
      create: { attemptId, questionId, selectedOption: selectedOption ?? null },
    });
  }

  /**
   * Safe concurrent submit (doc §10.2 Phase 4 DoD): the conditional
   * updateMany only succeeds for whichever caller "wins" the race (matches
   * status='IN_PROGRESS' at that instant); the loser sees count=0 and just
   * returns the score the winner already computed, inside the same
   * transaction, so there's no window where status flips but no Score exists.
   */
  async submitAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      const existing = await this.prisma.score.findUnique({ where: { attemptId } });
      if (existing) return existing;
    }

    return this.finalizeAttempt(attemptId, AttemptStatus.SUBMITTED);
  }

  private async finalizeAttempt(attemptId: string, finalStatus: AttemptStatus) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attempt.updateMany({
        where: { id: attemptId, status: AttemptStatus.IN_PROGRESS },
        data: { status: finalStatus, submittedAt: new Date() },
      });
      if (count === 0) {
        return tx.score.findUnique({ where: { attemptId } });
      }

      const finalizedAttempt = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
      const items = await tx.examItem.findMany({
        where: { examFormId: finalizedAttempt.examFormId },
        include: { question: { select: { correctOption: true } } },
      });
      const answers = await tx.answer.findMany({ where: { attemptId } });
      const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOption]));

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let rawScore = 0;
      for (const item of items) {
        const selected = answerByQuestion.get(item.questionId);
        if (selected == null) {
          unansweredCount += 1;
        } else if (selected === item.question.correctOption) {
          correctCount += 1;
          rawScore += item.points;
        } else {
          wrongCount += 1;
        }
      }
      const percentCorrect = items.length > 0 ? (correctCount / items.length) * 100 : 0;

      return tx.score.create({
        data: {
          attemptId,
          scoreVersion: SCORE_VERSION,
          correctCount,
          wrongCount,
          unansweredCount,
          rawScore,
          percentCorrect,
        },
      });
    });
  }

  /** Post-submission report: answer key revealed, since grading is final. */
  async getReport(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        examForm: { include: { items: { orderBy: { order: "asc" }, include: { question: true } } } },
        answers: true,
        score: true,
      },
    });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException("attempt is still in progress; submit it first");
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a.selectedOption]));
    return {
      examTitle: attempt.exam.title,
      status: attempt.status,
      score: attempt.score,
      items: attempt.examForm.items.map((item) => ({
        question: item.question,
        selectedOption: answerByQuestion.get(item.questionId) ?? null,
      })),
    };
  }

  // --- Psychometrics (admin) -------------------------------------------------

  /**
   * Simplified classical-test-theory stats, computed on demand (no
   * materialized/stored view yet -- fine at today's scale). `difficulty` is
   * the standard % of test-takers who answered correctly. `discrimination`
   * here is a simplified separation index (avg raw score of those who got
   * the item right minus those who got it wrong), not a strict point-biserial
   * correlation coefficient -- documented in AGENTS.md as a Phase 4
   * simplification.
   */
  async getPsychometrics(examId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { examId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] } },
      include: { answers: true, score: true },
    });
    if (attempts.length === 0) return { attemptCount: 0, items: [] };

    const byQuestion = new Map<
      string,
      { correctScores: number[]; incorrectScores: number[]; correct: number; total: number }
    >();

    for (const attempt of attempts) {
      const rawScore = attempt.score?.rawScore ?? 0;
      for (const answer of attempt.answers) {
        if (answer.selectedOption == null) continue;
        const question = await this.prisma.question.findUnique({
          where: { id: answer.questionId },
          select: { correctOption: true },
        });
        if (!question) continue;
        const stat = byQuestion.get(answer.questionId) ?? {
          correctScores: [],
          incorrectScores: [],
          correct: 0,
          total: 0,
        };
        stat.total += 1;
        if (answer.selectedOption === question.correctOption) {
          stat.correct += 1;
          stat.correctScores.push(rawScore);
        } else {
          stat.incorrectScores.push(rawScore);
        }
        byQuestion.set(answer.questionId, stat);
      }
    }

    const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

    return {
      attemptCount: attempts.length,
      items: [...byQuestion.entries()].map(([questionId, stat]) => ({
        questionId,
        difficulty: stat.total > 0 ? stat.correct / stat.total : 0,
        discrimination: avg(stat.correctScores) - avg(stat.incorrectScores),
        sampleSize: stat.total,
      })),
    };
  }
}
