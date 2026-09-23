import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { AchievementsAdminController, AchievementsPublicController } from "./achievements.controller";
import { AchievementsService } from "./achievements.service";

@Module({
  imports: [AuditModule, IdentityModule, IngestionModule],
  controllers: [AchievementsPublicController, AchievementsAdminController],
  providers: [AchievementsService],
})
export class AchievementsModule {}
