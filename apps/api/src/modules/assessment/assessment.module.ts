import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import {
  AssessmentAdminController,
  AssessmentStudentController,
  ExamsPublicController,
  PracticeController,
} from "./assessment.controller";
import { AssessmentService } from "./assessment.service";
import { PracticeService } from "./practice.service";

@Module({
  imports: [AccessModule, AuditModule, IdentityModule],
  controllers: [ExamsPublicController, AssessmentStudentController, PracticeController, AssessmentAdminController],
  providers: [AssessmentService, PracticeService],
})
export class AssessmentModule {}
