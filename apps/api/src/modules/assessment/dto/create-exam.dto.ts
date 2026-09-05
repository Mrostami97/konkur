import { IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength, ValidateIf } from "class-validator";

export class CreateExamDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(["STATIC", "DYNAMIC"])
  mode!: "STATIC" | "DYNAMIC";

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ValidateIf((o) => o.mode === "DYNAMIC")
  @IsString()
  @MinLength(1)
  subjectCode?: string;

  @ValidateIf((o) => o.mode === "DYNAMIC")
  @IsInt()
  @Min(1)
  questionCount?: number;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
