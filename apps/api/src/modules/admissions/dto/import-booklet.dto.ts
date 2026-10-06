import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export const STUDY_PERIODS = [
  "DAILY",
  "EVENING",
  "SELF_FUNDED_CAMPUS",
  "VIRTUAL",
  "NON_PROFIT",
  "VIRTUAL_NON_PROFIT",
  "PAYAM_NOOR",
  "VIRTUAL_PAYAM_NOOR",
] as const;

/** One کد رشته‌محل of a field-selection booklet. */
export class BookletRowDto {
  @Matches(/^\d{4,6}$/)
  selectionCode!: string;

  @Matches(/^\d{4}$/)
  examSetCode!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  coefficientGroup!: number;

  @IsIn(STUDY_PERIODS)
  period!: (typeof STUDY_PERIODS)[number];

  /** The institution, without campus or city: «دانشگاه تهران». */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  university!: string;

  /** The institution's own city. */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  universityCity!: string;

  /** Where classes are held when the booklet names a campus: «پردیس فارابی قم». */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  /**
   * What sets a code apart from a sibling with the same programme, period and
   * place: a company grant or a reserved group («بورس شرکت …»).
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  variant?: string;

  /** City of study. */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  /** The programme as printed: «مهندسی و علم کامپیوتر گرایش نرم‌افزار». */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  program!: string;

  /** The programme without the field's name: «نرم‌افزار». */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  orientation!: string;

  /** The exam set's field, as stored on programs: "computer-engineering". */
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  field!: string;

  @IsIn(["ANY", "FEMALE", "MALE"])
  gender!: "ANY" | "FEMALE" | "MALE";

  /** True only when the booklet says the code has a dormitory. */
  @IsBoolean()
  hasDormitory!: boolean;

  @IsInt()
  @Min(0)
  @Max(5000)
  capacityFirstTerm!: number;

  @IsInt()
  @Min(0)
  @Max(5000)
  capacitySecondTerm!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bookletPage?: number;
}

/** A whole booklet's tables for one year (file format "admissions-booklet.v1"). */
export class ImportBookletDto {
  @IsIn(["admissions-booklet.v1"])
  schema_version!: "admissions-booklet.v1";

  @IsInt()
  @Min(1390)
  @Max(1500)
  examYear!: number;

  @IsIn(["MASTER", "PHD"])
  degree!: "MASTER" | "PHD";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => BookletRowDto)
  rows!: BookletRowDto[];
}

export class CatalogQueryDto {
  @IsOptional()
  @IsIn(["master", "phd"])
  degree?: "master" | "phd";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1390)
  @Max(1500)
  year?: number;
}
