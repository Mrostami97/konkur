import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { AccessModule } from "../access/access.module";
import { AuditModule } from "../audit/audit.module";
import { QuestionsAdminController, QuestionsPublicController } from "./question-bank.controller";
import { QuestionBankService } from "./question-bank.service";
import { PracticeService } from "./practice.service";
import { PersonalExamService } from "./personal-exam.service";

@Module({
  imports: [IdentityModule, IngestionModule, AccessModule, AuditModule],
  controllers: [QuestionsPublicController, QuestionsAdminController],
  providers: [QuestionBankService, PracticeService, PersonalExamService],
})
export class QuestionBankModule {}
