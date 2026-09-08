import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { ArticlesAdminController, ArticlesPublicController } from "./content.controller";
import { ContentService } from "./content.service";
import { IngestionModule } from "../ingestion/ingestion.module";
import { EditorialAdminController, ResourcesPublicController } from "./editorial.controller";
import { EditorialService } from "./editorial.service";
import {
  ContentDiscoveryController,
  ContributorsPublicController,
  ReportCardsPublicController,
} from "./content-discovery.controller";
import { ContentDiscoveryService } from "./content-discovery.service";

@Module({
  imports: [AuditModule, IdentityModule, IngestionModule],
  controllers: [
    ArticlesPublicController,
    ArticlesAdminController,
    ResourcesPublicController,
    EditorialAdminController,
    ContentDiscoveryController,
    ContributorsPublicController,
    ReportCardsPublicController,
  ],
  providers: [ContentService, EditorialService, ContentDiscoveryService],
  exports: [ContentService, EditorialService, ContentDiscoveryService],
})
export class ContentModule {}
