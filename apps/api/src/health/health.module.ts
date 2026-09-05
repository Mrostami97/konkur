import { Module } from "@nestjs/common";
import { IngestionModule } from "../modules/ingestion/ingestion.module";
import { HealthController } from "./health.controller";
import { HealthzController } from "./healthz.controller";

@Module({
  imports: [IngestionModule],
  controllers: [HealthController, HealthzController],
})
export class HealthModule {}
