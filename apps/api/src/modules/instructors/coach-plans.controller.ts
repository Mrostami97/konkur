import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { RequestWithUser, SessionAuthGuard } from "../identity/guards/session-auth.guard";
import { CoachPlansService } from "./coach-plans.service";
import { CoachPlanDto, CompleteCoachItemDto } from "./dto/coach-plan.dto";
import { ReviewWeeklyReportDto, SaveWeeklyReportDto } from "./dto/weekly-report.dto";
import { WeeklyReportsService } from "./weekly-reports.service";

/**
 * A consultant's view of the students they advise and the plans they write
 * for them. Session only, like the rest of /me/instructor: the scope comes
 * from the account's linked instructor profile and its bookings.
 */
@Controller("me/instructor")
@UseGuards(SessionAuthGuard)
export class CoachStudentsController {
  constructor(private readonly plans: CoachPlansService) {}

  @Get("students")
  students(@Req() req: RequestWithUser) {
    return this.plans.listStudents(req.user!.id);
  }

  @Get("students/:studentId")
  student(@Req() req: RequestWithUser, @Param("studentId") studentId: string) {
    return this.plans.getStudent(req.user!.id, studentId);
  }

  @Post("students/:studentId/plans")
  create(@Req() req: RequestWithUser, @Param("studentId") studentId: string, @Body() dto: CoachPlanDto) {
    return this.plans.createPlan(req.user!.id, studentId, dto);
  }

  @Put("plans/:planId")
  update(@Req() req: RequestWithUser, @Param("planId") planId: string, @Body() dto: CoachPlanDto) {
    return this.plans.updatePlan(req.user!.id, planId, dto);
  }

  @Post("plans/:planId/publish")
  publish(@Req() req: RequestWithUser, @Param("planId") planId: string) {
    return this.plans.setStatus(req.user!.id, planId, "PUBLISHED");
  }

  @Post("plans/:planId/archive")
  archive(@Req() req: RequestWithUser, @Param("planId") planId: string) {
    return this.plans.setStatus(req.user!.id, planId, "ARCHIVED");
  }

  @Delete("plans/:planId")
  remove(@Req() req: RequestWithUser, @Param("planId") planId: string) {
    return this.plans.deleteDraft(req.user!.id, planId);
  }
}

/** The student's side: the plans their consultant published for them. */
@Controller("me/coach-plans")
@UseGuards(SessionAuthGuard)
export class StudentCoachPlansController {
  constructor(private readonly plans: CoachPlansService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.plans.listForStudent(req.user!.id);
  }

  @Post("items/:itemId/complete")
  complete(@Req() req: RequestWithUser, @Param("itemId") itemId: string, @Body() dto: CompleteCoachItemDto) {
    return this.plans.completeItem(req.user!.id, itemId, dto);
  }

  @Post("items/:itemId/reopen")
  reopen(@Req() req: RequestWithUser, @Param("itemId") itemId: string) {
    return this.plans.reopenItem(req.user!.id, itemId);
  }
}

/** The student's weekly report, written before each weekly consultation session. */
@Controller("me/weekly-reports")
@UseGuards(SessionAuthGuard)
export class StudentWeeklyReportsController {
  constructor(private readonly reports: WeeklyReportsService) {}

  @Get()
  mine(@Req() req: RequestWithUser) {
    return this.reports.mine(req.user!.id);
  }

  @Put("current")
  save(@Req() req: RequestWithUser, @Body() dto: SaveWeeklyReportDto) {
    return this.reports.saveCurrent(req.user!.id, dto);
  }
}

/** A consultant reading and answering the weekly reports of their students. */
@Controller("me/instructor")
@UseGuards(SessionAuthGuard)
export class CoachWeeklyReportsController {
  constructor(private readonly reports: WeeklyReportsService) {}

  @Get("students/:studentId/weekly-reports")
  list(@Req() req: RequestWithUser, @Param("studentId") studentId: string) {
    return this.reports.forCoach(req.user!.id, studentId);
  }

  @Put("weekly-reports/:reportId/review")
  review(@Req() req: RequestWithUser, @Param("reportId") reportId: string, @Body() dto: ReviewWeeklyReportDto) {
    return this.reports.review(req.user!.id, reportId, dto);
  }
}
