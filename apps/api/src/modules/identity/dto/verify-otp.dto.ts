import { Length, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { latinDigits, NormalizePhone } from "../phone";

export class VerifyOtpDto {
  @NormalizePhone()
  @Matches(/^\+?[0-9]{8,15}$/, { message: "phone must be a valid phone number" })
  phone!: string;

  // Codes typed on a Persian keyboard arrive in Persian digits.
  @Transform(({ value }) => (typeof value === "string" ? latinDigits(value).trim() : value))
  @Length(6, 6, { message: "code must be 6 digits" })
  code!: string;
}
