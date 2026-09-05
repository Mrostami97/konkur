import { ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsString, Max, Min, MinLength } from "class-validator";

export class ExamDto {
  @IsIn(["master", "phd"])
  degree!: "master" | "phd";

  @IsString()
  @MinLength(1)
  major!: string;

  @IsInt()
  year!: number;
}

export class CreateQuestionDto {
  @IsString()
  @MinLength(1)
  external_id!: string;

  @IsObject()
  exam!: ExamDto;

  @IsString()
  @MinLength(1)
  subject_code!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  topic_codes!: string[];

  @IsArray()
  @ArrayMinSize(1)
  stem_blocks!: unknown[];

  @IsArray()
  @ArrayMinSize(4)
  options!: unknown[];

  @IsInt()
  @Min(1)
  @Max(4)
  correct_option!: number;

  @IsArray()
  @ArrayMinSize(1)
  solution_blocks!: unknown[];
}
