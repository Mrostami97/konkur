import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import {
  AdmissionsAdminController,
  AdmissionsPublicController,
  ChoiceListController,
} from "./admissions.controller";
import { AdmissionsService } from "./admissions.service";

@Module({
  imports: [IdentityModule, AnalyticsModule],
  controllers: [AdmissionsPublicController, AdmissionsAdminController, ChoiceListController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}
