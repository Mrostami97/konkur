import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree, Prisma, ProgramGender, StudyPeriod, TuitionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { CreateUniversityDto } from "./dto/create-university.dto";
import { CreateProgramDto } from "./dto/create-program.dto";
import { CreateCapacityDto } from "./dto/create-capacity.dto";
import { BookletRowDto, CatalogQueryDto, ImportBookletDto } from "./dto/import-booklet.dto";
import { fa } from "../../common/persian-digits";

/** Sanjesh's master's field-selection form takes at most this many codes. */
export const MAX_CHOICES = 100;

/** A short stable id for a natural key: program and university codes outlive one year's کد رشته‌محل. */
function digest(parts: (string | number)[]) {
  return createHash("sha1").update(parts.join("␟")).digest("hex").slice(0, 10);
}

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

  /** Students' choice lists point at programs, so a program anyone has
   * chosen stays; its capacities go with it. */
  async deleteProgram(id: string) {
    const program = await this.prisma.program.findUnique({ where: { id }, select: { _count: { select: { choiceItems: true } } } });
    if (!program) throw new NotFoundException("program not found");
    if (program._count.choiceItems > 0) {
      throw new ConflictException(`این رشته‌محل در فهرست انتخاب ${fa(program._count.choiceItems)} دانشجو است و حذف نمی‌شود.`);
    }
    await this.prisma.program.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteUniversity(id: string) {
    const university = await this.prisma.university.findUnique({ where: { id }, select: { _count: { select: { programs: true } } } });
    if (!university) throw new NotFoundException("university not found");
    if (university._count.programs > 0) {
      throw new ConflictException(`این دانشگاه ${fa(university._count.programs)} رشته‌محل دارد؛ اول رشته‌محل‌هایش را حذف کنید.`);
    }
    await this.prisma.university.delete({ where: { id } });
    return { deleted: true };
  }

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

  /**
   * Loads one year's field-selection booklet. A row is one کد رشته‌محل; its
   * program is identified across years by what it is (set, institution,
   * campus, programme, period, gender, grant), not by the code, which Sanjesh
   * renumbers every year. Re-importing the same year replaces that year's
   * capacities for the imported exam sets, so a corrected file fixes them.
   */
  async importBooklet(dto: ImportBookletDto, sourceId: string) {
    await this.requireOfficialSource(sourceId);
    const codes = new Set<string>();
    for (const row of dto.rows) {
      if (codes.has(row.selectionCode)) throw new BadRequestException(`کد رشته‌محل ${row.selectionCode} دو بار آمده است.`);
      codes.add(row.selectionCode);
    }
    const programCode = (row: BookletRowDto) =>
      `${row.examSetCode}-${digest([dto.degree, row.examSetCode, row.coefficientGroup, row.university, row.location ?? "", row.program, row.period, row.gender, row.variant ?? ""])}`;
    const byProgram = new Map<string, BookletRowDto[]>();
    for (const row of dto.rows) byProgram.set(programCode(row), [...(byProgram.get(programCode(row)) ?? []), row]);
    const twins = [...byProgram.values()].find((rows) => rows.length > 1);
    if (twins) {
      throw new BadRequestException(`کدهای ${twins.map((r) => r.selectionCode).join(" و ")} از هر نظر یکسان‌اند؛ یکی را با «توضیحات» یا محل تحصیل از دیگری جدا کنید.`);
    }

    const examSets = [...new Set(dto.rows.map((row) => row.examSetCode))];
    return this.prisma.$transaction(async (tx) => {
      const universityIds = new Map<string, string>();
      for (const row of dto.rows) {
        if (universityIds.has(row.university)) continue;
        const code = `u-${digest([row.university])}`;
        const university = await tx.university.upsert({
          where: { code },
          update: { title: row.university, city: row.universityCity, sourceId },
          create: { code, title: row.university, city: row.universityCity, sourceId },
          select: { id: true },
        });
        universityIds.set(row.university, university.id);
      }

      let created = 0;
      const programIds: string[] = [];
      for (const [code, [row]] of byProgram) {
        const data = {
          universityId: universityIds.get(row.university)!,
          title: row.program,
          degree: dto.degree as Degree,
          field: row.field,
          tuitionType: (row.period === "DAILY" ? "FREE" : "PAID") as TuitionType,
          hasDormitory: row.hasDormitory,
          examSetCode: row.examSetCode,
          coefficientGroup: row.coefficientGroup,
          orientation: row.orientation,
          period: row.period as StudyPeriod,
          location: row.location || null,
          city: row.city,
          gender: row.gender as ProgramGender,
          sourceId,
        };
        const existing = await tx.program.findUnique({ where: { code }, select: { id: true } });
        const program = existing
          ? await tx.program.update({ where: { code }, data, select: { id: true } })
          : await tx.program.create({ data: { ...data, code }, select: { id: true } });
        if (!existing) created += 1;
        programIds.push(program.id);

        const terms: [string, number][] = [["term-1", row.capacityFirstTerm], ["term-2", row.capacitySecondTerm]];
        for (const [quota, capacity] of terms) {
          const where = { programId_examYear_quota: { programId: program.id, examYear: dto.examYear, quota } };
          if (capacity === 0) {
            await tx.capacity.deleteMany({ where: { programId: program.id, examYear: dto.examYear, quota } });
            continue;
          }
          const fields = { capacity, selectionCode: row.selectionCode, notes: row.notes || null, bookletPage: row.bookletPage ?? null, sourceId };
          await tx.capacity.upsert({ where, update: fields, create: { programId: program.id, examYear: dto.examYear, quota, ...fields } });
        }
      }

      // Codes that left the booklet in a corrected file lose this year's capacity.
      const removed = await tx.capacity.deleteMany({
        where: {
          examYear: dto.examYear,
          programId: { notIn: programIds },
          program: { degree: dto.degree as Degree, examSetCode: { in: examSets } },
        },
      });
      return {
        examYear: dto.examYear,
        rows: dto.rows.length,
        universities: universityIds.size,
        programsCreated: created,
        programsUpdated: programIds.length - created,
        capacitiesRemoved: removed.count,
      };
    }, { timeout: 120_000, maxWait: 10_000 });
  }

  /**
   * The field-selection tool's list: every officially sourced program with a
   * capacity in the given (else the latest) year, compact enough to filter in
   * the browser.
   */
  async catalog(query: CatalogQueryDto) {
    const degree = (query.degree ?? "master").toUpperCase() as Degree;
    const latest = await this.prisma.capacity.aggregate({
      where: { source: { is: ACTIVE_OFFICIAL_SOURCE }, selectionCode: { not: null }, program: { degree } },
      _max: { examYear: true },
    });
    const examYear = query.year ?? latest._max.examYear;
    if (!examYear) return { examYear: null, source: null, programs: [] };
    const programs = await this.prisma.program.findMany({
      where: {
        degree,
        source: { is: ACTIVE_OFFICIAL_SOURCE },
        university: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
        capacities: { some: { examYear, source: { is: ACTIVE_OFFICIAL_SOURCE } } },
      },
      select: {
        id: true,
        code: true,
        title: true,
        field: true,
        examSetCode: true,
        coefficientGroup: true,
        orientation: true,
        period: true,
        tuitionType: true,
        location: true,
        city: true,
        gender: true,
        hasDormitory: true,
        university: { select: { code: true, title: true } },
        capacities: {
          where: { examYear, source: { is: ACTIVE_OFFICIAL_SOURCE } },
          select: { quota: true, capacity: true, selectionCode: true, notes: true, bookletPage: true, source: { select: PUBLIC_SOURCE_SELECT } },
        },
      },
      orderBy: { code: "asc" },
    });
    return {
      examYear,
      source: programs.find((p) => p.capacities[0])?.capacities[0].source ?? null,
      programs: programs.map(({ capacities, ...program }) => ({
        ...program,
        selectionCode: capacities.find((c) => c.selectionCode)?.selectionCode ?? null,
        capacity: capacities.reduce((sum, c) => sum + c.capacity, 0),
        notes: capacities.find((c) => c.notes)?.notes ?? null,
        bookletPage: capacities.find((c) => c.bookletPage)?.bookletPage ?? null,
      })),
    };
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
    const already = await this.prisma.choiceListItem.findUnique({ where: { choiceListId_programId: { choiceListId: list.id, programId } } });
    if (already) return already;
    if ((await this.prisma.choiceListItem.count({ where: { choiceListId: list.id } })) >= MAX_CHOICES) {
      throw new BadRequestException(`فرم انتخاب رشته حداکثر ${fa(MAX_CHOICES)} کد می‌گیرد؛ برای افزودن این کد، یکی از انتخاب‌ها را حذف کن.`);
    }
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
          include: {
            program: {
              include: {
                university: true,
                capacities: { where: { source: { is: ACTIVE_OFFICIAL_SOURCE } }, orderBy: [{ examYear: "desc" }, { quota: "asc" }] },
              },
            },
          },
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
      examSetCode: program.examSetCode,
      coefficientGroup: program.coefficientGroup,
      orientation: program.orientation,
      period: program.period,
      location: program.location,
      city: program.city,
      gender: program.gender,
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
        selectionCode: capacity.selectionCode,
        notes: capacity.notes,
        bookletPage: capacity.bookletPage,
        source: capacity.source,
      })),
    };
  }
}
