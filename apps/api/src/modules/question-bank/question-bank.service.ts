import { Injectable, NotFoundException } from "@nestjs/common";
import { Degree, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestionService } from "../ingestion/ingestion.service";
import { CreateQuestionDto } from "./dto/create-question.dto";

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

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  async list(filters: QuestionFilters) {
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
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(id: string) {
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
