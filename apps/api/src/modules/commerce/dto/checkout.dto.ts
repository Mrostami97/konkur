import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { normaliseCode } from "./discount-code.dto";

export class CheckoutDto {
  @IsUUID()
  productId!: string;

  /** A discount code the buyer typed, if any. */
  @IsOptional()
  @Transform(({ value }) => normaliseCode(value))
  @IsString()
  @MaxLength(40)
  discountCode?: string;
}
