import { Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @Matches(/^\+?[0-9]{8,15}$/, { message: "phone must be a valid phone number" })
  phone!: string;

  @Length(6, 6, { message: "code must be 6 digits" })
  code!: string;
}
