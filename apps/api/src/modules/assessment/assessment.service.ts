import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AttemptStatus, ExamMode, Prisma, QuestionKeyState, QuestionQuality } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ProfileService } from "../identity/profile/profile.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { AddExamItemDto } from "./dto/add-exam-item.dto";
import { fa } from "../../common/persian-digits";
import { blueprint1406, MOCK_TRACK_NAMES, mockDuration, OFF_SYLLABUS, pick, type Candidate, type MockSection, type MockTrack } from "./mock-1406";

/** The master's exams the bank holds, by code, as a simulator's title names them. */
const EXAM_NAMES: Record<string, string> = {
  "1277": "مهندسی کامپیوتر",
  "1276": "فناوری اطلاعات (IT)",
  "1209": "علوم کامپیوتر",
};
import { isAcceptedAnswer, isVoidKey } from "../ingestion/question-payload";
import {
  Breakdown,
  GradedItem,
  RANK_BOXES,
  breakdownOf,
  konkurPercentOf,
  questionStatMinimum,
  rankBoxOf,
  rankMinimum,
  tarazOf,
  weightedTaraz,
} from "./exam-report";

/** Longest single stretch of time one question can add to its total: a tab
 * left open overnight must not read as hours of thought. */
const MAX_ACTIVITY_MS = 15 * 60_000;

const SCORE_VERSION = "score-rule.v1";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Strips the answer key -- the key, any other option it accepts, and the
 * solution -- so an in-progress attempt never leaks it to the student. */
function stripAnswerKey<
  T extends { question: { correctOption: number; acceptedOptions: number[]; solutionBlocks: unknown; [key: string]: unknown } },
>(item: T) {
  const { correctOption, acceptedOptions, solutionBlocks, ...rest } = item.question;
  void correctOption;
  void acceptedOptions;
  void solutionBlocks;
  return { ...item, question: rest };
}

/** Below this many participants a rank says more about who happened to take
 * the exam than about the student, so it is withheld (owner's policy: 30,
 * configurable with EXAM_RANK_MIN_PARTICIPANTS). */
export const MIN_PARTICIPANTS_FOR_RANK = rankMinimum;

/**
 * The konkur percentage: every wrong answer cancels a third of a right one.
 * The stored percentCorrect ignores wrong answers; ranking on it would reward
 * guessing, which the real exam punishes.
 */
export function konkurPercent(score: { correctCount: number; wrongCount: number; unansweredCount: number }) {
  const total = score.correctCount + score.wrongCount + score.unansweredCount;
  return total > 0 ? ((3 * score.correctCount - score.wrongCount) / (3 * total)) * 100 : 0;
}

interface Entrant {
  attemptId: string;
  userId: string;
  percent: number;
}

/**
 * Where one score sits among an exam's participants. Each participant counts
 * once, with their first submitted attempt; a retake is placed against the
 * others without counting twice.
 */
export function standingOf(population: Entrant[], userId: string, attemptId: string, percent: number, minimum = rankMinimum()) {
  const participants = population.length;
  const others = population.filter((entry) => entry.userId !== userId);
  const official = population.find((entry) => entry.userId === userId)?.attemptId === attemptId;
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const percents = population.map((entry) => entry.percent);
  const mean = participants ? percents.reduce((sum, value) => sum + value, 0) / participants : 0;
  const sd = participants ? Math.sqrt(percents.reduce((sum, value) => sum + (value - mean) ** 2, 0) / participants) : 0;
  const ranked = participants >= minimum;
  const distribution = Array.from({ length: 10 }, (_, bucket) => ({
    from: bucket * 10,
    to: bucket * 10 + 10,
    count: percents.filter((value) => Math.min(9, Math.max(0, Math.floor(Math.max(0, value) / 10))) === bucket).length,
  }));
  return {
    participants,
    minimumForRank: minimum,
    isOfficial: official,
    konkurPercent: round1(percent),
    rank: ranked ? 1 + others.filter((entry) => entry.percent > percent).length : null,
    percentile: ranked && others.length > 0
      ? Math.round((others.filter((entry) => entry.percent < percent).length / others.length) * 100)
      : null,
    // A konkur-style standard score within this exam: 5000 at the mean, 1000
    // per standard deviation. Only meaningful with enough participants.
    taraz: ranked && sd > 0 ? Math.round(5000 + (1000 * (percent - mean)) / sd) : null,
    average: participants ? round1(mean) : null,
    best: participants ? round1(Math.max(...percents)) : null,
    distribution: ranked ? distribution : [],
  };
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly profiles: ProfileService,
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
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: { qualityTier: true, retiredAt: true },
    });
    if (!question || question.retiredAt) throw new NotFoundException("question not found");
    if (question.qualityTier === QuestionQuality.DRAFT) {
      throw new BadRequestException("سؤالی که متن یا کلیدش هنوز بازبینی نشده به آزمون اضافه نمی‌شود.");
    }
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

  /**
   * A simulator of one real exam: its reviewed questions in booklet order,
   * grouped into the konkur's sections so the report card can show each
   * section's percentage and estimate the rank that year. Rebuilt in place
   * while nobody has sat it; frozen once someone has.
   */
  async createSimulator(actorId: string, examCode: string, examYear: number, durationMinutes: number) {
    const questions = await this.prisma.question.findMany({
      where: { examCode, examYear, retiredAt: null, qualityTier: { not: QuestionQuality.DRAFT } },
      select: { id: true, subjectCode: true },
      orderBy: [{ bookletNumber: "asc" }, { questionNumber: "asc" }],
    });
    if (questions.length === 0) {
      throw new BadRequestException("این کنکور هنوز سؤال بازبینی‌شده ندارد؛ اول کلید و متن سؤال‌هایش را در صف بازبینی تأیید کنید.");
    }
    const inBooklet = await this.prisma.question.count({ where: { examCode, examYear, retiredAt: null } });

    const slug = `simulator-${examCode}-${examYear}`;
    const existing = await this.prisma.exam.findUnique({ where: { slug }, include: { _count: { select: { attempts: true } } } });
    if (existing && existing._count.attempts > 0) {
      throw new ConflictException("این شبیه‌ساز شرکت‌کننده داشته و سؤال‌هایش دیگر عوض نمی‌شود.");
    }

    const title = `شبیه‌ساز کنکور ارشد ${EXAM_NAMES[examCode] ?? `کد ${fa(Number(examCode))}`} ${fa(examYear)}`;
    const description =
      inBooklet > questions.length
        ? `${fa(questions.length)} سؤال کنکور ${fa(examYear)} (کد ${fa(Number(examCode))}) به ترتیب دفترچه، با زمان‌بندی و نمرهٔ منفی واقعی. سؤال‌های درس‌هایی که از کنکور ۱۴۰۶ حذف شده‌اند و سؤال‌های بازبینی‌نشده در آن نیستند.`
        : `${fa(questions.length)} سؤال کنکور ${fa(examYear)} (کد ${fa(Number(examCode))}) در درس‌هایی که در کنکور ۱۴۰۶ هم هست، به ترتیب دفترچه، با زمان‌بندی و نمرهٔ منفی واقعی. سؤال‌هایی که کلید نهایی حذف کرد در آن نیستند.`;

    const exam = await this.prisma.$transaction(async (tx) => {
      if (existing) await tx.exam.delete({ where: { id: existing.id } });
      const created = await tx.exam.create({
        data: {
          slug,
          title,
          description,
          mode: ExamMode.STATIC,
          durationMinutes,
          simulatesExamCode: examCode,
          simulatesYear: examYear,
          createdBy: actorId,
        },
      });
      const form = await tx.examForm.create({ data: { examId: created.id } });
      const boxes = [...RANK_BOXES.map((box) => box.key), null];
      const sectionIds = new Map<string | null, string>();
      let order = 0;
      for (const key of boxes) {
        if (!questions.some((question) => rankBoxOf(question.subjectCode) === key)) continue;
        const section = await tx.examSection.create({
          data: {
            examId: created.id,
            order: order++,
            title: RANK_BOXES.find((box) => box.key === key)?.title ?? "سایر درس‌ها",
            rankBox: key,
          },
        });
        sectionIds.set(key, section.id);
      }
      // Section by section, each in booklet order: a section is never split,
      // even where the booklet printed a subject out of its usual place.
      const boxIndex = (subjectCode: string) => {
        const index = RANK_BOXES.findIndex((box) => box.key === rankBoxOf(subjectCode));
        return index === -1 ? RANK_BOXES.length : index;
      };
      const ordered = questions
        .map((question, position) => ({ question, position }))
        .sort((a, b) => boxIndex(a.question.subjectCode) - boxIndex(b.question.subjectCode) || a.position - b.position)
        .map((entry) => entry.question);
      await tx.examItem.createMany({
        data: ordered.map((question, index) => ({
          examFormId: form.id,
          questionId: question.id,
          order: index,
          sectionId: sectionIds.get(rankBoxOf(question.subjectCode)) ?? null,
        })),
      });
      return created;
    });

    await this.audit.log({
      actorUserId: actorId,
      action: existing ? "exam.simulator_rebuilt" : "exam.simulator_created",
      targetType: "Exam",
      targetId: exam.id,
      metadata: { examCode, examYear, questions: questions.length, inBooklet },
    });
    return { ...exam, questions: questions.length, inBooklet };
  }

  /**
   * A 1406-style mock exam drawn from the bank (see mock-1406.ts): numbered
   * per track, unpublished, preferring questions no earlier mock of the
   * track used. Every question must have a checked key -- a mock is graded.
   */
  async createMock1406(actorId: string, track: MockTrack) {
    const reviewed = { retiredAt: null, keyVerified: true, examDegree: "MASTER" as const, qualityTier: { not: QuestionQuality.DRAFT } };
    const counts = await this.prisma.question.groupBy({ by: ["subjectCode"], where: reviewed, _count: { _all: true } });
    const supply = new Map(counts.map((row) => [row.subjectCode, row._count._all]));

    let sections: MockSection[];
    if (track === "1209") {
      // Computer science keeps its own structure: the latest CS exam's subjects and counts.
      const latest = await this.prisma.question.findFirst({ where: { ...reviewed, examCode: "1209" }, orderBy: { examYear: "desc" }, select: { examYear: true } });
      if (!latest) throw new BadRequestException("بانک هنوز سؤال بازبینی‌شدهٔ علوم کامپیوتر ندارد.");
      const bySubject = await this.prisma.question.groupBy({ by: ["subjectCode"], where: { ...reviewed, examCode: "1209", examYear: latest.examYear }, _count: { _all: true } });
      sections = [{ title: "دروس تخصصی", rankBox: "specialised", coefficient: 1, subjects: bySubject.map((row) => ({ code: row.subjectCode, count: row._count._all })) }];
    } else {
      sections = blueprint1406(track, (code) => (supply.get(code) ?? 0) > 0);
    }

    const previous = await this.prisma.exam.findMany({ where: { slug: { startsWith: `mock-1406-${track}-` } }, select: { slug: true, forms: { select: { items: { select: { questionId: true } } } } } });
    const used = new Set(previous.flatMap((exam) => exam.forms.flatMap((form) => form.items.map((item) => item.questionId))));
    const number = previous.reduce((max, exam) => Math.max(max, Number(exam.slug.split("-").pop()) || 0), 0) + 1;

    const chosen: { section: MockSection; questions: Candidate[] }[] = [];
    const short: string[] = [];
    for (const section of sections) {
      const questions: Candidate[] = [];
      for (const subject of section.subjects) {
        const rows = await this.prisma.question.findMany({
          where: { ...reviewed, subjectCode: subject.code },
          select: { id: true, subjectCode: true, passageId: true, examYear: true, stemBlocks: true, options: true },
        });
        // 1406 practises what 1406 examines: a topic the syllabus dropped stays out.
        const off = OFF_SYLLABUS[subject.code];
        const candidates: Candidate[] = rows
          .filter((row) => !off || !off.test(JSON.stringify([row.stemBlocks, row.options])))
          .map(({ id, subjectCode, passageId, examYear }) => ({ id, subjectCode, passageId, examYear }));
        const picked = pick(candidates, subject.count, used);
        if (picked.length < subject.count) short.push(`${subject.code}: ${picked.length}/${subject.count}`);
        questions.push(...picked);
      }
      if (questions.length) chosen.push({ section, questions });
    }
    const total = chosen.reduce((sum, row) => sum + row.questions.length, 0);
    if (total === 0) throw new BadRequestException("بانک برای این آزمون سؤال بازبینی‌شده ندارد.");

    const name = MOCK_TRACK_NAMES[track];
    const missingMath = track === "1277" && !(supply.get("linear-algebra") ?? 0);
    const description = [
      `آزمون جامع به سبک کنکور ارشد ${name} ۱۴۰۶: ${fa(total)} سؤال از کنکورهای سال‌های قبل، با همان درس‌ها و ضرایب ۱۴۰۶ و نمرهٔ منفی.`,
      track !== "1209" ? "از هر درس بخش تخصصی ۱۰ سؤال." : "",
      missingMath ? "جبر خطی هنوز سؤال ندارد و ریاضیات از گسسته و آمار است." : "",
    ].filter(Boolean).join(" ");

    const exam = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          slug: `mock-1406-${track}-${number}`,
          title: `آزمون جامع ۱۴۰۶ ارشد ${name} · شمارهٔ ${fa(number)}`,
          description,
          mode: ExamMode.STATIC,
          durationMinutes: mockDuration(total),
          simulatesExamCode: track,
          simulatesYear: 1406,
          createdBy: actorId,
        },
      });
      const form = await tx.examForm.create({ data: { examId: created.id } });
      let order = 0;
      for (const [index, row] of chosen.entries()) {
        const section = await tx.examSection.create({
          data: { examId: created.id, order: index, title: row.section.title, rankBox: row.section.rankBox, coefficient: row.section.coefficient },
        });
        // Subjects in the section's order; within a subject, as picked.
        const subjectOrder = row.section.subjects.map((subject) => subject.code);
        const ordered = [...row.questions].sort((a, b) => subjectOrder.indexOf(a.subjectCode) - subjectOrder.indexOf(b.subjectCode));
        await tx.examItem.createMany({
          data: ordered.map((question) => ({ examFormId: form.id, questionId: question.id, order: order++, sectionId: section.id })),
        });
      }
      return created;
    });

    await this.audit.log({ actorUserId: actorId, action: "exam.mock_1406_created", targetType: "Exam", targetId: exam.id, metadata: { track, questions: total, short } });
    return { ...exam, questions: total, short };
  }

  /**
   * Builds the simulator of every exam year that has reviewed questions, in
   * one go. A simulator somebody has sat stays as it is; one already built
   * keeps the duration an operator set; a new one gets a minute and a half
   * per question. None is published here: publishing stays a decision per
   * exam, because a published simulator shows its questions and keys.
   */
  async createAllSimulators(actorId: string) {
    const years = await this.prisma.question.groupBy({
      by: ["examCode", "examYear"],
      where: { examCode: { not: null }, retiredAt: null, qualityTier: { not: QuestionQuality.DRAFT } },
      _count: { _all: true },
      orderBy: [{ examCode: "asc" }, { examYear: "asc" }],
    });
    const results: { examCode: string; examYear: number; status: "built" | "rebuilt" | "frozen"; questions: number }[] = [];
    for (const row of years) {
      const examCode = row.examCode!;
      const existing = await this.prisma.exam.findUnique({
        where: { slug: `simulator-${examCode}-${row.examYear}` },
        select: { durationMinutes: true, _count: { select: { attempts: true } } },
      });
      if (existing && existing._count.attempts > 0) {
        results.push({ examCode, examYear: row.examYear, status: "frozen", questions: row._count._all });
        continue;
      }
      const duration = existing?.durationMinutes ?? Math.max(10, Math.round((row._count._all * 1.5) / 5) * 5);
      const built = await this.createSimulator(actorId, examCode, row.examYear, duration);
      results.push({ examCode, examYear: row.examYear, status: existing ? "rebuilt" : "built", questions: built.questions });
    }
    return results;
  }

  listAllExams() {
    return this.prisma.exam.findMany({
      // Students' own practice exams are theirs, not the catalogue's.
      where: { ownerUserId: null },
      include: { forms: { include: { _count: { select: { items: true } } } }, _count: { select: { attempts: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** One exam with its questions in order, for the builder. */
  async getExamForAdmin(examId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        _count: { select: { attempts: true } },
        forms: {
          include: {
            items: {
              orderBy: { order: "asc" },
              include: { question: { select: { id: true, externalId: true, subjectCode: true, examYear: true, stemBlocks: true, retiredAt: true } } },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException("exam not found");
    return exam;
  }

  async unpublishExam(actorId: string, examId: string) {
    const exam = await this.prisma.exam.update({ where: { id: examId }, data: { isPublished: false } }).catch(() => null);
    if (!exam) throw new NotFoundException("exam not found");
    await this.audit.log({ actorUserId: actorId, action: "exam.unpublished", targetType: "Exam", targetId: examId });
    return exam;
  }

  /** Attempts and their reports hang off the exam, so an exam anyone has
   * taken is never deleted; unpublishing takes it out of the catalogue. */
  async deleteExam(actorId: string, examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { slug: true, _count: { select: { attempts: true } } } });
    if (!exam) throw new NotFoundException("exam not found");
    if (exam._count.attempts > 0) {
      throw new ConflictException(`این آزمون ${fa(exam._count.attempts)} بار شرکت‌کننده داشته و کارنامه‌هایش به آن وابسته‌اند؛ به‌جای حذف، انتشارش را لغو کنید.`);
    }
    await this.prisma.exam.delete({ where: { id: examId } });
    await this.audit.log({ actorUserId: actorId, action: "exam.deleted", targetType: "Exam", targetId: examId, metadata: { slug: exam.slug } });
    return { deleted: true };
  }

  /** Changing the questions after someone has sat the exam would make their
   * report disagree with the exam, so items are frozen once there are attempts. */
  async removeExamItem(actorId: string, examId: string, itemId: string) {
    const item = await this.prisma.examItem.findUnique({ where: { id: itemId }, include: { examForm: { select: { examId: true } } } });
    if (!item || item.examForm.examId !== examId) throw new NotFoundException("exam item not found");
    const attempts = await this.prisma.attempt.count({ where: { examId } });
    if (attempts > 0) {
      throw new ConflictException("این آزمون شرکت‌کننده داشته؛ تغییر سؤال‌هایش کارنامه‌های قبلی را بی‌اعتبار می‌کند.");
    }
    await this.prisma.examItem.delete({ where: { id: itemId } });
    await this.audit.log({ actorUserId: actorId, action: "exam.item_removed", targetType: "Exam", targetId: examId, metadata: { itemId, questionId: item.questionId } });
    return { deleted: true };
  }

  // --- Public catalog -----------------------------------------------------

  /** The catalogue, with what a card shows: how many questions and which sections. */
  async listPublishedExams() {
    const exams = await this.prisma.exam.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        sections: { orderBy: { order: "asc" }, select: { title: true } },
        forms: { take: 1, orderBy: { createdAt: "asc" }, select: { _count: { select: { items: true } } } },
      },
    });
    return exams.map(({ forms, ...exam }) => ({ ...exam, itemCount: forms[0]?._count.items ?? exam.questionCount ?? null }));
  }

  async getExamBySlug(slug: string) {
    const exam = await this.prisma.exam.findUnique({ where: { slug } });
    if (!exam || !exam.isPublished) throw new NotFoundException("exam not found");
    return exam;
  }

  // --- Attempts -------------------------------------------------------------

  /**
   * The student's own attempts, newest first, for their panel: which exam,
   * where it stands, and the score once submitted. Answers and questions are
   * not included -- the report endpoint serves those, with its own checks.
   */
  /** First submitted attempt of each participant, per exam. */
  private async populations(examIds: string[]) {
    const rows = await this.prisma.attempt.findMany({
      where: { examId: { in: examIds }, status: AttemptStatus.SUBMITTED, score: { isNot: null } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        examId: true,
        userId: true,
        score: { select: { correctCount: true, wrongCount: true, unansweredCount: true } },
      },
    });
    const byExam = new Map<string, Map<string, Entrant>>();
    for (const row of rows) {
      const exam = byExam.get(row.examId) ?? new Map<string, Entrant>();
      if (!exam.has(row.userId) && row.score) {
        exam.set(row.userId, { attemptId: row.id, userId: row.userId, percent: konkurPercent(row.score) });
      }
      byExam.set(row.examId, exam);
    }
    return new Map([...byExam].map(([examId, entrants]) => [examId, [...entrants.values()]]));
  }

  /** The student's rank, percentile and standard score in one attempt's
   * exam. Only aggregates are returned -- never another student's result. */
  async getStanding(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        userId: true,
        examId: true,
        status: true,
        score: { select: { correctCount: true, wrongCount: true, unansweredCount: true } },
      },
    });
    if (!attempt || attempt.userId !== userId) throw new NotFoundException("attempt not found");
    if (attempt.status !== AttemptStatus.SUBMITTED || !attempt.score) {
      throw new ForbiddenException("the attempt has not been graded yet");
    }
    const population = (await this.populations([attempt.examId])).get(attempt.examId) ?? [];
    return standingOf(population, userId, attemptId, konkurPercent(attempt.score));
  }

  async listMyAttempts(userId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        startedAt: true,
        deadlineAt: true,
        submittedAt: true,
        exam: { select: { id: true, slug: true, title: true, durationMinutes: true, simulatesExamCode: true, simulatesYear: true } },
        score: {
          select: { correctCount: true, wrongCount: true, unansweredCount: true, rawScore: true, percentCorrect: true, breakdown: true },
        },
      },
    });
    const graded = attempts.filter((attempt) => attempt.score);
    const populations = graded.length ? await this.populations([...new Set(graded.map((attempt) => attempt.exam.id))]) : new Map();
    return attempts.map(({ score: fullScore, ...rest }) => {
      // Per-subject results let the student panel estimate a rank from the
      // latest result in every subject, across all the exams taken.
      const subjects = ((fullScore?.breakdown as unknown as Breakdown | null)?.subjects ?? []).map(({ subjectCode, questions, correct, wrong }) => ({ subjectCode, questions, correct, wrong }));
      const score = fullScore ? { correctCount: fullScore.correctCount, wrongCount: fullScore.wrongCount, unansweredCount: fullScore.unansweredCount, rawScore: fullScore.rawScore, percentCorrect: fullScore.percentCorrect } : null;
      const attempt = { ...rest, score, subjects };
      if (!attempt.score) return { ...attempt, standing: null };
      const standing = standingOf(populations.get(attempt.exam.id) ?? [], userId, attempt.id, konkurPercent(attempt.score));
      return {
        ...attempt,
        standing: {
          konkurPercent: standing.konkurPercent,
          rank: standing.rank,
          participants: standing.participants,
          percentile: standing.percentile,
          isOfficial: standing.isOfficial,
        },
      };
    });
  }

  async startAttempt(examId: string, userId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, include: { forms: true } });
    // A student's own practice exam is never published; only its owner sits it.
    const ownExam = exam?.ownerUserId != null && exam.ownerUserId === userId;
    if (!exam || (!exam.isPublished && !ownExam)) throw new NotFoundException("exam not found");

    const inProgress = await this.prisma.attempt.findFirst({
      where: { examId, userId, status: AttemptStatus.IN_PROGRESS },
    });
    if (inProgress) return this.getAttempt(inProgress.id, userId); // resume, don't double-start

    // Only a new attempt needs the profile: one already under way (started
    // before the rule existed) is always resumable.
    await this.profiles.assertExamReady(userId);

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
        where: { subjectCode: exam.subjectCode, retiredAt: null, qualityTier: { not: QuestionQuality.DRAFT } },
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
    sections: { id: string; title: string; order: number }[];
    items: unknown[];
  }> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: { include: { sections: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true } } } },
        examForm: { include: { items: { orderBy: { order: "asc" }, include: { question: { include: { passage: true } } } } } },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");

    if (attempt.status === AttemptStatus.IN_PROGRESS && attempt.deadlineAt < new Date()) {
      await this.finalizeAttempt(attemptId, AttemptStatus.EXPIRED);
      return this.getAttempt(attemptId, userId);
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const items = attempt.examForm.items.map((item) => {
      const answer = answerByQuestion.get(item.questionId);
      return {
        ...stripAnswerKey(item),
        selectedOption: answer?.selectedOption ?? null,
        flagged: answer?.flagged ?? false,
        timeSpentMs: answer?.timeSpentMs ?? 0,
        // When the answer now on the sheet was given: the exam page draws
        // the candidate's pace from it.
        answeredAt: answer?.selectedOption != null ? answer.answeredAt : null,
      };
    });

    return {
      id: attempt.id,
      examTitle: attempt.exam.title,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      remainingSeconds: Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000)),
      sections: attempt.exam.sections,
      items,
    };
  }

  async saveAnswer(attemptId: string, userId: string, questionId: string, selectedOption: number | null | undefined) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Grading's status update locks this same row. Hold it until the answer
      // write commits, so a checked save cannot complete after finalization.
      await tx.$queryRaw`SELECT "id" FROM "attempts" WHERE "id" = ${attemptId} FOR UPDATE`;
      const attempt = await tx.attempt.findUnique({ where: { id: attemptId } });
      if (!attempt) throw new NotFoundException("attempt not found");
      if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");
      if (attempt.status !== AttemptStatus.IN_PROGRESS) {
        throw new ForbiddenException("attempt is no longer in progress");
      }
      if (attempt.deadlineAt <= new Date()) return { expired: true as const };
      const item = await tx.examItem.findUnique({
        where: { examFormId_questionId: { examFormId: attempt.examFormId, questionId } },
        select: { id: true },
      });
      if (!item) throw new BadRequestException("question is not part of this attempt");
      const previous = await tx.answer.findUnique({
        where: { attemptId_questionId: { attemptId, questionId } },
        select: { selectedOption: true },
      });
      // A change of mind: an option already chosen replaced or cleared.
      const changed = previous?.selectedOption != null && previous.selectedOption !== (selectedOption ?? null);
      const answer = await tx.answer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: { selectedOption: selectedOption ?? null, answeredAt: new Date(), ...(changed ? { changeCount: { increment: 1 } } : {}) },
        create: { attemptId, questionId, selectedOption: selectedOption ?? null },
      });
      return { expired: false as const, answer };
    });
    if (result.expired) {
      await this.finalizeAttempt(attemptId, AttemptStatus.EXPIRED);
      throw new ForbiddenException("attempt has expired");
    }
    return result.answer;
  }

  /**
   * How the student is working: time spent on each question since the last
   * report, and which ones they flagged for review. Sent in small batches by
   * the exam page; ignored quietly once the attempt is over, because a late
   * batch must not fail the submit that follows it.
   */
  async recordActivity(attemptId: string, userId: string, entries: { questionId: string; timeSpentMs?: number; flagged?: boolean }[]) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId }, select: { userId: true, status: true, examFormId: true, deadlineAt: true } });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");
    if (attempt.status !== AttemptStatus.IN_PROGRESS || attempt.deadlineAt <= new Date()) return { recorded: 0 };
    const inForm = new Set(
      (await this.prisma.examItem.findMany({ where: { examFormId: attempt.examFormId }, select: { questionId: true } })).map((item) => item.questionId),
    );
    const valid = entries.filter((entry) => inForm.has(entry.questionId));
    await this.prisma.$transaction(
      valid.map((entry) => {
        const ms = Math.max(0, Math.min(MAX_ACTIVITY_MS, Math.round(entry.timeSpentMs ?? 0)));
        return this.prisma.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: entry.questionId } },
          update: { timeSpentMs: { increment: ms }, ...(entry.flagged === undefined ? {} : { flagged: entry.flagged }) },
          create: { attemptId, questionId: entry.questionId, selectedOption: null, timeSpentMs: ms, flagged: entry.flagged ?? false },
        });
      }),
    );
    return { recorded: valid.length };
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
        include: { question: { select: { correctOption: true, acceptedOptions: true, keyState: true, subjectCode: true } } },
      });
      const answers = await tx.answer.findMany({ where: { attemptId } });
      const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOption]));
      const timeByQuestion = new Map(answers.map((a) => [a.questionId, a.timeSpentMs]));
      const sections = await tx.examSection.findMany({ where: { examId: finalizedAttempt.examId } });
      const graded: GradedItem[] = items.map((item) => {
        const selected = answerByQuestion.get(item.questionId);
        return {
          questionId: item.questionId,
          sectionId: item.sectionId,
          subjectCode: item.question.subjectCode,
          outcome:
            isVoidKey(item.question.keyState)
              ? "void"
              : selected == null
                ? "blank"
                : isAcceptedAnswer(item.question, selected)
                  ? "correct"
                  : "wrong",
          penalized: item.question.keyState !== QuestionKeyState.POSITIVE_EFFECT,
          timeSpentMs: timeByQuestion.get(item.questionId) ?? 0,
        };
      });
      const breakdown = breakdownOf(graded, sections);

      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;
      let rawScore = 0;
      // A question the final key deleted, or one with no right option, is out of the exam: no mark, no count.
      const scored = items.filter((item) => !isVoidKey(item.question.keyState));
      for (const item of scored) {
        const selected = answerByQuestion.get(item.questionId);
        if (selected == null) {
          unansweredCount += 1;
        } else if (isAcceptedAnswer(item.question, selected)) {
          correctCount += 1;
          rawScore += item.points;
        } else {
          wrongCount += 1;
        }
      }
      const percentCorrect = scored.length > 0 ? (correctCount / scored.length) * 100 : 0;

      return tx.score.create({
        data: {
          attemptId,
          scoreVersion: SCORE_VERSION,
          correctCount,
          wrongCount,
          unansweredCount,
          rawScore,
          percentCorrect,
          breakdown: breakdown as unknown as Prisma.InputJsonValue,
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
        examForm: { include: { items: { orderBy: { order: "asc" }, include: { question: { include: { passage: true } } } } } },
        answers: true,
        score: true,
      },
    });
    if (!attempt) throw new NotFoundException("attempt not found");
    if (attempt.userId !== userId) throw new ForbiddenException("not your attempt");
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new ForbiddenException("attempt is still in progress; submit it first");
    }

    const answerByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
    const breakdown = (attempt.score?.breakdown as unknown as Breakdown | null) ?? null;

    // The other participants: each one's first graded attempt at this exam.
    const rows = await this.prisma.attempt.findMany({
      where: { examId: attempt.examId, status: AttemptStatus.SUBMITTED, score: { isNot: null } },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: { id: true, userId: true, score: { select: { breakdown: true, correctCount: true, wrongCount: true, unansweredCount: true } } },
    });
    const firsts = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!firsts.has(row.userId)) firsts.set(row.userId, row);
    const entrants = [...firsts.values()];

    const sections = (breakdown?.sections ?? []).map((section) => {
      const population = entrants
        .map((entrant) => (entrant.score?.breakdown as unknown as Breakdown | null)?.sections.find((other) => other.sectionId === section.sectionId)?.percent)
        .filter((value): value is number => typeof value === "number");
      const average = population.length ? population.reduce((sum, value) => sum + value, 0) / population.length : null;
      return { ...section, taraz: tarazOf(section.percent, population), average };
    });

    // How many participants got each question right -- the "golden misses"
    // are the ones most got right and this student did not.
    const formQuestionIds = attempt.examForm.items.map((item) => item.questionId);
    const statsReady = entrants.length >= questionStatMinimum();
    const crowd = new Map<string, number>();
    if (statsReady) {
      const answers = await this.prisma.answer.findMany({
        where: { attemptId: { in: entrants.map((entrant) => entrant.id) }, questionId: { in: formQuestionIds } },
        select: { questionId: true, selectedOption: true },
      });
      const keys = new Map(attempt.examForm.items.map((item) => [item.questionId, item.question]));
      for (const answer of answers) {
        const question = keys.get(answer.questionId);
        if (question && isAcceptedAnswer(question, answer.selectedOption)) crowd.set(answer.questionId, (crowd.get(answer.questionId) ?? 0) + 1);
      }
    }

    const history = await this.prisma.attempt.findMany({
      where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] }, score: { isNot: null } },
      orderBy: { submittedAt: "desc" },
      take: 12,
      select: {
        id: true,
        submittedAt: true,
        exam: { select: { title: true } },
        score: { select: { correctCount: true, wrongCount: true, unansweredCount: true, breakdown: true } },
      },
    });
    const profile = await this.prisma.profile.findUnique({ where: { userId }, select: { gpa: true } });

    return {
      examTitle: attempt.exam.title,
      exam: { id: attempt.exam.id, simulatesExamCode: attempt.exam.simulatesExamCode, simulatesYear: attempt.exam.simulatesYear },
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      sections,
      subjects: breakdown?.subjects ?? [],
      timeSpentMs: breakdown?.timeSpentMs ?? attempt.answers.reduce((sum, answer) => sum + answer.timeSpentMs, 0),
      overallTaraz: weightedTaraz(sections),
      participants: entrants.length,
      rankMinimum: rankMinimum(),
      questionStatMinimum: questionStatMinimum(),
      gpa: profile?.gpa ?? null,
      history: history.map((row) => ({
        attemptId: row.id,
        examTitle: row.exam.title,
        submittedAt: row.submittedAt,
        konkurPercent: row.score ? konkurPercentOf(row.score.correctCount, row.score.wrongCount, row.score.correctCount + row.score.wrongCount + row.score.unansweredCount) : null,
        sections: ((row.score?.breakdown as unknown as Breakdown | null)?.sections ?? []).map((section) => ({ rankBox: section.rankBox, title: section.title, percent: section.percent })),
      })),
      items: attempt.examForm.items.map((item) => {
        const answer = answerByQuestion.get(item.questionId);
        return {
          question: item.question,
          sectionId: item.sectionId,
          selectedOption: answer?.selectedOption ?? null,
          timeSpentMs: answer?.timeSpentMs ?? 0,
          flagged: answer?.flagged ?? false,
          changeCount: answer?.changeCount ?? 0,
          answeredAt: answer?.selectedOption != null ? answer.answeredAt : null,
          crowdCorrectPercent: statsReady ? Math.round(((crowd.get(item.questionId) ?? 0) / entrants.length) * 100) : null,
        };
      }),
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
      include: {
        answers: true,
        score: true,
        examForm: { select: { items: { select: { questionId: true } } } },
      },
    });
    if (attempts.length === 0) return { attemptCount: 0, items: [] };

    const byQuestion = new Map<
      string,
      { correctScores: number[]; incorrectScores: number[]; correct: number; total: number }
    >();

    for (const attempt of attempts) {
      const rawScore = attempt.score?.rawScore ?? 0;
      const formQuestions = new Set(attempt.examForm.items.map((item) => item.questionId));
      for (const answer of attempt.answers) {
        // Historical answers saved before form membership was enforced do
        // not describe a question the student was actually asked.
        if (answer.selectedOption == null || !formQuestions.has(answer.questionId)) continue;
        const question = await this.prisma.question.findUnique({
          where: { id: answer.questionId },
          select: { correctOption: true, acceptedOptions: true },
        });
        if (!question) continue;
        const stat = byQuestion.get(answer.questionId) ?? {
          correctScores: [],
          incorrectScores: [],
          correct: 0,
          total: 0,
        };
        stat.total += 1;
        if (isAcceptedAnswer(question, answer.selectedOption)) {
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
