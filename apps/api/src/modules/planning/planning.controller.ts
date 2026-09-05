import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { PlanningService } from "./planning.service";
import { UpsertGoalDto } from "./dto/upsert-goal.dto";
import { LogStudySessionDto } from "./dto/log-study-session.dto";

class ReplanDto {
  @IsOptional()
  @IsIn(["FALLING_BEHIND", "MANUAL_REQUEST", "GOAL_CHANGED"])
  reasonCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller("me")
@UseGuards(SessionAuthGuard)
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get("goal")
  getGoal(@Req() req: RequestWithUser) {
    return this.planning.getGoal(req.user!.id);
  }

  @Put("goal")
  upsertGoal(@Req() req: RequestWithUser, @Body() dto: UpsertGoalDto) {
    return this.planning.upsertGoal(req.user!.id, dto);
  }

  @Post("plan/replan")
  replan(@Req() req: RequestWithUser, @Body() dto: ReplanDto) {
    return this.planning.replan(req.user!.id, dto.reasonCode, dto.note);
  }

  @Get("plan")
  getPlan(@Req() req: RequestWithUser) {
    return this.planning.getPlan(req.user!.id);
  }

  @Get("plan/today")
  getToday(@Req() req: RequestWithUser) {
    return this.planning.getToday(req.user!.id);
  }

  @Get("plan/revisions")
  getRevisions(@Req() req: RequestWithUser) {
    return this.planning.getPlanRevisions(req.user!.id);
  }

  @Post("plan/tasks/:taskId/complete")
  completeTask(@Param("taskId") taskId: string, @Req() req: RequestWithUser) {
    return this.planning.completeTask(taskId, req.user!.id);
  }

  @Get("mastery")
  getMastery(@Req() req: RequestWithUser) {
    return this.planning.getMasteryMap(req.user!.id);
  }

  @Post("study-sessions")
  logStudySession(@Req() req: RequestWithUser, @Body() dto: LogStudySessionDto) {
    return this.planning.logStudySession(req.user!.id, dto);
  }
}
