import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuditModule } from "./modules/audit/audit.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { ContentModule } from "./modules/content/content.module";
import { LearningModule } from "./modules/learning/learning.module";
import { CommerceModule } from "./modules/commerce/commerce.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    IdentityModule,
    ContentModule,
    LearningModule,
    CommerceModule,
  ],
})
export class AppModule {}
