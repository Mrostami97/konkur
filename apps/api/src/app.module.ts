import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
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
import { CrmModule } from "./modules/crm/crm.module";

@Module({
  imports: [
    // doc §9: "محدودیت تلاش" (attempt limiting) -- a global default rate
    // limit; auth endpoints tighten this further with @Throttle() overrides.
    // Skipped under Jest (NODE_ENV=test): the e2e suite creates many
    // students in quick succession from one "IP", which would otherwise
    // trip the OTP-specific limit and fail tests that have nothing to do
    // with rate limiting itself.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 60 }],
      skipIf: () => process.env.NODE_ENV === "test",
    }),
    ScheduleModule.forRoot(),
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
    CrmModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
