import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AuditModule } from "../audit/audit.module";
import { AccessModule } from "../access/access.module";
import {
  InstructorSelfController,
  InstructorsAdminController,
  InstructorsPublicController,
} from "./instructors.controller";
import {
  ConsultationsAdminController,
  ConsultationsInstructorController,
  ConsultationsPublicController,
  ConsultationsStudentController,
} from "./consultations.controller";
import { InstructorsService } from "./instructors.service";
import { CoachStudentsController, StudentCoachPlansController } from "./coach-plans.controller";
import { CoachPlansService } from "./coach-plans.service";
import { ConsultationsService } from "./consultations.service";

@Module({
  imports: [IdentityModule, AuditModule, AccessModule],
  controllers: [
    InstructorsPublicController,
    InstructorSelfController,
    InstructorsAdminController,
    ConsultationsPublicController,
    ConsultationsStudentController,
    ConsultationsInstructorController,
    ConsultationsAdminController,
    CoachStudentsController,
    StudentCoachPlansController,
  ],
  providers: [InstructorsService, ConsultationsService, CoachPlansService],
  exports: [InstructorsService, ConsultationsService],
})
export class InstructorsModule {}
