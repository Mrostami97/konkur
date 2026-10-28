import { BadRequestException, Injectable } from "@nestjs/common";
import { ExamMode, Prisma, QuestionQuality } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../access/access.service";
import { VOID_KEY_STATES } from "../ingestion/question-payload";
import { PracticeService, type Collection } from "./practice.service";

export interface PracticeSelection {
  subjectCode: string;
  topicCodes?: string[];
  collection?: Collection;
  examMajor?: string;
  yearFrom?: number;
  yearTo?: number;
  count: number;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A student's own practice from the bank: they pick a subject, its syllabus
 * topics, years, track and one of their collections, and get a random set of
 * questions -- either walked one by one with the key after each (`pick`), or
 * as a timed exam of their own (`createExam`) sat and scored like any other.
 *
 * Only questions the student may read are drawn: a subject's samples, or the
 * whole subject when they hold its bank. A question deleted from the final key
 * has nothing to practise and is left out.
 */
@Injectable()
export class PersonalExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly practice: PracticeService,
  ) {}

  async pick(userId: string, selection: PracticeSelection) {
    const where: Prisma.QuestionWhereInput = {
      retiredAt: null,
      qualityTier: { not: QuestionQuality.DRAFT },
      keyState: { notIn: VOID_KEY_STATES },
      subjectCode: selection.subjectCode,
    };
    if (selection.topicCodes?.length) where.topicCodes = { hasSome: selection.topicCodes };
    if (selection.examMajor) where.examMajor = selection.examMajor;
    if (selection.yearFrom || selection.yearTo) where.examYear = { gte: selection.yearFrom, lte: selection.yearTo };
    if (selection.collection) where.AND = [await this.practice.collectionFilter(userId, selection.collection)];
    const hasBank = await this.access.hasActiveQuestionBankAccess(userId, selection.subjectCode);
    if (!hasBank) where.isSample = true;

    const candidates = await this.prisma.question.findMany({ where, select: { id: true } });
    const ids = shuffle(candidates.map((question) => question.id)).slice(0, selection.count);
    return { ids, available: candidates.length, hasBank };
  }

  /** A timed exam of the student's own; only they can start it (assessment.service.ts `startAttempt`). */
  async createExam(userId: string, selection: PracticeSelection & { title: string; durationMinutes: number }) {
    const { ids } = await this.pick(userId, selection);
    if (ids.length === 0) throw new BadRequestException("no question matches this selection");
    const exam = await this.prisma.exam.create({
      data: {
        slug: `my-${randomUUID()}`,
        title: selection.title,
        description: "",
        mode: ExamMode.STATIC,
        durationMinutes: selection.durationMinutes,
        subjectCode: selection.subjectCode,
        questionCount: ids.length,
        isPublished: false,
        createdBy: userId,
        ownerUserId: userId,
        forms: { create: { items: { create: ids.map((questionId, order) => ({ questionId, order })) } } },
      },
      select: { id: true, questionCount: true, durationMinutes: true },
    });
    return { examId: exam.id, questionCount: exam.questionCount, durationMinutes: exam.durationMinutes };
  }
}
