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
import {
  CoachStudentsController,
  CoachWeeklyReportsController,
  StudentCoachPlansController,
  StudentWeeklyReportsController,
} from "./coach-plans.controller";
import { WeeklyReportsService } from "./weekly-reports.service";
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
    StudentWeeklyReportsController,
    CoachWeeklyReportsController,
  ],
  providers: [InstructorsService, ConsultationsService, CoachPlansService, WeeklyReportsService],
  exports: [InstructorsService, ConsultationsService],
})
export class InstructorsModule {}
