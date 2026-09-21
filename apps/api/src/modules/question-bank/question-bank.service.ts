import { Injectable, NotFoundException } from "@nestjs/common";
import { Degree, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestionService } from "../ingestion/ingestion.service";
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
 * The projection returned to every caller of the public read paths
 * (`list` / `getById`), authenticated or not. It structurally excludes
 * `correctOption` and `solutionBlocks` so the answer key cannot leak by
 * forgetting a `delete` somewhere -- Prisma never fetches those columns for
 * this query. There is currently no entitlement/scope model that could tell
 * this service "this particular user is allowed to see the answer key for
 * this particular question", so the public path never returns it, for any
 * caller -- that authorized path arrives with the entitlement model.
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
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.QuestionSelect;

export type PublicQuestion = Prisma.QuestionGetPayload<{ select: typeof PUBLIC_QUESTION_SELECT }>;

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  /**
   * Public/student-facing read path. `requester` is accepted so the future
   * entitlement workstream can extend this without another controller
   * rewrite; today it is intentionally unused for answer-key purposes --
   * see PUBLIC_QUESTION_SELECT.
   */
  async list(filters: QuestionFilters, requester?: SessionUser) {
    void requester;
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

    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        select: PUBLIC_QUESTION_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Public/student-facing read path -- see the note on `list`. `requester`
   * is unused today for the same reason: no entitlement model yet.
   */
  async getById(id: string, requester?: SessionUser): Promise<PublicQuestion> {
    void requester;
    const question = await this.prisma.question.findUnique({ where: { id }, select: PUBLIC_QUESTION_SELECT });
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
