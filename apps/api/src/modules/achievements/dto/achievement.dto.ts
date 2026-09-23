import { Degree } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class AchievementDto {
  /** As the student agreed to be named -- full name, or first name and
   * initial. */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsOptional()
  @IsUUID()
  photoArtifactId?: string;

  /** Solar year of the exam, e.g. 1404. */
  @IsInt()
  @Min(1380)
  @Max(1500)
  examYear!: number;

  @IsEnum(Degree)
  degree!: Degree;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  field!: string;

  @IsInt()
  @Min(1)
  rank!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  rankLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  acceptedUniversity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  acceptedProgram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  quote?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectSlugs?: string[];

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  sourceUrl?: string;

  /** Required before `isPublished` can be true -- enforced here, in the
   * service, and by a database CHECK. */
  @IsOptional()
  @IsISO8601()
  consentConfirmedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  consentNote?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
