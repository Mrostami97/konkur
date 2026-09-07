import { Type } from "class-transformer";
import { ArticleContentType, Degree } from "@prisma/client";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min, MinLength, ValidateNested } from "class-validator";
import { SourceLinkDto } from "./editorial.dto";

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

  @IsOptional()
  @IsEnum(ArticleContentType)
  contentType?: ArticleContentType;

  @IsOptional() @IsString() quickAnswer?: string;
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsArray() @IsEnum(Degree, { each: true }) taxonomyDegrees?: Degree[];
  @IsOptional() @IsArray() @IsString({ each: true }) taxonomyFields?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) subjectCodes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) topicCodes?: string[];
  @IsOptional() @IsInt() @Min(1300) validForYear?: number;
  @IsOptional() @IsUUID() authorProfileId?: string;
  @IsOptional() @IsDateString() sourceValidatedAt?: string;
  @IsOptional() @IsDateString() reviewDueAt?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SourceLinkDto) sourceLinks?: SourceLinkDto[];
}
