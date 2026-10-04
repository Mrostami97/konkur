import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from "class-validator";

export class ActivityEntryDto {
  @IsUUID()
  questionId!: string;

  /** Milliseconds spent on this question since the previous report. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60 * 1000)
  timeSpentMs?: number;

  @IsOptional()
  @IsBoolean()
  flagged?: boolean;
}

export class ActivityDto {
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ActivityEntryDto)
  entries!: ActivityEntryDto[];
}
