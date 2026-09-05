import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { ContentRollbackController, IngestionController } from "./ingestion.controller";
import { IngestionService } from "./ingestion.service";
import { MediaController } from "./media.controller";
import { ObjectStorageService } from "./object-storage.service";

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [IngestionController, ContentRollbackController, MediaController],
  providers: [IngestionService, ObjectStorageService],
  exports: [IngestionService, ObjectStorageService],
})
export class IngestionModule {}
