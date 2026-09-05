import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { SessionAuthGuard, RequestWithUser } from "../identity/guards/session-auth.guard";
import { RolesGuard } from "../identity/guards/roles.guard";
import { Roles } from "../identity/guards/roles.decorator";
import { AnalyticsService } from "./analytics.service";
import { EstimateRankDto } from "./dto/estimate-rank.dto";

@Controller("me/rank-estimates")
@UseGuards(SessionAuthGuard)
export class RankEstimateController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  estimate(@Req() req: RequestWithUser, @Body() dto: EstimateRankDto) {
    return this.analytics.estimateRank(req.user!.id, dto);
  }

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.analytics.listMyEstimates(req.user!.id);
  }

  @Get("latest")
  latest(@Req() req: RequestWithUser) {
    return this.analytics.getLatestEstimate(req.user!.id);
  }

  @Get("programs/:programId/acceptance-chance")
  acceptanceChance(@Param("programId") programId: string, @Req() req: RequestWithUser) {
    return this.analytics.getAcceptanceChance(req.user!.id, programId);
  }
}

@Controller("admin/analytics")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("backtest")
  runBacktest() {
    return this.analytics.runBacktest();
  }

  @Get("backtests")
  listBacktests() {
    return this.analytics.listBacktests();
  }
}
