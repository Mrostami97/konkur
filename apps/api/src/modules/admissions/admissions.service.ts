import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree, Prisma, TuitionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CreateUniversityDto } from "./dto/create-university.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateCapacityDto } from "./dto/create-capacity.dto";

export interface ProgramFilters {
  degree?: "master" | "phd";
  field?: string;
  city?: string;
  university?: string;
}

const ACTIVE_OFFICIAL_SOURCE = {
  sourceTier: "PRIMARY_OFFICIAL",
  sourceStatus: "ACTIVE",
  archivedAt: null,
  mayLink: true,
} as const;

const PUBLIC_SOURCE_SELECT = {
  title: true,
  publisher: true,
  canonicalUrl: true,
  checkedAt: true,
} as const;

const PUBLIC_PROGRAM_INCLUDE = {
  source: { select: PUBLIC_SOURCE_SELECT },
  university: { include: { source: { select: PUBLIC_SOURCE_SELECT } } },
  capacities: {
    where: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
    include: { source: { select: PUBLIC_SOURCE_SELECT } },
    orderBy: [{ examYear: "desc" as const }, { quota: "asc" as const }],
  },
} satisfies Prisma.ProgramInclude;

type PublicProgramRecord = Prisma.ProgramGetPayload<{ include: typeof PUBLIC_PROGRAM_INCLUDE }>;

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // --- Catalog (admin) -------------------------------------------------

  async createUniversity(dto: CreateUniversityDto) {
    await this.requireOfficialSource(dto.sourceId);
    return this.prisma.university.create({ data: dto });
  }

  async createProgram(dto: CreateProgramDto) {
    await Promise.all([
      this.requireOfficialSource(dto.sourceId),
      this.requirePublicUniversity(dto.universityId),
    ]);
    return this.prisma.program.create({
      data: {
        universityId: dto.universityId,
        sourceId: dto.sourceId,
        code: dto.code,
        title: dto.title,
        degree: dto.degree as Degree,
        field: dto.field,
        tuitionType: dto.tuitionType as TuitionType,
        hasDormitory: dto.hasDormitory ?? false,
      },
    });
  }

  async addCapacity(programId: string, dto: CreateCapacityDto) {
    await Promise.all([
      this.requirePublicProgram(programId),
      this.requireOfficialSource(dto.sourceId),
    ]);
    return this.prisma.capacity.upsert({
      where: { programId_examYear_quota: { programId, examYear: dto.examYear, quota: dto.quota } },
      update: { capacity: dto.capacity, sourceId: dto.sourceId },
      create: { programId, examYear: dto.examYear, quota: dto.quota, capacity: dto.capacity, sourceId: dto.sourceId },
    });
  }

  async listUniversities() {
    const universities = await this.prisma.university.findMany({
      where: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
      include: {
        source: { select: PUBLIC_SOURCE_SELECT },
        programs: {
          where: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
          select: { id: true },
        },
      },
      orderBy: { title: "asc" },
    });
    return universities.map((university) => ({
      id: university.id,
      code: university.code,
      title: university.title,
      city: university.city,
      programCount: university.programs.length,
      source: university.source,
    }));
  }

  // --- Public catalog -----------------------------------------------------

  async listPrograms(filters: ProgramFilters) {
    const programs = await this.prisma.program.findMany({
      where: {
        degree: filters.degree ? (filters.degree.toUpperCase() as Degree) : undefined,
        field: filters.field,
        source: { is: ACTIVE_OFFICIAL_SOURCE },
        university: {
          ...(filters.city ? { city: filters.city } : {}),
          ...(filters.university ? { code: filters.university } : {}),
          source: { is: ACTIVE_OFFICIAL_SOURCE },
        },
      },
      include: PUBLIC_PROGRAM_INCLUDE,
      orderBy: { title: "asc" },
    });
    return programs.map((program) => this.toPublicProgram(program));
  }

  async getProgram(id: string) {
    return this.toPublicProgram(await this.requirePublicProgram(id));
  }

  async getProgramByCode(code: string) {
    const program = await this.findPublicProgram({ code });
    if (!program) throw new NotFoundException("program not found");
    return this.toPublicProgram(program);
  }

  async getUniversityByCode(code: string) {
    const university = await this.prisma.university.findFirst({
      where: { code, source: { is: ACTIVE_OFFICIAL_SOURCE } },
      include: {
        source: { select: PUBLIC_SOURCE_SELECT },
        programs: {
          where: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
          include: PUBLIC_PROGRAM_INCLUDE,
          orderBy: { title: "asc" },
        },
      },
    });
    if (!university) throw new NotFoundException("university not found");
    return {
      id: university.id,
      code: university.code,
      title: university.title,
      city: university.city,
      source: university.source,
      programs: university.programs.map((program) => this.toPublicProgram(program)),
    };
  }

  // --- Student choice list ("اولویت و چینش انتخاب‌ها") ------------------

  private async getOrCreateChoiceList(userId: string) {
    return this.prisma.choiceList.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async addChoice(userId: string, programId: string) {
    await this.requirePublicProgram(programId);
    const list = await this.getOrCreateChoiceList(userId);
    const maxPriority = await this.prisma.choiceListItem.aggregate({
      where: { choiceListId: list.id },
      _max: { priority: true },
    });
    return this.prisma.choiceListItem.upsert({
      where: { choiceListId_programId: { choiceListId: list.id, programId } },
      update: {},
      create: { choiceListId: list.id, programId, priority: (maxPriority._max.priority ?? 0) + 1 },
    });
  }

  async removeChoice(userId: string, programId: string) {
    const list = await this.prisma.choiceList.findUnique({ where: { userId } });
    if (!list) return;
    await this.prisma.choiceListItem.deleteMany({ where: { choiceListId: list.id, programId } });
  }

  async reorderChoices(userId: string, orderedProgramIds: string[]) {
    const list = await this.prisma.choiceList.findUnique({ where: { userId } });
    if (!list) throw new NotFoundException("no choice list yet");
    const items = await this.prisma.choiceListItem.findMany({ where: { choiceListId: list.id } });
    if (orderedProgramIds.length !== items.length || !items.every((i) => orderedProgramIds.includes(i.programId))) {
      throw new BadRequestException("orderedProgramIds must contain exactly the current choice list's programs");
    }
    await this.prisma.$transaction(
      orderedProgramIds.map((programId, index) =>
        this.prisma.choiceListItem.update({
          where: { choiceListId_programId: { choiceListId: list.id, programId } },
          data: { priority: index + 1 },
        }),
      ),
    );
    return this.listChoices(userId);
  }

  async listChoices(userId: string) {
    const list = await this.prisma.choiceList.findUnique({
      where: { userId },
      include: {
        items: {
          where: {
            program: {
              source: { is: ACTIVE_OFFICIAL_SOURCE },
              university: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
            },
          },
          include: { program: { include: { university: true } } },
          orderBy: { priority: "asc" },
        },
      },
    });
    return list?.items ?? [];
  }

  /** doc §7 "شانس قبولی" + "مقایسه": each choice side-by-side with its
   * empirical acceptance chance, in priority order. */
  async compareChoices(userId: string) {
    const items = await this.listChoices(userId);
    const results = [];
    for (const item of items) {
      const chance = await this.analytics
        .getAcceptanceChance(userId, item.programId)
        .catch((err) => ({ programId: item.programId, chance: null, sampleSize: 0, error: err.message }));
      results.push({ priority: item.priority, program: item.program, ...chance });
    }
    return results;
  }

  private async requireOfficialSource(sourceId: string) {
    const source = await this.prisma.contentSource.findFirst({
      where: { id: sourceId, ...ACTIVE_OFFICIAL_SOURCE },
      select: { id: true },
    });
    if (!source) throw new BadRequestException("an active PRIMARY_OFFICIAL source with link permission is required");
    return source;
  }

  private async requirePublicUniversity(id: string) {
    const university = await this.prisma.university.findFirst({
      where: { id, source: { is: ACTIVE_OFFICIAL_SOURCE } },
    });
    if (!university) throw new NotFoundException("officially sourced university not found");
    return university;
  }

  private findPublicProgram(where: { id?: string; code?: string }) {
    return this.prisma.program.findFirst({
      where: {
        ...where,
        source: { is: ACTIVE_OFFICIAL_SOURCE },
        university: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
      },
      include: PUBLIC_PROGRAM_INCLUDE,
    });
  }

  private async requirePublicProgram(id: string) {
    const program = await this.findPublicProgram({ id });
    if (!program) throw new NotFoundException("officially sourced program not found");
    return program;
  }

  private toPublicProgram(program: PublicProgramRecord) {
    return {
      id: program.id,
      code: program.code,
      title: program.title,
      degree: program.degree,
      field: program.field,
      tuitionType: program.tuitionType,
      hasDormitory: program.hasDormitory,
      source: program.source,
      university: {
        id: program.university.id,
        code: program.university.code,
        title: program.university.title,
        city: program.university.city,
        source: program.university.source,
      },
      capacities: program.capacities.map((capacity) => ({
        examYear: capacity.examYear,
        quota: capacity.quota,
        capacity: capacity.capacity,
        source: capacity.source,
      })),
    };
  }
}
