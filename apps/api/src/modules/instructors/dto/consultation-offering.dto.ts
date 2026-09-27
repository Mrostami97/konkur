import { ConsultationKind } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateOfferingDto {
  @IsUUID()
  instructorProfileId!: string;

  /** Product slug. Lowercase, hyphenated -- it becomes a public URL. */
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase words separated by hyphens" })
  @MaxLength(120)
  slug!: string;

  @IsEnum(ConsultationKind)
  kind!: ConsultationKind;

  @IsInt()
  @Min(1)
  sessionQuota!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  /** Rial. Integer: the currency has no sub-unit in use here. */
  @IsInt()
  @Min(0)
  amountRial!: number;

  /** The deadline the package runs to -- the konkur date for the annual
   * product. Omit for an offering that does not expire. */
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  headline!: string;

  @IsString()
  @MinLength(10)
  description!: string;
}

/** Quota and instructor are absent on purpose: both were sold against, and
 * changing either under existing bookings would move the line for students
 * mid-package. Retire the offering and publish a new one instead. */
export class UpdateOfferingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  headline!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountRial?: number;


  @IsOptional()
  @IsISO8601()
  validUntil?: string | null;
}
