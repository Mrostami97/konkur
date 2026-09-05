import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AssessmentService } from "./assessment.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { AddExamItemDto } from "./dto/add-exam-item.dto";
import { SaveAnswerDto } from "./dto/save-answer.dto";

@Controller("exams")
export class ExamsPublicController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get()
  list() {
    return this.assessment.listPublishedExams();
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.assessment.getExamBySlug(slug);
  }
}

@Controller()
@UseGuards(SessionAuthGuard)
export class AssessmentStudentController {
  constructor(private readonly assessment: AssessmentService) {}

  @Post("exams/:examId/start")
  start(@Param("examId") examId: string, @Req() req: RequestWithUser) {
    return this.assessment.startAttempt(examId, req.user!.id);
  }

  @Get("attempts/:id")
  getAttempt(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.getAttempt(id, req.user!.id);
  }

  @Put("attempts/:id/answers/:questionId")
  saveAnswer(
    @Param("id") id: string,
    @Param("questionId") questionId: string,
    @Req() req: RequestWithUser,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.assessment.saveAnswer(id, req.user!.id, questionId, dto.selectedOption);
  }

  @Post("attempts/:id/submit")
  submit(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.submitAttempt(id, req.user!.id);
  }

  @Get("attempts/:id/report")
  report(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.getReport(id, req.user!.id);
  }
}

@Controller("admin/exams")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.AUTHOR, Role.ADMIN)
export class AssessmentAdminController {
  constructor(private readonly assessment: AssessmentService) {}

  @Get()
  listAll() {
    return this.assessment.listAllExams();
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateExamDto) {
    return this.assessment.createExam(req.user!.id, dto);
  }

  @Post(":id/items")
  addItem(@Param("id") id: string, @Body() dto: AddExamItemDto) {
    return this.assessment.addExamItem(id, dto);
  }

  @Post(":id/publish")
  publish(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.publishExam(id, req.user!.id);
  }

  @Get(":id/psychometrics")
  psychometrics(@Param("id") id: string) {
    return this.assessment.getPsychometrics(id);
  }
}
