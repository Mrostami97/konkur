import { ArrayMinSize, IsArray, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateArticleDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  summary!: string;

  @IsArray()
  @ArrayMinSize(1)
  contentBlocks!: unknown[];

  @IsArray()
  @IsString({ each: true })
  taxonomyMajor!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taxonomyTags?: string[];
}
