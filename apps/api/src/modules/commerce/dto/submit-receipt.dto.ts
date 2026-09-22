import { IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/** What the buyer states about a transfer they say they have made. Every
 * field is a claim until an operator checks it against the bank statement. */
export class SubmitReceiptDto {
  /** The bank's tracking/reference number for the transfer. This is what the
   * operator actually matches on. */
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  trackingCode!: string;

  @IsISO8601()
  paidAt!: string;

  /** Last four digits of the card the money came from -- enough to match a
   * statement line, and no reason to hold the rest of someone's card number. */
  @IsOptional()
  @Matches(/^[0-9]{4}$/, { message: "fromCardLast4 must be exactly 4 digits" })
  fromCardLast4?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
