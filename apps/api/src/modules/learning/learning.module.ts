import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import { AccessModule } from "../access/access.module";
import {
  CoursesPublicController,
  LearningAdminController,
  LearningStudentController,
} from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({
  imports: [AuditModule, IdentityModule, AccessModule],
  controllers: [CoursesPublicController, LearningStudentController, LearningAdminController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
