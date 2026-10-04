import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from "class-validator";

/** The review queue's verdict on one question; either part may be given alone. */
export class ReviewQuestionDto {
  @IsOptional()
  @IsBoolean()
  textVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  keyVerified?: boolean;
}

/** "This year's key matches the official final key." */
export class ConfirmExamKeyDto {
  @Matches(/^[0-9]{3,5}$/)
  examCode!: string;

  @IsInt()
  @Min(1300)
  @Max(1500)
  examYear!: number;
}
