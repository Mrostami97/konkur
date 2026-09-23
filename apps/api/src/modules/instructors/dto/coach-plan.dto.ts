import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

/** A calendar date, e.g. 2026-09-26 (Gregorian; the panel shows it in the
 * solar calendar). */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A path on this site. Absolute URLs are refused, so a plan can never send a
 * student to an outside page dressed up as a task. */
const INTERNAL_PATH = /^\/(?!\/)\S{0,300}$/;

export const COACH_TASK_KINDS = ["STUDY", "TEST", "REVIEW", "VIDEO", "EXAM", "OTHER"] as const;

export class CoachPlanItemDto {
  /** Present when editing an existing task, so its completion is kept. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @Matches(DATE, { message: "day must be a YYYY-MM-DD date" })
  day!: string;

  @IsIn(COACH_TASK_KINDS)
  kind!: (typeof COACH_TASK_KINDS)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]{2,60}$/)
  subjectSlug?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(900)
  targetMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  targetCount?: number;

  @IsOptional()
  @Matches(INTERNAL_PATH, { message: "href must be a path on this site" })
  href?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CoachPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @Matches(DATE, { message: "startsOn must be a YYYY-MM-DD date" })
  startsOn!: string;

  @Matches(DATE, { message: "endsOn must be a YYYY-MM-DD date" })
  endsOn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMaxSize(150)
  @ValidateNested({ each: true })
  @Type(() => CoachPlanItemDto)
  items!: CoachPlanItemDto[];
}

export class CompleteCoachItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  actualMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  studentNote?: string;
}
