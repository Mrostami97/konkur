import { IsInt, Min } from "class-validator";

export class CreatePriceDto {
  @IsInt()
  @Min(0)
  amountRial!: number;
}
