import { Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { LearningService } from "./learning.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { CreateModuleDto } from "./dto/create-module.dto";
import { CreateLessonDto, UpdateLessonDto } from "./dto/create-lesson.dto";
import { SpotPlayerService } from "./spotplayer.service";

@Controller("courses")
export class CoursesPublicController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  list() {
    return this.learning.listPublishedCourses();
  }

  @Get(":slug")
  getSyllabus(@Param("slug") slug: string) {
    return this.learning.getCourseSyllabus(slug);
  }
}

@Controller()
export class LearningStudentController {
  constructor(
    private readonly learning: LearningService,
    private readonly spotPlayer: SpotPlayerService,
  ) {}

  @Get("me/enrollments")
  @UseGuards(SessionAuthGuard)
  myEnrollments(@Req() req: RequestWithUser) {
    return this.learning.listMyEnrollments(req.user!.id);
  }

  @Get("me/recommendations/courses")
  @UseGuards(SessionAuthGuard)
  recommendations(@Req() req: RequestWithUser) {
    return this.learning.recommendCourses(req.user!.id);
  }

  @Get("me/learning-progress")
  @UseGuards(SessionAuthGuard)
  learningProgress(@Req() req: RequestWithUser) {
    return this.learning.getLearningProgress(req.user!.id);
  }

  @Get("lessons/:id")
  @UseGuards(OptionalSessionAuthGuard)
  getLesson(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.getLesson(req.user?.id, id);
  }

  @Post("lessons/:id/complete")
  @UseGuards(SessionAuthGuard)
  completeLesson(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.completeLesson(req.user!.id, id);
  }

  /** Whether this course has video and whether the integration is switched
   * on. Readable without a licence so the course page can say which it is. */
  @Get("courses/:courseId/video")
  @UseGuards(SessionAuthGuard)
  videoStatus(@Param("courseId") courseId: string) {
    return this.spotPlayer.videoStatus(courseId);
  }

  /** The student's own SpotPlayer licence, issued on first ask. Entitlement
   * is rechecked every time, not only at issuance. */
  @Post("courses/:courseId/video-license")
  @UseGuards(SessionAuthGuard)
  videoLicense(@Param("courseId") courseId: string, @Req() req: RequestWithUser) {
    return this.spotPlayer.getOrIssueLicense(req.user!.id, courseId);
  }
}

@Controller("admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.AUTHOR, Role.ADMIN)
export class LearningAdminController {
  constructor(private readonly learning: LearningService) {}

  @Get("courses")
  listAll() {
    return this.learning.listAllCourses();
  }

  @Post("courses")
  createCourse(@Req() req: RequestWithUser, @Body() dto: CreateCourseDto) {
    return this.learning.createCourse(req.user!.id, dto);
  }

  @Patch("courses/:id")
  updateCourse(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: CreateCourseDto) {
    return this.learning.updateCourse(req.user!.id, id, dto);
  }

  @Post("courses/:id/publish")
  publish(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.publishCourse(id, req.user!.id);
  }

  @Post("courses/:id/modules")
  addModule(@Param("id") id: string, @Body() dto: CreateModuleDto) {
    return this.learning.addModule(id, dto);
  }

  @Post("modules/:id/lessons")
  addLesson(@Param("id") id: string, @Body() dto: CreateLessonDto) {
    return this.learning.addLesson(id, dto);
  }

  @Get("lessons/:id")
  getLesson(@Param("id") id: string) {
    return this.learning.getLessonForEditing(id);
  }

  @Patch("lessons/:id")
  updateLesson(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: UpdateLessonDto) {
    return this.learning.updateLesson(req.user!.id, id, dto);
  }

  @Post("lesson-images")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadLessonImage(@Req() req: RequestWithUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.learning.uploadLessonImage(req.user!.id, file);
  }

}
