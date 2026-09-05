import { IsArray, IsIn, IsNumber, IsString, Max, Min, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class SubjectScoreDto {
  @IsString()
  @MinLength(1)
  subjectCode!: string;

  @IsNumber()
  @Min(-100)
  @Max(100)
  percent!: number;
}

export class EstimateRankDto {
  @IsIn(["master", "phd"])
  degree!: "master" | "phd";

  @IsString()
  @MinLength(1)
  field!: string;

  @IsString()
  @MinLength(1)
  quota!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectScoreDto)
  subjectScores!: SubjectScoreDto[];
}
