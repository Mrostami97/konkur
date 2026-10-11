import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** The key the owner made on SpotPlayer for a student. */
export class IssueVideoLicenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  licenseKey!: string;
}

export class VideoLicenseListQuery {
  @IsOptional()
  @IsIn(["PENDING", "DONE"])
  status?: "PENDING" | "DONE";
}
