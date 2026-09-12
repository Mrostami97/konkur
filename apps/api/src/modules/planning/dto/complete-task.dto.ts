import { IsInt, IsOptional, Max, Min } from "class-validator";

export class CompleteTaskDto {
  /** Actual elapsed study time. When omitted, completing the action does not
   * create a StudySession from the task's estimate. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  actualMinutes?: number;
}
