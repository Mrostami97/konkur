import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { COLLECTIONS, type Collection } from "../practice.service";

/** What a student picks to practise: a subject, its topics, years, track and one of their collections. */
export class PracticeSelectionDto {
  @IsString()
  @Matches(/^[a-z0-9-]{1,80}$/)
  subjectCode!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  topicCodes?: string[];

  @IsOptional()
  @IsIn(COLLECTIONS)
  collection?: Collection;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,80}$/)
  examMajor?: string;

  @IsOptional()
  @IsInt()
  @Min(1370)
  @Max(1500)
  yearFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1370)
  @Max(1500)
  yearTo?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;
}

/** The same selection as a timed exam of the student's own. */
export class PersonalExamDto extends PracticeSelectionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsInt()
  @Min(1)
  @Max(300)
  durationMinutes!: number;
}
