import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

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

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  topicIds?: string[];
}
