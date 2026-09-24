import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ObjectStorageService } from "../ingestion/object-storage.service";
import { LESSON_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { UpdateLessonDto } from "./dto/update-lesson.dto";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export const MAX_LESSON_IMAGE_BYTES = 5 * 1024 * 1024;

export interface LessonAsset {
  media_key: string;
  checksum: string;
  filename: string;
  mime_type: string;
}

/**
 * A video block plays either a file (https URL ending in a video extension)
 * or an Aparat page. YouTube and other hosts are not accepted: the site's
 * audience cannot reach YouTube, and an arbitrary URL would be embedded as
 * an iframe on a paid lesson page.
 */
export function videoSource(url: string): { kind: "aparat"; hash: string } | { kind: "file" } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "aparat.com") {
    const match = parsed.pathname.match(/^\/(?:v|video\/video\/embed\/videohash)\/([A-Za-z0-9]+)/);
    return match ? { kind: "aparat", hash: match[1] } : null;
  }
  return /\.(mp4|webm|m3u8)$/i.test(parsed.pathname) ? { kind: "file" } : null;
}

/**
 * Lesson blocks beyond the type check: an image must name media this lesson
 * actually carries, and a video must be a source the player can show.
 */
export function assertLessonBlocks(blocks: unknown[], assets: LessonAsset[]) {
  assertValidContentBlocks(blocks, LESSON_BLOCK_TYPES);
  const keys = new Set(assets.map((asset) => asset.media_key));
  blocks.forEach((raw, index) => {
    const block = raw as Record<string, unknown>;
    if (block.type === "image" && !keys.has(String(block.media_key ?? ""))) {
      throw new BadRequestException(`content_blocks[${index}] refers to an image this lesson does not have`);
    }
    if (block.type === "video" && !videoSource(String(block.url ?? ""))) {
      throw new BadRequestException(`content_blocks[${index}].url must be an Aparat link or an https video file`);
    }
    if ((block.type === "text" || block.type === "heading") && !String(block.text ?? "").trim()) {
      throw new BadRequestException(`content_blocks[${index}] is empty`);
    }
  });
}

type Direction = "up" | "down";

/**
 * Editing a course after it is created: lessons and modules can be
 * changed, reordered and -- while nobody has studied them -- removed, and a
 * lesson can carry images. Everything here is audited; the catalogue and
 * student paths read the same rows.
 */
@Injectable()
export class CourseAuthoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
  ) {}

  // --- courses -----------------------------------------------------------------

  async setPublished(actorId: string, courseId: string, isPublished: boolean) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) throw new NotFoundException("course not found");
    const updated = await this.prisma.course.update({ where: { id: courseId }, data: { isPublished } });
    await this.audit.log({
      actorUserId: actorId,
      action: isPublished ? "course.published" : "course.unpublished",
      targetType: "Course",
      targetId: courseId,
    });
    return updated;
  }

  // --- modules -----------------------------------------------------------------

  async renameModule(actorId: string, moduleId: string, title: string) {
    const existing = await this.prisma.courseModule.findUnique({ where: { id: moduleId }, select: { id: true } });
    if (!existing) throw new NotFoundException("course module not found");
    const updated = await this.prisma.courseModule.update({ where: { id: moduleId }, data: { title } });
    await this.audit.log({ actorUserId: actorId, action: "course_module.updated", targetType: "CourseModule", targetId: moduleId });
    return updated;
  }

  /** Only an empty module can go: removing one with lessons would take
   * students' progress and plan tasks with it. */
  async deleteModule(actorId: string, moduleId: string) {
    const existing = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true, _count: { select: { lessons: true } } },
    });
    if (!existing) throw new NotFoundException("course module not found");
    if (existing._count.lessons > 0) throw new BadRequestException("remove or move this module's lessons first");
    await this.prisma.courseModule.delete({ where: { id: moduleId } });
    await this.audit.log({ actorUserId: actorId, action: "course_module.deleted", targetType: "CourseModule", targetId: moduleId, metadata: { courseId: existing.courseId } });
    return { id: moduleId, deleted: true };
  }

  async moveModule(moduleId: string, direction: Direction) {
    const current = await this.prisma.courseModule.findUnique({ where: { id: moduleId } });
    if (!current) throw new NotFoundException("course module not found");
    const siblings = await this.prisma.courseModule.findMany({
      where: { courseId: current.courseId },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    await this.reorder(siblings.map((row) => row.id), moduleId, direction, (id, order) =>
      this.prisma.courseModule.update({ where: { id }, data: { order } }),
    );
    return { id: moduleId };
  }

  // --- lessons -----------------------------------------------------------------

  async getLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        topics: { select: { topicId: true } },
        courseModule: { select: { id: true, title: true, courseId: true } },
        _count: { select: { progress: true } },
      },
    });
    if (!lesson) throw new NotFoundException("lesson not found");
    return lesson;
  }

  async updateLesson(actorId: string, lessonId: string, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, assets: true } });
    if (!lesson) throw new NotFoundException("lesson not found");
    if (dto.contentBlocks) assertLessonBlocks(dto.contentBlocks, lesson.assets as unknown as LessonAsset[]);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.topicIds) {
        await tx.lessonTopic.deleteMany({ where: { lessonId } });
        if (dto.topicIds.length) {
          await tx.lessonTopic.createMany({ data: [...new Set(dto.topicIds)].map((topicId) => ({ lessonId, topicId })) });
        }
      }
      return tx.lesson.update({
        where: { id: lessonId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.isPreview !== undefined ? { isPreview: dto.isPreview } : {}),
          ...(dto.contentBlocks ? { contentBlocks: dto.contentBlocks as Prisma.InputJsonValue } : {}),
        },
      });
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "lesson.updated",
      targetType: "Lesson",
      targetId: lessonId,
      metadata: { fields: Object.keys(dto) },
    });
    return updated;
  }

  /** A lesson a student has opened keeps their progress history; it cannot
   * be deleted, only edited (or the course unpublished). */
  async deleteLesson(actorId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseModuleId: true, _count: { select: { progress: true, planTasks: true } } },
    });
    if (!lesson) throw new NotFoundException("lesson not found");
    if (lesson._count.progress > 0 || lesson._count.planTasks > 0) {
      throw new BadRequestException("students have already studied or planned this lesson; edit it instead of deleting it");
    }
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    await this.audit.log({ actorUserId: actorId, action: "lesson.deleted", targetType: "Lesson", targetId: lessonId, metadata: { moduleId: lesson.courseModuleId } });
    return { id: lessonId, deleted: true };
  }

  async moveLesson(lessonId: string, direction: Direction) {
    const current = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!current) throw new NotFoundException("lesson not found");
    const siblings = await this.prisma.lesson.findMany({
      where: { courseModuleId: current.courseModuleId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await this.reorder(siblings.map((row) => row.id), lessonId, direction, (id, order) =>
      this.prisma.lesson.update({ where: { id }, data: { order } }),
    );
    return { id: lessonId };
  }

  /**
   * Stores an image for a lesson and adds it to the lesson's assets, so an
   * image block can refer to it by the returned media_key. Stored by content
   * hash: uploading the same file twice reuses one object.
   */
  async uploadLessonImage(actorId: string, lessonId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("no file uploaded");
    const extension = IMAGE_TYPES[file.mimetype];
    if (!extension) throw new BadRequestException("image must be JPEG, PNG, WebP or GIF");
    if (file.size > MAX_LESSON_IMAGE_BYTES) throw new BadRequestException("image must be 5 MB or smaller");
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, assets: true } });
    if (!lesson) throw new NotFoundException("lesson not found");

    const digest = createHash("sha256").update(file.buffer).digest("hex");
    const checksum = `sha256:${digest}`;
    const key = `${digest}/lesson-image.${extension}`;
    if (!(await this.storage.objectExists(key))) await this.storage.putObject(key, file.buffer, file.mimetype);
    await this.prisma.sourceArtifact.upsert({
      where: { checksum },
      update: {},
      create: { checksum, filename: `lesson-image.${extension}`, mimeType: file.mimetype, size: file.size, storageKey: key },
    });

    const assets = (lesson.assets as unknown as LessonAsset[]) ?? [];
    const mediaKey = `img-${digest.slice(0, 12)}`;
    if (!assets.some((asset) => asset.media_key === mediaKey)) {
      assets.push({ media_key: mediaKey, checksum, filename: file.originalname || `lesson-image.${extension}`, mime_type: file.mimetype });
      await this.prisma.lesson.update({ where: { id: lessonId }, data: { assets: assets as unknown as Prisma.InputJsonValue } });
    }
    await this.audit.log({ actorUserId: actorId, action: "lesson.image_uploaded", targetType: "Lesson", targetId: lessonId, metadata: { mediaKey } });
    return { media_key: mediaKey, checksum, url: `/media/${digest}` };
  }

  // --- shared ------------------------------------------------------------------

  /** Moves one id a step within an ordered list and rewrites every order
   * as 1..n, which also repairs the duplicate orders older rows may have. */
  private async reorder(
    ids: string[],
    id: string,
    direction: Direction,
    write: (id: string, order: number) => Prisma.PrismaPromise<unknown>,
  ) {
    const index = ids.indexOf(id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await this.prisma.$transaction(ids.map((rowId, position) => write(rowId, position + 1)));
  }
}
