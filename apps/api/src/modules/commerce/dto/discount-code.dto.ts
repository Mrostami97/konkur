import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

/** Codes are typed by buyers: letters, digits and dashes, matched without regard to case. */
export const normaliseCode = (value: unknown) => (typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : value);

export class CreateDiscountCodeDto {
  @Transform(({ value }) => normaliseCode(value))
  @Matches(/^[A-Z0-9][A-Z0-9-]{2,31}$/, { message: "کد باید ۳ تا ۳۲ حرف لاتین، عدد یا خط تیره باشد." })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  /** One of percentOff and amountOffRial. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  amountOffRial?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPerUser?: number;

  /** Products the code works on; empty or absent for every product. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}

/** Everything but the code and the kind of discount can change after creation. */
export class UpdateDiscountCodeDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  amountOffRial?: number;

  /** null clears the date. */
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPerUser?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}

export class QuoteDto {
  @IsUUID()
  productId!: string;

  @Transform(({ value }) => normaliseCode(value))
  @IsString()
  @MaxLength(40)
  discountCode!: string;
}
