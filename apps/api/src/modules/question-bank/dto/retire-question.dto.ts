import { IsString, MinLength } from "class-validator";

export class RetireQuestionDto {
  /** Recorded on the question and in the audit log. Retiring is reversible but
   * removes a question from the bank and from new exams, so the operator has
   * to say why rather than leaving the next person to guess. */
  @IsString()
  @MinLength(3)
  reason!: string;
}
