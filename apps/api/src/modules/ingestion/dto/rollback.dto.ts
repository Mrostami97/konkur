import { IsIn, IsInt, IsUUID, Min } from "class-validator";

export class RollbackDto {
  @IsIn(["ARTICLE", "QUESTION", "REPORT_CARD"])
  entityType!: "ARTICLE" | "QUESTION" | "REPORT_CARD";

  @IsUUID()
  entityId!: string;

  @IsInt()
  @Min(1)
  toVersion!: number;
}
