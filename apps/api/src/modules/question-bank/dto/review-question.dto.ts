import { IsBoolean, IsOptional } from "class-validator";

/** The review queue's verdict on one question; either part may be given alone. */
export class ReviewQuestionDto {
  @IsOptional()
  @IsBoolean()
  textVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  keyVerified?: boolean;
}
