import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObjectStorageService } from "../ingestion/object-storage.service";
import { AchievementDto } from "./dto/achievement.dto";

/**
 * The public face of a result. Excludes the consent note -- how consent was
 * obtained is between the owner and the student -- and exposes the photo only
 * as a checksum the media route will resolve.
 */
const PUBLIC_ACHIEVEMENT_SELECT = {
  id: true,
  displayName: true,
  examYear: true,
  degree: true,
  field: true,
  rank: true,
  rankLabel: true,
  acceptedUniversity: true,
  acceptedProgram: true,
  quote: true,
  subjectSlugs: true,
  videoUrl: true,
  sourceUrl: true,
  isFeatured: true,
  photoArtifact: { select: { checksum: true } },
  course: { select: { slug: true, title: true } },
} satisfies Prisma.StudentAchievementSelect;

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AchievementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
  ) {}

  // --- public ----------------------------------------------------------------

  /** Published results only. Featured first, then best rank, then newest
   * year -- so the wall opens with the result that says the most. */
  async listPublic(filters: { examYear?: number; subjectSlug?: string; limit?: number }) {
    const rows = await this.prisma.studentAchievement.findMany({
      where: {
        isPublished: true,
        ...(filters.examYear ? { examYear: filters.examYear } : {}),
        ...(filters.subjectSlug ? { subjectSlugs: { has: filters.subjectSlug } } : {}),
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { rank: "asc" }, { examYear: "desc" }],
      take: Math.min(Math.max(filters.limit ?? 60, 1), 200),
      select: PUBLIC_ACHIEVEMENT_SELECT,
    });
    return rows.map(({ photoArtifact, ...row }) => ({
      ...row,
      photoPath: photoArtifact ? `/media/${photoArtifact.checksum.replace("sha256:", "")}` : null,
    }));
  }

  /**
   * Headline numbers for the wall, computed from published results only.
   *
   * Never a figure typed in by hand: a count on the homepage that nobody can
   * trace back to named, consented rows is exactly the unverifiable claim this
   * site is supposed to be the alternative to.
   */
  async summary() {
    const rows = await this.prisma.studentAchievement.findMany({
      where: { isPublished: true },
      select: { rank: true, examYear: true, field: true },
    });

    const years = [...new Set(rows.map((row) => row.examYear))].sort((a, b) => b - a);
    const bestByYear = years.map((year) => ({
      examYear: year,
      bestRank: Math.min(...rows.filter((row) => row.examYear === year).map((row) => row.rank)),
      count: rows.filter((row) => row.examYear === year).length,
    }));

    return {
      total: rows.length,
      under10: rows.filter((row) => row.rank <= 10).length,
      under100: rows.filter((row) => row.rank <= 100).length,
      under1000: rows.filter((row) => row.rank <= 1000).length,
      bestRank: rows.length ? Math.min(...rows.map((row) => row.rank)) : null,
      years: bestByYear,
    };
  }

  // --- admin -----------------------------------------------------------------

  async listForAdmin() {
    return this.prisma.studentAchievement.findMany({
      orderBy: [{ examYear: "desc" }, { rank: "asc" }],
      include: {
        photoArtifact: { select: { checksum: true } },
        course: { select: { id: true, title: true } },
      },
    });
  }

  async create(actorId: string, dto: AchievementDto) {
    this.assertPublishable(dto);
    const row = await this.prisma.studentAchievement.create({ data: this.toData(dto) });
    await this.audit.log({
      actorUserId: actorId,
      action: "achievement.created",
      targetType: "StudentAchievement",
      targetId: row.id,
      metadata: { rank: dto.rank, examYear: dto.examYear, isPublished: dto.isPublished ?? false },
    });
    return row;
  }

  async update(actorId: string, id: string, dto: AchievementDto) {
    const existing = await this.prisma.studentAchievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("achievement not found");
    this.assertPublishable(dto);

    const row = await this.prisma.studentAchievement.update({ where: { id }, data: this.toData(dto) });
    await this.audit.log({
      actorUserId: actorId,
      action: "achievement.updated",
      targetType: "StudentAchievement",
      targetId: id,
      metadata: { isPublished: row.isPublished },
    });
    return row;
  }

  /** Taking a result down is always allowed and always immediate -- a
   * student who withdraws consent must not wait on anything. */
  async unpublish(actorId: string, id: string) {
    const existing = await this.prisma.studentAchievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("achievement not found");
    const row = await this.prisma.studentAchievement.update({ where: { id }, data: { isPublished: false } });
    await this.audit.log({
      actorUserId: actorId,
      action: "achievement.unpublished",
      targetType: "StudentAchievement",
      targetId: id,
    });
    return row;
  }

  /**
   * Erases a result for good, when the student asks to be removed rather than
   * just hidden. The photo goes too -- from the database and from object
   * storage -- unless another row still uses the same image. The audit entry
   * records that a row was erased, never who it was.
   */
  async remove(actorId: string, id: string) {
    const existing = await this.prisma.studentAchievement.findUnique({
      where: { id },
      select: { id: true, photoArtifact: { select: { id: true, storageKey: true } } },
    });
    if (!existing) throw new NotFoundException("achievement not found");

    await this.prisma.studentAchievement.delete({ where: { id } });

    const photo = existing.photoArtifact;
    let photoErased = false;
    if (photo && /\/achievement\.(jpg|png|webp)$/.test(photo.storageKey)) {
      const stillUsed = await this.prisma.studentAchievement.count({ where: { photoArtifactId: photo.id } });
      if (stillUsed === 0) {
        await this.storage.removeObject(photo.storageKey);
        await this.prisma.sourceArtifact.delete({ where: { id: photo.id } }).catch(() => undefined);
        photoErased = true;
      }
    }

    await this.audit.log({
      actorUserId: actorId,
      action: "achievement.erased",
      targetType: "StudentAchievement",
      targetId: id,
      metadata: { photoErased },
    });
    return { id, erased: true, photoErased };
  }

  /**
   * Stores a student photo in object storage, never in the repository: the
   * repository is public, and a person's face does not belong in its history
   * where no later deletion can reach it.
   */
  async uploadPhoto(actorId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("no file uploaded");
    if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
      throw new BadRequestException("photo must be JPEG, PNG or WebP");
    }
    if (file.size > MAX_PHOTO_BYTES) throw new BadRequestException("photo must be 5 MB or smaller");

    const digest = createHash("sha256").update(file.buffer).digest("hex");
    const checksum = `sha256:${digest}`;
    const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const key = `${digest}/achievement.${extension}`;

    if (!(await this.storage.objectExists(key))) {
      await this.storage.putObject(key, file.buffer, file.mimetype);
    }
    const artifact = await this.prisma.sourceArtifact.upsert({
      where: { checksum },
      update: {},
      create: {
        checksum,
        filename: `achievement.${extension}`,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
      },
    });

    await this.audit.log({
      actorUserId: actorId,
      action: "achievement.photo_uploaded",
      targetType: "SourceArtifact",
      targetId: artifact.id,
    });
    return { photoArtifactId: artifact.id, photoPath: `/media/${digest}` };
  }

  // --- shared ----------------------------------------------------------------

  /** Mirrors the database CHECK, so the admin gets a readable reason instead
   * of a constraint-violation error when they try to publish too early. */
  private assertPublishable(dto: AchievementDto) {
    if (dto.isPublished && !dto.consentConfirmedAt) {
      throw new BadRequestException("a result cannot be published without a recorded consent date");
    }
  }

  private toData(dto: AchievementDto) {
    return {
      displayName: dto.displayName.trim(),
      photoArtifactId: dto.photoArtifactId ?? null,
      examYear: dto.examYear,
      degree: dto.degree,
      field: dto.field.trim(),
      rank: dto.rank,
      rankLabel: dto.rankLabel?.trim() || null,
      acceptedUniversity: dto.acceptedUniversity?.trim() || null,
      acceptedProgram: dto.acceptedProgram?.trim() || null,
      quote: dto.quote?.trim() || null,
      subjectSlugs: dto.subjectSlugs ?? [],
      courseId: dto.courseId ?? null,
      videoUrl: dto.videoUrl?.trim() || null,
      sourceUrl: dto.sourceUrl?.trim() || null,
      consentConfirmedAt: dto.consentConfirmedAt ? new Date(dto.consentConfirmedAt) : null,
      consentNote: dto.consentNote?.trim() || null,
      isPublished: dto.isPublished ?? false,
      isFeatured: dto.isFeatured ?? false,
      sortOrder: dto.sortOrder ?? 0,
    };
  }
}
