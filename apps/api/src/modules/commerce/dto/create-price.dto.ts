import { IsInt, IsOptional, Min } from "class-validator";

export class CreatePriceDto {
  @IsInt()
  @Min(0)
  amountRial!: number;

  /** The price before a sale, shown struck through; must be above amountRial. */
  @IsOptional()
  @IsInt()
  @Min(1)
  compareAtRial?: number;
}
