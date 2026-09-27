import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class SaveWeeklyReportDto {
  @IsInt()
  @Min(0)
  @Max(5000)
  testsSolved!: number;

  /** How the week felt, 1 (very low) to 5 (very good). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  wentWell?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  obstacles?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  questions?: string;

  /** true sends it to the consultant; false only saves a draft. */
  @IsBoolean()
  submit!: boolean;
}

export class ReviewWeeklyReportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(3000)
  coachNote!: string;
}
