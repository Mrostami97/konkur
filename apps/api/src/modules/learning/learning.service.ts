import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { AccessMode, EnrollmentSource, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AccessService } from "../access/access.service";
import { ObjectStorageService } from "../ingestion/object-storage.service";
import { LESSON_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { CreateCourseDto } from "./dto/create-course.dto";
import { CreateModuleDto } from "./dto/create-module.dto";
import { CreateLessonDto, LessonAssetDto, UpdateLessonDto } from "./dto/create-lesson.dto";
import { fa } from "../../common/persian-digits";
import { faststartMp4 } from "./mp4-faststart";

type Tx = PrismaService | Prisma.TransactionClient;

const MAX_LESSON_IMAGE_BYTES = 5 * 1024 * 1024;
/** A free sample lesson is a short video; a whole session belongs in the
 * course player. Also about the most a slow line uploads through the CDN. */
export const MAX_LESSON_VIDEO_BYTES = 300 * 1024 * 1024;

/** MP4 or WebM from the first bytes; a QuickTime .mov is told apart, since
 * browsers play it unreliably. */
async function sniffVideoType(path: string): Promise<"video/mp4" | "video/webm" | "quicktime" | null> {
  const handle = await fs.open(path, "r");
  const head = Buffer.alloc(12);
  try {
    await handle.read(head, 0, 12, 0);
  } finally {
    await handle.close();
  }
  if (head.toString("latin1", 4, 8) === "ftyp") return head.toString("latin1", 8, 12) === "qt  " ? "quicktime" : "video/mp4";
  if (head.readUInt32BE(0) === 0x1a45dfa3) return "video/webm";
  return null;
}

async function sha256OfFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** The declared type is the browser's guess from the file name; the leading
 * bytes are what the file actually is. Both must agree before it is stored
 * and later served to students as an image. */
function sniffImageType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    private readonly storage: ObjectStorageService,
  ) {}

  // --- Admin/author authoring -------------------------------------------------

  async createCourse(actorId: string, dto: CreateCourseDto) {
    const course = await this.prisma.course.create({ data: dto });
    await this.audit.log({
      actorUserId: actorId,
      action: "course.created",
      targetType: "Course",
      targetId: course.id,
    });
    return course;
  }

  /**
   * Edits a course after creation. There was no update path at all before
   * this, so a course could never be corrected or given a SpotPlayer id --
   * every existing course would have had to be recreated to gain video.
   */
  async updateCourse(actorId: string, courseId: string, dto: CreateCourseDto) {
    const existing = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!existing) throw new NotFoundException("course not found");

    const course = await this.prisma.course.update({ where: { id: courseId }, data: dto });
    await this.audit.log({
      actorUserId: actorId,
      action: "course.updated",
      targetType: "Course",
      targetId: courseId,
      metadata: { slug: dto.slug, spotPlayerCourseId: dto.spotPlayerCourseId ?? null },
    });
    return course;
  }

  async publishCourse(courseId: string, actorId: string) {
    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: { isPublished: true },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "course.published",
      targetType: "Course",
      targetId: courseId,
    });
    return course;
  }

  async addModule(courseId: string, dto: CreateModuleDto) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException("course not found");
    return this.prisma.courseModule.create({ data: { courseId, ...dto } });
  }

  async addLesson(courseModuleId: string, dto: CreateLessonDto) {
    const mod = await this.prisma.courseModule.findUnique({ where: { id: courseModuleId } });
    if (!mod) throw new NotFoundException("course module not found");
    assertValidContentBlocks(dto.contentBlocks, LESSON_BLOCK_TYPES);
    const assets = await this.assertLessonAssets(dto.contentBlocks, dto.assets ?? []);
    const { topicIds = [], ...lessonInput } = dto;
    return this.prisma.lesson.create({
      data: {
        courseModuleId,
        title: lessonInput.title,
        order: lessonInput.order,
        contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
        assets: assets as unknown as Prisma.InputJsonValue,
        isPreview: lessonInput.isPreview ?? false,
        topics: topicIds.length > 0 ? { create: topicIds.map((topicId) => ({ topicId })) } : undefined,
      },
    });
  }

  // --- Lifecycle: unpublish, reorder, delete ------------------------------
  // A delete is refused while anything a student did depends on the row:
  // enrollments and lesson progress would cascade away with it. The refusal
  // names the reason in Persian because the admin panel shows it as is.

  async unpublishCourse(actorId: string, courseId: string) {
    const course = await this.prisma.course.update({ where: { id: courseId }, data: { isPublished: false } }).catch(() => null);
    if (!course) throw new NotFoundException("course not found");
    await this.audit.log({ actorUserId: actorId, action: "course.unpublished", targetType: "Course", targetId: courseId });
    return course;
  }

  async deleteCourse(actorId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        _count: { select: { enrollments: true, products: true, productGrants: true, spotPlayerLicenses: true } },
      },
    });
    if (!course) throw new NotFoundException("course not found");
    const progress = await this.prisma.lessonProgress.count({ where: { lesson: { courseModule: { courseId } } } });
    const reasons = [
      course._count.enrollments > 0 && `${fa(course._count.enrollments)} ثبت‌نام`,
      progress > 0 && `${fa(progress)} سابقهٔ مطالعهٔ درس`,
      course._count.products + course._count.productGrants > 0 && "محصول فروش",
      course._count.spotPlayerLicenses > 0 && "لایسنس ویدیو",
    ].filter(Boolean);
    if (reasons.length > 0) {
      throw new ConflictException(`این دوره ${reasons.join("، ")} دارد و حذف آن سابقهٔ دانشجوها را پاک می‌کند؛ به‌جای حذف، انتشارش را لغو کنید.`);
    }
    await this.prisma.course.delete({ where: { id: courseId } });
    await this.audit.log({ actorUserId: actorId, action: "course.deleted", targetType: "Course", targetId: courseId, metadata: { slug: course.slug } });
    return { deleted: true };
  }

  async updateModule(moduleId: string, title: string) {
    const mod = await this.prisma.courseModule.update({ where: { id: moduleId }, data: { title } }).catch(() => null);
    if (!mod) throw new NotFoundException("course module not found");
    return mod;
  }

  async deleteModule(actorId: string, moduleId: string) {
    const mod = await this.prisma.courseModule.findUnique({ where: { id: moduleId }, select: { id: true, courseId: true } });
    if (!mod) throw new NotFoundException("course module not found");
    const progress = await this.prisma.lessonProgress.count({ where: { lesson: { courseModuleId: moduleId } } });
    if (progress > 0) {
      throw new ConflictException(`درس‌های این سرفصل ${fa(progress)} سابقهٔ مطالعه دارند؛ حذف سرفصل آن سابقه را پاک می‌کند.`);
    }
    await this.prisma.courseModule.delete({ where: { id: moduleId } });
    await this.audit.log({ actorUserId: actorId, action: "course_module.deleted", targetType: "CourseModule", targetId: moduleId, metadata: { courseId: mod.courseId } });
    return { deleted: true };
  }

  async deleteLesson(actorId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, title: true, _count: { select: { progress: true } } } });
    if (!lesson) throw new NotFoundException("lesson not found");
    if (lesson._count.progress > 0) {
      throw new ConflictException(`این درس ${fa(lesson._count.progress)} سابقهٔ مطالعه دارد؛ حذفش آن سابقه را پاک می‌کند.`);
    }
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    await this.audit.log({ actorUserId: actorId, action: "lesson.deleted", targetType: "Lesson", targetId: lessonId, metadata: { title: lesson.title } });
    return { deleted: true };
  }

  /** Sets the order of a module's lessons to the given sequence. */
  async reorderLessons(moduleId: string, lessonIds: string[]) {
    const lessons = await this.prisma.lesson.findMany({ where: { courseModuleId: moduleId }, select: { id: true } });
    const current = new Set(lessons.map((lesson) => lesson.id));
    if (lessonIds.length !== current.size || lessonIds.some((id) => !current.has(id))) {
      throw new BadRequestException("lessonIds must list every lesson of the module exactly once");
    }
    await this.prisma.$transaction(
      lessonIds.map((id, index) => this.prisma.lesson.update({ where: { id }, data: { order: index + 1 } })),
    );
    return { reordered: lessonIds.length };
  }

  /** The whole lesson for the editor, whatever its course's state. */
  async getLessonForEditing(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException("lesson not found");
    return lesson;
  }

  async updateLesson(actorId: string, lessonId: string, dto: UpdateLessonDto) {
    const existing = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!existing) throw new NotFoundException("lesson not found");
    const blocks = dto.contentBlocks ?? (existing.contentBlocks as unknown[]);
    if (dto.contentBlocks) assertValidContentBlocks(dto.contentBlocks, LESSON_BLOCK_TYPES);
    const assets = await this.assertLessonAssets(
      blocks,
      dto.assets ?? ((existing.assets ?? []) as unknown as LessonAssetDto[]),
    );
    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: dto.title,
        isPreview: dto.isPreview,
        contentBlocks: dto.contentBlocks ? (dto.contentBlocks as Prisma.InputJsonValue) : undefined,
        assets: assets as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "lesson.updated",
      targetType: "Lesson",
      targetId: lessonId,
      metadata: { fields: Object.keys(dto) },
    });
    return lesson;
  }

  /**
   * Stores an image for a lesson and returns what an image block needs to
   * reference it. The upload is not tied to a lesson: the author adds images
   * while writing, before the lesson exists, and saving the lesson is what
   * attaches them.
   */
  async uploadLessonImage(actorId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("no file uploaded");
    if (file.size > MAX_LESSON_IMAGE_BYTES) throw new BadRequestException("image must be 5 MB or smaller");
    const sniffed = sniffImageType(file.buffer);
    if (!sniffed || sniffed !== file.mimetype) {
      throw new BadRequestException("image must be a PNG, JPEG or WebP file");
    }

    const digest = createHash("sha256").update(file.buffer).digest("hex");
    const checksum = `sha256:${digest}`;
    const extension = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
    const key = `${digest}/lesson-image.${extension}`;
    if (!(await this.storage.objectExists(key))) {
      await this.storage.putObject(key, file.buffer, sniffed);
    }
    const artifact = await this.prisma.sourceArtifact.upsert({
      where: { checksum },
      update: {},
      create: { checksum, filename: `lesson-image.${extension}`, mimeType: sniffed, size: file.size, storageKey: key },
    });
    await this.audit.log({
      actorUserId: actorId,
      action: "lesson.image_uploaded",
      targetType: "SourceArtifact",
      targetId: artifact.id,
    });
    return { media_key: `img-${digest.slice(0, 12)}`, checksum, url: `/media/${digest}` };
  }

  /**
   * A video for a lesson -- in practice a free sample of a course. The
   * upload arrives on disk, not in memory. An MP4 whose index sits at the
   * end, as phones write it, is rewritten with the index first so it starts
   * playing at once instead of after most of it has downloaded.
   */
  async uploadLessonVideo(actorId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("no file uploaded");
    const fastPath = `${file.path}.fast`;
    try {
      if (file.size > MAX_LESSON_VIDEO_BYTES) throw new BadRequestException("video must be 300 MB or smaller");
      const sniffed = await sniffVideoType(file.path);
      if (sniffed === "quicktime") {
        throw new BadRequestException("MOV files play unreliably in browsers; export the video as MP4 (H.264) and upload that");
      }
      if (!sniffed) throw new BadRequestException("video must be an MP4 or WebM file");

      let path = file.path;
      if (sniffed === "video/mp4") {
        const moved = await faststartMp4(file.path, fastPath).catch(() => {
          throw new BadRequestException("the MP4 file is damaged or incomplete");
        });
        if (moved) path = fastPath;
      }
      const digest = await sha256OfFile(path);
      const { size } = await fs.stat(path);
      const checksum = `sha256:${digest}`;
      const extension = sniffed === "video/webm" ? "webm" : "mp4";
      const key = `${digest}/lesson-video.${extension}`;
      if (!(await this.storage.objectExists(key))) {
        await this.storage.putFile(key, path, sniffed);
      }
      const artifact = await this.prisma.sourceArtifact.upsert({
        where: { checksum },
        update: {},
        create: { checksum, filename: `lesson-video.${extension}`, mimeType: sniffed, size, storageKey: key },
      });
      await this.audit.log({
        actorUserId: actorId,
        action: "lesson.video_uploaded",
        targetType: "SourceArtifact",
        targetId: artifact.id,
      });
      return { media_key: `vid-${digest.slice(0, 12)}`, checksum, url: `/media/${digest}`, size };
    } finally {
      await fs.rm(file.path, { force: true });
      await fs.rm(fastPath, { force: true });
    }
  }

  /**
   * Every image block must name an image the lesson carries, and every image
   * it carries must have been uploaded as an image -- otherwise the student
   * sees a broken figure, or a checksum points at something that is not a
   * picture at all. Images no block uses are dropped.
   */
  private async assertLessonAssets(blocks: unknown[], assets: LessonAssetDto[]): Promise<LessonAssetDto[]> {
    const byKey = new Map<string, LessonAssetDto>();
    for (const asset of assets) {
      if (byKey.has(asset.media_key)) throw new BadRequestException(`duplicate media_key "${asset.media_key}"`);
      byKey.set(asset.media_key, { media_key: asset.media_key, checksum: asset.checksum });
    }
    const used = new Set<string>();
    const kinds = new Map<string, "image/" | "video/">();
    blocks.forEach((block, index) => {
      const { type, media_key: mediaKey } = block as { type?: string; media_key?: unknown };
      // A video block is either an uploaded file (media_key) or, from older
      // imports, a plain url; only the uploaded kind is checked here.
      if (type !== "image" && !(type === "video" && mediaKey !== undefined)) return;
      if (typeof mediaKey !== "string" || !byKey.has(mediaKey)) {
        throw new BadRequestException(`content_blocks[${index}] references a ${type} the lesson does not carry`);
      }
      used.add(mediaKey);
      kinds.set(mediaKey, type === "video" ? "video/" : "image/");
    });
    const kept = [...byKey.values()].filter((asset) => used.has(asset.media_key));
    if (kept.length === 0) return kept;
    const artifacts = await this.prisma.sourceArtifact.findMany({
      where: { checksum: { in: kept.map((asset) => asset.checksum) } },
      select: { checksum: true, mimeType: true },
    });
    const mimeOf = new Map(artifacts.map((artifact) => [artifact.checksum, artifact.mimeType]));
    const missing = kept.find((asset) => !mimeOf.get(asset.checksum)?.startsWith(kinds.get(asset.media_key)!));
    if (missing) {
      const kind = kinds.get(missing.media_key) === "video/" ? "video" : "image";
      throw new BadRequestException(`${kind} "${missing.media_key}" was not uploaded`);
    }
    return kept;
  }

  // --- Public catalog -----------------------------------------------------

  /**
   * The public course catalogue. An explicit select for the same reason as
   * the syllabus below: this returned the whole row, which by now included
   * `spotPlayerCourseId`. It also carries what a catalogue card needs --
   * who teaches the course, how much of it there is, and whether it has
   * video -- so the homepage does not have to fetch each course separately.
   */
  async listPublishedCourses() {
    const courses = await this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        isPublished: true,
        accessMode: true,
        subjectId: true,
        degreeTargets: true,
        fieldTargets: true,
        createdAt: true,
        updatedAt: true,
        spotPlayerCourseId: true,
        subject: { select: { code: true, title: true } },
        instructors: {
          where: { contributorProfile: { isPublished: true } },
          orderBy: { sortOrder: "asc" },
          select: { contributorProfile: { select: { slug: true, displayName: true, avatarUrl: true } } },
        },
        modules: { select: { _count: { select: { lessons: true } } } },
      },
    });

    return courses.map(({ spotPlayerCourseId, instructors, modules, ...course }) => ({
      ...course,
      instructors: instructors.map((row) => row.contributorProfile),
      moduleCount: modules.length,
      lessonCount: modules.reduce((sum, row) => sum + row._count.lessons, 0),
      // Whether there is video, not where it lives: the id stays private.
      hasVideo: spotPlayerCourseId !== null,
    }));
  }

  /**
   * The public syllabus.
   *
   * An explicit select rather than `include`, so this states what a public
   * endpoint returns instead of returning the whole row minus whatever
   * somebody remembered to strip. `spotPlayerCourseId` is the field that
   * made the difference concrete -- it is operational configuration, and
   * knowing it grants nothing, but a public page has no reason to carry it
   * and the next such column should not leak by default either.
   */
  async getCourseSyllabus(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        isPublished: true,
        accessMode: true,
        subjectId: true,
        degreeTargets: true,
        fieldTargets: true,
        createdAt: true,
        updatedAt: true,
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              select: { id: true, title: true, order: true, isPreview: true },
            },
          },
        },
        // Titles only: a handout's file is served by the access-checked
        // resource content route, never from here.
        materials: {
          where: { resource: { reviewStatus: "PUBLISHED" } },
          orderBy: { position: "asc" },
          select: { resource: { select: { slug: true, title: true, summary: true, kind: true, hostingMode: true } } },
        },
      },
    });
    if (!course || !course.isPublished) throw new NotFoundException("course not found");
    const { materials, ...rest } = course;
    return { ...rest, materials: materials.map((row) => row.resource) };
  }

  /**
   * Replaces the handouts that come with a course, in the order given.
   * Only published resources whose file the site keeps can be attached,
   * because course buyers read them in the panel reader.
   */
  async setCourseMaterials(actorId: string, courseId: string, resourceIds: string[]) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (!course) throw new NotFoundException("course not found");
    const ids = [...new Set(resourceIds)];
    const resources = await this.prisma.resource.findMany({
      where: { id: { in: ids } },
      select: { id: true, reviewStatus: true, hostingMode: true, accessMode: true },
    });
    if (resources.length !== ids.length) throw new BadRequestException("یکی از جزوه‌ها پیدا نشد.");
    const unusable = resources.find(
      (resource) =>
        resource.reviewStatus !== "PUBLISHED" ||
        !["USER_UPLOAD", "MIRRORED_WITH_PERMISSION"].includes(resource.hostingMode) ||
        resource.accessMode === AccessMode.PUBLIC,
    );
    if (unusable) {
      throw new BadRequestException("فقط جزوهٔ منتشرشده با فایل بارگذاری‌شده و دسترسی غیرعمومی به دوره وصل می‌شود.");
    }
    await this.prisma.$transaction([
      this.prisma.courseMaterial.deleteMany({ where: { courseId } }),
      this.prisma.courseMaterial.createMany({ data: ids.map((resourceId, position) => ({ courseId, resourceId, position })) }),
    ]);
    await this.audit.log({
      actorUserId: actorId,
      action: "course.materials_set",
      targetType: "Course",
      targetId: courseId,
      metadata: { resourceIds: ids },
    });
    return this.listCourseMaterials(courseId);
  }

  async listCourseMaterials(courseId: string) {
    const rows = await this.prisma.courseMaterial.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
      select: { resource: { select: { id: true, slug: true, title: true, reviewStatus: true, accessMode: true, hostingMode: true } } },
    });
    return rows.map((row) => row.resource);
  }

  async listAllCourses() {
    return this.prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        materials: {
          orderBy: { position: "asc" },
          select: { resource: { select: { id: true, slug: true, title: true, reviewStatus: true, accessMode: true, hostingMode: true } } },
        },
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              select: { id: true, title: true, order: true, isPreview: true },
            },
          },
        },
      },
    });
  }

  // --- Enrollment (created synchronously when Commerce grants a course
  // entitlement -- see AGENTS.md for why this isn't done via an async outbox
  // consumer yet) ------------------------------------------------------------

  async enrollFromEntitlement(userId: string, courseId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    return db.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { revokedAt: null },
      create: { userId, courseId, source: EnrollmentSource.PURCHASE },
    });
  }

  /** Called by Commerce after an entitlement changes. Another active product
   * grant may still keep the same course available, so revocation is always
   * reconciled against all grants rather than applied blindly. */
  async revokeEnrollment(userId: string, courseId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const active = await this.hasActiveCourseEntitlement(userId, courseId, db);
    if (active) return;
    await db.enrollment.updateMany({ where: { userId, courseId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /**
   * Paid courses worth suggesting to this student, best first, each with the
   * reasons it was picked -- so the dashboard can say why, not just what.
   *
   * Evidence outranks preference: a course covering topics the student got
   * wrong in graded exams (mastery below 60% on at least one answer) scores
   * highest, then one on a subject they are weak in, then one matching the
   * exam and field they are aiming for. Courses the student can already open
   * are never suggested. Popularity only breaks ties; nothing is invented
   * when there is no signal -- the list is simply shorter.
   */
  async recommendCourses(userId: string, limit = 3) {
    const [profile, mastery, courses] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { targetDegree: true, targetField: true } }),
      this.prisma.masteryState.findMany({
        where: { userId, masteryScore: { lt: 0.6 }, evidenceCount: { gte: 1 } },
        select: { topicCode: true, subjectCode: true, masteryScore: true },
      }),
      this.prisma.course.findMany({
        where: { isPublished: true, accessMode: AccessMode.ENTITLEMENT },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          degreeTargets: true,
          fieldTargets: true,
          subject: { select: { code: true, title: true } },
          modules: { select: { lessons: { select: { topics: { select: { topic: { select: { code: true, title: true } } } } } } } },
          _count: { select: { enrollments: true } },
          products: {
            where: { isActive: true },
            select: { slug: true, prices: { where: { isActive: true }, select: { amountRial: true } } },
          },
          productGrants: {
            where: { product: { isActive: true } },
            select: { product: { select: { slug: true, prices: { where: { isActive: true }, select: { amountRial: true } } } } },
          },
        },
      }),
    ]);

    const weakTopics = new Map(mastery.map((state) => [state.topicCode, state.masteryScore]));
    const weakSubjects = new Set(mastery.map((state) => state.subjectCode));
    const scored = [];
    for (const course of courses) {
      if (await this.access.hasActiveCourseAccess(userId, course.id)) continue;
      const reasons: string[] = [];
      let score = 0;
      let basis: "WEAK_TOPICS" | "WEAK_SUBJECT" | "TARGET" | "POPULAR" = "POPULAR";

      const topics = new Map(
        course.modules.flatMap((module) =>
          module.lessons.flatMap((lesson) => lesson.topics.map(({ topic }) => [topic.code, topic.title] as const)),
        ),
      );
      const hits = [...topics].filter(([code]) => weakTopics.has(code));
      if (hits.length > 0) {
        score += 30 * Math.min(3, hits.length);
        basis = "WEAK_TOPICS";
        reasons.push(`${hits.slice(0, 2).map(([, title]) => `«${title}»`).join(" و ")} را درس می‌دهد؛ مبحثی که در آزمون‌هایت کم‌نمره بوده`);
      }
      if (course.subject && weakSubjects.has(course.subject.code)) {
        score += 20;
        if (basis === "POPULAR") basis = "WEAK_SUBJECT";
        if (hits.length === 0) reasons.push(`دورهٔ «${course.subject.title}»، درسی که در آن نتیجه‌ات پایین بوده`);
      }
      const fieldMatch = profile?.targetField ? course.fieldTargets.includes(profile.targetField) : false;
      const degreeMatch = profile?.targetDegree ? course.degreeTargets.includes(profile.targetDegree) : false;
      if (fieldMatch || degreeMatch) {
        score += (fieldMatch ? 10 : 0) + (degreeMatch ? 5 : 0);
        if (basis === "POPULAR") basis = "TARGET";
        reasons.push("متناسب با کنکور و رشته‌ای که هدف گرفته‌ای");
      }
      score += Math.min(course._count.enrollments, 20) * 0.25;

      const prices = [
        ...course.products.flatMap((product) => product.prices.map((price) => ({ ...price, productSlug: product.slug }))),
        ...course.productGrants.flatMap(({ product }) => product.prices.map((price) => ({ ...price, productSlug: product.slug }))),
      ].sort((left, right) => left.amountRial - right.amountRial);
      if (prices.length === 0) continue; // nothing to buy yet

      scored.push({
        course: { slug: course.slug, title: course.title, description: course.description },
        price: { amountRial: prices[0].amountRial, productSlug: prices[0].productSlug },
        reasons,
        basis,
        score,
        students: course._count.enrollments,
      });
    }
    return scored.sort((left, right) => right.score - left.score).slice(0, limit);
  }

  async listMyEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId, revokedAt: null, course: { isPublished: true } },
      include: { course: true },
      orderBy: { enrolledAt: "desc" },
    });
  }

  // --- Gated lesson consumption --------------------------------------------

  async getLesson(userId: string | undefined, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { courseModule: { include: { course: true } }, topics: { include: { topic: true } } },
    });
    if (!lesson) throw new NotFoundException("lesson not found");

    await this.assertLessonAccess(userId, lesson);
    let progress = null;
    if (userId) {
      progress = await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { lastViewedAt: new Date() },
        create: { userId, lessonId },
      });
    }

    return { ...lesson, progress };
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { courseModule: { include: { course: true } } },
    });
    if (!lesson) throw new NotFoundException("lesson not found");
    await this.assertLessonAccess(userId, lesson);

    return this.prisma.$transaction(async (tx) => {
      // Planning uses this same per-user lock before replacing an active plan,
      // so lesson completion and its linked task update cannot be split by a
      // concurrent replan.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const completedAt = new Date();
      const progress = await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { completedAt, lastViewedAt: completedAt },
        create: { userId, lessonId, completedAt, lastViewedAt: completedAt },
      });
      const linkedTasks = await tx.task.updateMany({
        where: {
          lessonId,
          status: { not: "DONE" },
          plan: { userId, status: "ACTIVE" },
        },
        data: { status: "DONE", completedAt },
      });
      return { ...progress, completedPlanTasks: linkedTasks.count };
    }, { timeout: 30_000 });
  }

  /** Activity-based progress only. Completion and last-viewed timestamps are
   * deliberately kept separate from assessment-derived mastery. */
  async getLearningProgress(userId: string) {
    const courses = await this.prisma.course.findMany({
      where: {
        isPublished: true,
        modules: { some: { lessons: { some: { progress: { some: { userId } } } } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                progress: {
                  where: { userId },
                  select: { completedAt: true, lastViewedAt: true },
                },
              },
            },
          },
        },
      },
    });

    return {
      basis: "LESSON_ACTIVITY",
      disclaimer: "پیشرفت مطالعه از مشاهده و تکمیل درس‌ها می‌آید و معادل تسلط علمی نیست.",
      courses: courses.map((course) => {
        const lessons = course.modules.flatMap((module) => module.lessons);
        const viewed = lessons.filter((lesson) => lesson.progress.length > 0);
        const completed = lessons.filter((lesson) => lesson.progress.some((item) => item.completedAt));
        const latestViewed = [...viewed].sort((left, right) =>
          right.progress[0].lastViewedAt.getTime() - left.progress[0].lastViewedAt.getTime(),
        )[0];
        const latestIndex = latestViewed ? lessons.findIndex((lesson) => lesson.id === latestViewed.id) : -1;
        const resumeLesson = latestViewed && !latestViewed.progress[0].completedAt
          ? latestViewed
          : lessons.slice(latestIndex + 1).find((lesson) => !lesson.progress.some((item) => item.completedAt))
            ?? lessons.find((lesson) => !lesson.progress.some((item) => item.completedAt));
        return {
          course: { slug: course.slug, title: course.title },
          completedLessons: completed.length,
          viewedLessons: viewed.length,
          totalLessons: lessons.length,
          progressPercent: lessons.length > 0 ? Math.round(completed.length / lessons.length * 100) : 0,
          resumeLesson: resumeLesson ? { id: resumeLesson.id, title: resumeLesson.title } : null,
          lastViewedAt: latestViewed?.progress[0].lastViewedAt ?? null,
          basis: "LESSON_ACTIVITY",
        };
      }),
    };
  }

  async hasActiveCourseEntitlement(userId: string, courseId: string, tx?: Tx): Promise<boolean> {
    return this.access.hasActiveCourseAccess(userId, courseId, tx);
  }

  private async assertLessonAccess(
    userId: string | undefined,
    lesson: {
      isPreview: boolean;
      courseModule: { courseId: string; course: { accessMode: AccessMode; isPublished: boolean } };
    },
  ) {
    const course = lesson.courseModule.course;
    if (!course.isPublished) throw new NotFoundException("lesson not found");
    const mode = course.accessMode;
    if (lesson.isPreview || mode === AccessMode.PUBLIC) return;
    if (!userId) throw new UnauthorizedException("sign in to access this lesson");
    if (mode === AccessMode.ACCOUNT) return;
    if (!(await this.hasActiveCourseEntitlement(userId, lesson.courseModule.courseId))) {
      throw new ForbiddenException("no active entitlement for this course");
    }
  }
}
