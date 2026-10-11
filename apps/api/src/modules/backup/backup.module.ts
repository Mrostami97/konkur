import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";

@Module({
  imports: [AuditModule, IdentityModule, IngestionModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
