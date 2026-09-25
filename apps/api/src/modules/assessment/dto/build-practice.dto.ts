import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export const PRACTICE_SOURCES = ["ALL", "UNSEEN", "MISTAKES"] as const;
export type PracticeSource = (typeof PRACTICE_SOURCES)[number];

/** The pool a practice exam draws from: subject, optional topics, source. */
export class PreviewPracticeDto {
  @IsString()
  @MinLength(1)
  subjectCode!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  topicCodes?: string[];

  @IsOptional()
  @IsIn(PRACTICE_SOURCES)
  source?: PracticeSource;
}

export class BuildPracticeDto extends PreviewPracticeDto {
  /** As low as 1: reviewing the two questions you got wrong is a real use. */
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount!: number;

  /** Omitted: 1.5 minutes per question (see PRACTICE_MINUTES_PER_QUESTION). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes?: number;
}
