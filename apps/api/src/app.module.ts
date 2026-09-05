import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuditModule } from "./modules/audit/audit.module";
import { IdentityModule } from "./modules/identity/identity.module";

@Module({
  imports: [PrismaModule, HealthModule, AuditModule, IdentityModule],
})
export class AppModule {}
