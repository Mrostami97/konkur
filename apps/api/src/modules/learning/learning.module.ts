import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import {
  CoursesPublicController,
  LearningAdminController,
  LearningStudentController,
} from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [CoursesPublicController, LearningStudentController, LearningAdminController],
  providers: [LearningService],
  exports: [LearningService],
})
export class LearningModule {}
