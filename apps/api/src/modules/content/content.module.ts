import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { ArticlesAdminController, ArticlesPublicController } from "./content.controller";
import { ContentService } from "./content.service";

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [ArticlesPublicController, ArticlesAdminController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
