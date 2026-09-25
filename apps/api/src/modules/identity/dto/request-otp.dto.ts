import { IsOptional, IsString, Matches } from "class-validator";
import { NormalizePhone } from "../phone";

export class RequestOtpDto {
  @NormalizePhone()
  @Matches(/^\+?[0-9]{8,15}$/, { message: "phone must be a valid phone number" })
  phone!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  campaignCode?: string;
}
