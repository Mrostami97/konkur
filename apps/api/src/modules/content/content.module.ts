import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { AccessModule } from "../access/access.module";
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
import { GuideReviewsAdminController, GuideReviewsPublicController } from "./guide-review.controller";

@Module({
  imports: [AuditModule, IdentityModule, IngestionModule, AccessModule],
  controllers: [
    ArticlesPublicController,
    ArticlesAdminController,
    ResourcesPublicController,
    EditorialAdminController,
    ContentDiscoveryController,
    ContributorsPublicController,
    ReportCardsPublicController,
    GuideReviewsPublicController,
    GuideReviewsAdminController,
  ],
  providers: [ContentService, EditorialService, ContentDiscoveryService],
  exports: [ContentService, EditorialService, ContentDiscoveryService],
})
export class ContentModule {}
