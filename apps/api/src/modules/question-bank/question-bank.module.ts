import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { QuestionsAdminController, QuestionsPublicController } from "./question-bank.controller";
import { QuestionBankService } from "./question-bank.service";

@Module({
  imports: [IdentityModule, IngestionModule],
  controllers: [QuestionsPublicController, QuestionsAdminController],
  providers: [QuestionBankService],
})
export class QuestionBankModule {}
