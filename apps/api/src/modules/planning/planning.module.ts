import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { LearningModule } from "../learning/learning.module";
import { AccessModule } from "../access/access.module";
import { PlanningController } from "./planning.controller";
import { PlanningService } from "./planning.service";

@Module({
  imports: [IdentityModule, LearningModule, AccessModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
