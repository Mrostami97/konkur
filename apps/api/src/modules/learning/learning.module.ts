import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { AccessModule } from "../access/access.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import {
  CoursesPublicController,
  LearningAdminController,
  LearningStudentController,
} from "./learning.controller";
import { LearningService } from "./learning.service";
import { SpotPlayerService } from "./spotplayer.service";
import { HttpSpotPlayerClient, SPOTPLAYER_CLIENT } from "./spotplayer.client";

@Module({
  imports: [AuditModule, IdentityModule, AccessModule, IngestionModule],
  controllers: [CoursesPublicController, LearningStudentController, LearningAdminController],
  providers: [
    LearningService,
    SpotPlayerService,
    // Only the real client is registered. There is deliberately no stub that
    // invents a licence key: it would hand a paying student a key that opens
    // nothing, and they would find out after paying. With no API key set,
    // this one reports `configured: false` and refuses, which the UI shows as
    // "video is not set up yet".
    { provide: SPOTPLAYER_CLIENT, useClass: HttpSpotPlayerClient },
  ],
  exports: [LearningService, SpotPlayerService],
})
export class LearningModule {}
