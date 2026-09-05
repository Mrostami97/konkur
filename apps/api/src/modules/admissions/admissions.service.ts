import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree, TuitionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CreateUniversityDto } from "./dto/create-university.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateCapacityDto } from "./dto/create-capacity.dto";

export interface ProgramFilters {
  degree?: "master" | "phd";
  field?: string;
  city?: string;
}

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // --- Catalog (admin) -------------------------------------------------

  createUniversity(dto: CreateUniversityDto) {
    return this.prisma.university.create({ data: dto });
  }

  createProgram(dto: CreateProgramDto) {
    return this.prisma.program.create({
      data: {
        universityId: dto.universityId,
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
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException("program not found");
    return this.prisma.capacity.upsert({
      where: { programId_examYear_quota: { programId, examYear: dto.examYear, quota: dto.quota } },
      update: { capacity: dto.capacity },
      create: { programId, examYear: dto.examYear, quota: dto.quota, capacity: dto.capacity },
    });
  }

  listUniversities() {
    return this.prisma.university.findMany({ orderBy: { title: "asc" } });
  }

  // --- Public catalog -----------------------------------------------------

  async listPrograms(filters: ProgramFilters) {
    return this.prisma.program.findMany({
      where: {
        degree: filters.degree ? (filters.degree.toUpperCase() as Degree) : undefined,
        field: filters.field,
        university: filters.city ? { city: filters.city } : undefined,
      },
      include: { university: true, capacities: true },
      orderBy: { title: "asc" },
    });
  }

  async getProgram(id: string) {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: { university: true, capacities: true },
    });
    if (!program) throw new NotFoundException("program not found");
    return program;
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
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException("program not found");
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
      include: { items: { include: { program: { include: { university: true } } }, orderBy: { priority: "asc" } } },
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
}
