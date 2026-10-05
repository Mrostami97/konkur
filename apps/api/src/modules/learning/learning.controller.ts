import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage, memoryStorage } from "multer";
import { tmpdir } from "os";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { LearningService, MAX_LESSON_VIDEO_BYTES } from "./learning.service";
import { CreateCourseDto, SetCourseMaterialsDto } from "./dto/create-course.dto";
import { CreateModuleDto, ReorderLessonsDto, UpdateModuleDto } from "./dto/create-module.dto";
import { CreateLessonDto, UpdateLessonDto } from "./dto/create-lesson.dto";
import { SpotPlayerService } from "./spotplayer.service";
import { VIDEO_CHUNK_BYTES, VideoUploadService } from "./video-upload.service";
import { StartVideoUploadDto } from "./dto/start-video-upload.dto";

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
  constructor(
    private readonly learning: LearningService,
    private readonly videoUploads: VideoUploadService,
  ) {}

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

  /** The handouts that come with a course, replaced as a whole, in order. */
  @Put("courses/:id/materials")
  setMaterials(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: SetCourseMaterialsDto) {
    return this.learning.setCourseMaterials(req.user!.id, id, dto.resourceIds);
  }

  @Post("courses/:id/unpublish")
  unpublish(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.unpublishCourse(req.user!.id, id);
  }

  @Delete("courses/:id")
  @Roles(Role.ADMIN)
  deleteCourse(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.deleteCourse(req.user!.id, id);
  }

  @Patch("modules/:id")
  updateModule(@Param("id") id: string, @Body() dto: UpdateModuleDto) {
    return this.learning.updateModule(id, dto.title);
  }

  @Delete("modules/:id")
  deleteModule(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.deleteModule(req.user!.id, id);
  }

  @Put("modules/:id/lesson-order")
  reorderLessons(@Param("id") id: string, @Body() dto: ReorderLessonsDto) {
    return this.learning.reorderLessons(id, dto.lessonIds);
  }

  @Get("lessons/:id")
  getLesson(@Param("id") id: string) {
    return this.learning.getLessonForEditing(id);
  }

  @Delete("lessons/:id")
  deleteLesson(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.learning.deleteLesson(req.user!.id, id);
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

  /** A lesson video, written to a temporary file rather than held in memory. */
  @Post("lesson-videos")
  @UseInterceptors(FileInterceptor("file", { storage: diskStorage({ destination: tmpdir() }), limits: { fileSize: MAX_LESSON_VIDEO_BYTES } }))
  uploadLessonVideo(@Req() req: RequestWithUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.learning.uploadLessonVideo(req.user!.id, file);
  }

  /** A lesson video in pieces (see VideoUploadService): start, send each piece, complete, then poll. */
  @Post("lesson-videos/uploads")
  startVideoUpload(@Req() req: RequestWithUser, @Body() dto: StartVideoUploadDto) {
    return this.videoUploads.start(req.user!.id, dto.size);
  }

  @Put("lesson-videos/uploads/:id/chunks/:index")
  @UseInterceptors(FileInterceptor("chunk", { storage: memoryStorage(), limits: { fileSize: VIDEO_CHUNK_BYTES } }))
  putVideoChunk(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Param("index", ParseIntPipe) index: number,
    @UploadedFile() chunk: Express.Multer.File | undefined,
  ) {
    return this.videoUploads.putChunk(req.user!.id, id, index, chunk?.buffer);
  }

  @Post("lesson-videos/uploads/:id/complete")
  completeVideoUpload(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.videoUploads.complete(req.user!.id, id);
  }

  @Get("lesson-videos/uploads/:id")
  videoUploadStatus(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.videoUploads.status(req.user!.id, id);
  }

}
