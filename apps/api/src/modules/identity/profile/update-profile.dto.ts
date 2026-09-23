import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export const EDUCATION_STATUSES = [
  "BACHELOR_STUDENT",
  "BACHELOR_GRADUATE",
  "MASTER_STUDENT",
  "MASTER_GRADUATE",
  "OTHER",
] as const;

/** Letters of any script, spaces, the zero-width non-joiner, hyphen and
 * apostrophe -- enough for Persian and Latin names, nothing that could carry
 * markup or a number where a name belongs. */
const PERSON_NAME = /^[\p{L}\p{M}\s‌'-]+$/u;

/**
 * Every field is optional: PATCH changes only what is sent. `null` clears an
 * optional field (the grade average, graduation year); the required ones are
 * enforced by the completeness check, not by rejecting a partial save, so the
 * onboarding wizard can save one step at a time.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(PERSON_NAME, { message: "firstName may contain letters only" })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(PERSON_NAME, { message: "lastName may contain letters only" })
  lastName?: string;

  @IsOptional()
  @IsIn(EDUCATION_STATUSES)
  educationStatus?: (typeof EDUCATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  universityName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fieldOfStudy?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1350)
  @Max(1450)
  entryYear?: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1350)
  @Max(1460)
  graduationYear?: number | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  gpa?: number | null;

  @IsOptional()
  @IsIn(["MASTER", "PHD"])
  targetDegree?: "MASTER" | "PHD";

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetField?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1400)
  @Max(1460)
  targetExamYear?: number | null;
}
