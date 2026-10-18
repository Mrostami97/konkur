import { AnswerConfidence, PracticeErrorReason } from "@prisma/client";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";

/** One answer to a bank question while practising. */
export class PracticeAnswerDto {
  @IsInt()
  @IsIn([1, 2, 3, 4])
  selectedOption!: number;

  /** How sure the student was, chosen before seeing the key. */
  @IsOptional()
  @IsEnum(AnswerConfidence)
  confidence?: AnswerConfidence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6 * 3600 * 1000)
  timeSpentMs?: number;
}

/** The student's reason for a wrong answer; null clears it. */
export class PracticeReasonDto {
  @ValidateIf((dto: PracticeReasonDto) => dto.errorReason !== null)
  @IsEnum(PracticeErrorReason)
  errorReason!: PracticeErrorReason | null;
}

/** A star and/or a note; an empty note clears it. */
export class QuestionMarkDto {
  @IsOptional()
  @IsBoolean()
  starred?: boolean;

  @IsOptional()
  @ValidateIf((dto: QuestionMarkDto) => dto.note !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
