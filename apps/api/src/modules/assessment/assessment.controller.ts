import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AssessmentService } from "./assessment.service";
import { CreateExamDto } from "./dto/create-exam.dto";
import { AddExamItemDto } from "./dto/add-exam-item.dto";
import { SaveAnswerDto } from "./dto/save-answer.dto";
import { ActivityDto } from "./dto/activity.dto";
import { CreateSimulatorDto } from "./dto/create-simulator.dto";
import { CreateMockDto } from "./dto/create-mock.dto";

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

  @Get("me/attempts")
  myAttempts(@Req() req: RequestWithUser) {
    return this.assessment.listMyAttempts(req.user!.id);
  }

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

  /** Time spent per question and review flags, sent in small batches while the exam runs. */
  @Post("attempts/:id/activity")
  activity(@Param("id") id: string, @Req() req: RequestWithUser, @Body() dto: ActivityDto) {
    return this.assessment.recordActivity(id, req.user!.id, dto.entries);
  }

  @Post("attempts/:id/submit")
  submit(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.submitAttempt(id, req.user!.id);
  }

  @Get("attempts/:id/standing")
  standing(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.getStanding(id, req.user!.id);
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

  /** Build the simulator of every exam year with reviewed questions; none is published. */
  @Post("simulators/all")
  createAllSimulators(@Req() req: RequestWithUser) {
    return this.assessment.createAllSimulators(req.user!.id);
  }

  /** A new 1406-style mock of one track, drawn from the bank; unpublished. */
  @Post("mock-1406")
  createMock1406(@Req() req: RequestWithUser, @Body() dto: CreateMockDto) {
    return this.assessment.createMock1406(req.user!.id, dto.track);
  }

  /** Build (or rebuild, while nobody has sat it) the simulator of one real exam year. */
  @Post("simulators")
  createSimulator(@Req() req: RequestWithUser, @Body() dto: CreateSimulatorDto) {
    return this.assessment.createSimulator(req.user!.id, dto.examCode, dto.examYear, dto.durationMinutes);
  }

  @Post(":id/items")
  addItem(@Param("id") id: string, @Body() dto: AddExamItemDto) {
    return this.assessment.addExamItem(id, dto);
  }

  @Post(":id/publish")
  publish(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.publishExam(id, req.user!.id);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.assessment.getExamForAdmin(id);
  }

  @Post(":id/unpublish")
  unpublish(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.unpublishExam(req.user!.id, id);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  remove(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.assessment.deleteExam(req.user!.id, id);
  }

  @Delete(":id/items/:itemId")
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string, @Req() req: RequestWithUser) {
    return this.assessment.removeExamItem(req.user!.id, id, itemId);
  }

  @Get(":id/psychometrics")
  psychometrics(@Param("id") id: string) {
    return this.assessment.getPsychometrics(id);
  }
}
