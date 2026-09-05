import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IdentityModule } from "../identity/identity.module";
import {
  AssessmentAdminController,
  AssessmentStudentController,
  ExamsPublicController,
} from "./assessment.controller";
import { AssessmentService } from "./assessment.service";

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [ExamsPublicController, AssessmentStudentController, AssessmentAdminController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
