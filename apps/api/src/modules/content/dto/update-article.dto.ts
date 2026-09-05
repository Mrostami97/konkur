import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  summary?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  contentBlocks?: unknown[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taxonomyMajor?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taxonomyTags?: string[];
}
