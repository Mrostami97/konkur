import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { AccessModule } from "../access/access.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import {
  CoursesPublicController,
  LearningAdminController,
  LearningStudentController,
  VideoLicenseAdminController,
} from "./learning.controller";
import { LearningService } from "./learning.service";
import { SpotPlayerService } from "./spotplayer.service";
import { VideoUploadService } from "./video-upload.service";

@Module({
  imports: [AuditModule, IdentityModule, AccessModule, IngestionModule],
  controllers: [CoursesPublicController, LearningStudentController, LearningAdminController, VideoLicenseAdminController],
  // SpotPlayer licences are issued by the owner by hand since 2026-10-11;
  // spotplayer.client.ts (the API client) stays for if that changes.
  providers: [LearningService, SpotPlayerService, VideoUploadService],
  exports: [LearningService, SpotPlayerService],
})
export class LearningModule {}
