import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from "class-validator";

export class BankAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  bankName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  holderName!: string;

  /** Accepted with or without separators; stored as digits. */
  @Matches(/^[0-9\s-]{16,25}$/, { message: "cardNumber must be a 16-digit card number" })
  cardNumber!: string;

  @IsOptional()
  @Matches(/^IR[0-9]{24}$/, { message: "iban must be an IR IBAN" })
  iban?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
