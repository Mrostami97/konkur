import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpsertGoalDto {
  @IsIn(["MASTER", "PHD"])
  degree!: "MASTER" | "PHD";

  @IsString()
  @MinLength(1)
  field!: string;

  @IsOptional()
  @IsISO8601()
  targetExamDate?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weeklyHours!: number;

  @IsOptional()
  @IsIn(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
  selfReportedLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}
