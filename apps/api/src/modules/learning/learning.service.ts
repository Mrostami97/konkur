import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AccessMode, EnrollmentSource, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LESSON_BLOCK_TYPES, assertValidContentBlocks } from "../../common/content-blocks";
import { CreateCourseDto } from "./dto/create-course.dto";
import { CreateModuleDto } from "./dto/create-module.dto";
import { CreateLessonDto } from "./dto/create-lesson.dto";

type Tx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
    const { topicIds = [], ...lessonInput } = dto;
    return this.prisma.lesson.create({
      data: {
        courseModuleId,
        title: lessonInput.title,
        order: lessonInput.order,
        contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
        isPreview: lessonInput.isPreview ?? false,
        topics: topicIds.length > 0 ? { create: topicIds.map((topicId) => ({ topicId })) } : undefined,
      },
    });
  }

  // --- Public catalog -----------------------------------------------------

  async listPublishedCourses() {
    return this.prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getCourseSyllabus(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
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
    if (!course || !course.isPublished) throw new NotFoundException("course not found");
    return course;
  }

  async listAllCourses() {
    return this.prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
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
    if (userId) {
      await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: { lastViewedAt: new Date() },
        create: { userId, lessonId },
      });
    }

    return lesson;
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { courseModule: { include: { course: true } } },
    });
    if (!lesson) throw new NotFoundException("lesson not found");
    await this.assertLessonAccess(userId, lesson);

    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completedAt: new Date(), lastViewedAt: new Date() },
      create: { userId, lessonId, completedAt: new Date() },
    });
  }

  async hasActiveCourseEntitlement(userId: string, courseId: string, tx?: Tx): Promise<boolean> {
    const db = tx ?? this.prisma;
    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: {
        userId,
        startAt: { lte: now },
        revokedAt: null,
        OR: [{ endAt: null }, { endAt: { gt: now } }],
        product: {
          OR: [{ courseId }, { courseGrants: { some: { courseId } } }],
        },
      },
      select: { id: true },
    });
    return Boolean(entitlement);
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
