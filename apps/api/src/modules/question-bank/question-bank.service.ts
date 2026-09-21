import { Injectable, NotFoundException } from "@nestjs/common";
import { Degree, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { AccessService } from "../access/access.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import type { SessionUser } from "../identity/identity.service";

export interface QuestionFilters {
  subjectCode?: string;
  topicCode?: string;
  examDegree?: "master" | "phd";
  examMajor?: string;
  examYear?: number;
  q?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The projection returned for a question's stem/body -- the shared shape of
 * both a sample question and a non-sample question the caller is entitled
 * to see the body of. It structurally excludes `correctOption` and
 * `solutionBlocks`; those are only ever added via ANSWERED_QUESTION_SELECT
 * below, never appended in application code, so the answer key cannot leak
 * by forgetting a `delete` somewhere.
 */
const PUBLIC_QUESTION_SELECT = {
  id: true,
  externalId: true,
  examDegree: true,
  examMajor: true,
  examYear: true,
  subjectCode: true,
  topicCodes: true,
  stemBlocks: true,
  options: true,
  assets: true,
  isSample: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuestionSelect;

/**
 * Locked-metadata projection: what a `list` caller sees for a non-sample
 * question they have no bank access to. Structurally excludes the stem,
 * options, assets AND the answer key -- there is no stem/answer content in
 * this row for a bug to leak, by construction. See `list()` for why this
 * shape exists instead of a full row with fields deleted afterwards.
 */
const LOCKED_QUESTION_SELECT = {
  id: true,
  externalId: true,
  examDegree: true,
  examMajor: true,
  examYear: true,
  subjectCode: true,
  topicCodes: true,
  isSample: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuestionSelect;

/** Full read shape for a sample question, or a non-sample question the
 * caller has active subject bank access to: body + answer key. */
const ANSWERED_QUESTION_SELECT = {
  ...PUBLIC_QUESTION_SELECT,
  correctOption: true,
  solutionBlocks: true,
} satisfies Prisma.QuestionSelect;

export type LockedQuestion = Prisma.QuestionGetPayload<{ select: typeof LOCKED_QUESTION_SELECT }>;
export type AnsweredQuestion = Prisma.QuestionGetPayload<{ select: typeof ANSWERED_QUESTION_SELECT }>;

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly access: AccessService,
  ) {}

  /**
   * Public/student-facing list path. A sample question (admin-flagged) is
   * always returned in full, answer key included. A non-sample question is
   * returned in full (still without the answer key) only when `requester`
   * has active bank access to its subject; otherwise it is returned as
   * LOCKED_QUESTION_SELECT metadata only -- listed (not omitted), so the UI
   * can show real "N more locked questions for this subject" counts/rows,
   * but with no stem/options/answer content to leak. See the class-level
   * report for why "listed-but-locked" was chosen over omitting the row.
   */
  async list(filters: QuestionFilters, requester?: SessionUser) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 && filters.pageSize <= 100 ? filters.pageSize : 20;

    const where: Prisma.QuestionWhereInput = {};
    if (filters.subjectCode) where.subjectCode = filters.subjectCode;
    if (filters.topicCode) where.topicCodes = { has: filters.topicCode };
    if (filters.examDegree) where.examDegree = filters.examDegree.toUpperCase() as Degree;
    if (filters.examMajor) where.examMajor = filters.examMajor;
    if (filters.examYear) where.examYear = filters.examYear;
    // Structured filters are indexed and exact; `q` is a simple substring
    // match over scalar fields only. True full-text search into the JSON
    // stem/solution block content (doc's "PostgreSQL FTS") is not built yet
    // -- see AGENTS.md Phase 3 simplifications.
    if (filters.q) {
      where.OR = [
        { subjectCode: { contains: filters.q, mode: "insensitive" } },
        { examMajor: { contains: filters.q, mode: "insensitive" } },
        { topicCodes: { has: filters.q } },
      ];
    }

    const [page_, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        select: LOCKED_QUESTION_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.question.count({ where }),
    ]);

    const subjectCodes = page_.map((question) => question.subjectCode);
    const accessibleSubjects = requester
      ? await this.access.accessibleQuestionBankSubjects(requester.id, subjectCodes)
      : new Set<string>();

    const unlockedIds = page_
      .filter((question) => question.isSample || accessibleSubjects.has(question.subjectCode))
      .map((question) => question.id);

    const answered = unlockedIds.length
      ? await this.prisma.question.findMany({ where: { id: { in: unlockedIds } }, select: ANSWERED_QUESTION_SELECT })
      : [];
    const answeredById = new Map(answered.map((question) => [question.id, question]));

    const items: (AnsweredQuestion | LockedQuestion)[] = page_.map(
      (question) => answeredById.get(question.id) ?? question,
    );

    return { items, total, page, pageSize };
  }

  /**
   * Public/student-facing detail path. Unlike `list`, the stem/options are
   * always returned (this is the public, indexable, permalink page for one
   * question -- an intentionally different tradeoff from bulk list
   * browsing. Only a sample question, or one whose subject the `requester`
   * has active bank access to, returns a body at all: stem, options and the
   * answer key together. Everything else returns locked metadata only, the
   * same shape `list` uses -- the bank's question text is the paid asset, so
   * a permalink is not a way around the gate. Nothing is ever sent and then
   * hidden client-side.
   */
  async getById(id: string, requester?: SessionUser): Promise<LockedQuestion | AnsweredQuestion> {
    const locked = await this.prisma.question.findUnique({ where: { id }, select: LOCKED_QUESTION_SELECT });
    if (!locked) throw new NotFoundException("question not found");

    const unlocked =
      locked.isSample ||
      (requester ? await this.access.hasActiveQuestionBankAccess(requester.id, locked.subjectCode) : false);

    if (!unlocked) return locked;

    const question = await this.prisma.question.findUnique({ where: { id }, select: ANSWERED_QUESTION_SELECT });
    if (!question) throw new NotFoundException("question not found");
    return question;
  }

  /**
   * Full row, including `correctOption` and `solutionBlocks`. Authorized
   * callers only (today: admin authoring/versioning and the assessment
   * report path, which reads questions directly via Prisma rather than
   * through this service). Never wire this to `QuestionsPublicController`.
   */
  async getByIdWithAnswerKey(id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException("question not found");
    return question;
  }

  async listVersions(id: string) {
    return this.ingestion.listVersions("QUESTION", id);
  }

  async createDirect(actorId: string, dto: CreateQuestionDto) {
    const payload = {
      schema_version: "question.v1",
      external_id: dto.external_id,
      exam: dto.exam,
      subject_code: dto.subject_code,
      topic_codes: dto.topic_codes,
      stem_blocks: dto.stem_blocks,
      options: dto.options,
      correct_option: dto.correct_option,
      solution_blocks: dto.solution_blocks,
      assets: [],
      provenance: {
        producer_type: "human",
        producer_name: actorId,
        source_artifact: "direct-authoring",
        generated_at: new Date().toISOString(),
      },
    };
    return this.ingestion.receiveDirectItem(payload, actorId);
  }
}
