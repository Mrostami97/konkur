import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { OptionalSessionAuthGuard } from "../identity/guards/optional-session-auth.guard";
import { LearningService } from "./learning.service";
import { CreateCourseDto } from "./dto/create-course.dto";
import { CreateModuleDto } from "./dto/create-module.dto";
import { CreateLessonDto } from "./dto/create-lesson.dto";

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
  constructor(private readonly learning: LearningService) {}

  @Get("me/enrollments")
  @UseGuards(SessionAuthGuard)
  myEnrollments(@Req() req: RequestWithUser) {
    return this.learning.listMyEnrollments(req.user!.id);
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

}
