import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuditModule } from "./modules/audit/audit.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { ContentModule } from "./modules/content/content.module";
import { LearningModule } from "./modules/learning/learning.module";
import { CommerceModule } from "./modules/commerce/commerce.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { TaxonomyModule } from "./modules/taxonomy/taxonomy.module";
import { QuestionBankModule } from "./modules/question-bank/question-bank.module";
import { AssessmentModule } from "./modules/assessment/assessment.module";
import { PlanningModule } from "./modules/planning/planning.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AdmissionsModule } from "./modules/admissions/admissions.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    IdentityModule,
    ContentModule,
    LearningModule,
    CommerceModule,
    IngestionModule,
    TaxonomyModule,
    QuestionBankModule,
    AssessmentModule,
    PlanningModule,
    AnalyticsModule,
    AdmissionsModule,
  ],
})
export class AppModule {}
