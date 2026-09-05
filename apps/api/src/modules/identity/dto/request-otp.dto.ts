import { IsOptional, IsString, Matches } from "class-validator";

export class RequestOtpDto {
  @Matches(/^\+?[0-9]{8,15}$/, { message: "phone must be a valid phone number" })
  phone!: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  campaignCode?: string;
}
