import { ArrayMinSize, IsArray, IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsArray()
  @ArrayMinSize(1)
  contentBlocks!: unknown[];
}
