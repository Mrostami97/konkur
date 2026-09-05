import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EnrollmentSource, Prisma } from "@prisma/client";
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
    return this.prisma.lesson.create({
      data: {
        courseModuleId,
        title: dto.title,
        order: dto.order,
        contentBlocks: dto.contentBlocks as Prisma.InputJsonValue,
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
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true } } },
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
          include: { lessons: { orderBy: { order: "asc" }, select: { id: true, title: true, order: true } } },
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

  async grantManualEnrollment(userId: string, courseId: string) {
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { revokedAt: null },
      create: { userId, courseId, source: EnrollmentSource.MANUAL },
    });
  }

  /** Called by Commerce when it revokes the entitlement backing this course. */
  async revokeEnrollment(userId: string, courseId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    await db.enrollment.updateMany({
      where: { userId, courseId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listMyEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { enrolledAt: "desc" },
    });
  }

  // --- Gated lesson consumption --------------------------------------------

  async getLessonForStudent(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { courseModule: true },
    });
    if (!lesson) throw new NotFoundException("lesson not found");

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseModule.courseId } },
    });
    if (!enrollment || enrollment.revokedAt) throw new ForbiddenException("no active access to this course");

    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { lastViewedAt: new Date() },
      create: { userId, lessonId },
    });

    return lesson;
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { courseModule: true },
    });
    if (!lesson) throw new NotFoundException("lesson not found");

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseModule.courseId } },
    });
    if (!enrollment || enrollment.revokedAt) throw new ForbiddenException("no active access to this course");

    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completedAt: new Date(), lastViewedAt: new Date() },
      create: { userId, lessonId, completedAt: new Date() },
    });
  }
}
