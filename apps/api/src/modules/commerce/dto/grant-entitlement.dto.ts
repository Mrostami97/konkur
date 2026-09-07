import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class GrantEntitlementDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  productId!: string;

  @IsIn(["GIFT", "TRIAL", "MANUAL"])
  grantedVia!: "GIFT" | "TRIAL" | "MANUAL";

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

export class RevokeEntitlementDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
