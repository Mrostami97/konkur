import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AnalyticsAdminController, RankEstimateController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [IdentityModule],
  controllers: [RankEstimateController, AnalyticsAdminController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
