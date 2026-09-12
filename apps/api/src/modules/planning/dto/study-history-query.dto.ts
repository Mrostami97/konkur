import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class StudyHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(["all", "sessions", "plans"])
  section: "all" | "sessions" | "plans" = "all";

  @IsOptional()
  @IsString()
  @MaxLength(512)
  sessionsCursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  plansCursor?: string;
}
