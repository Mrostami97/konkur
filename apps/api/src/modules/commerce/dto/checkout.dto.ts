import { IsUUID } from "class-validator";

export class CheckoutDto {
  @IsUUID()
  productId!: string;
}
