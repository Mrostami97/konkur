import { Type } from "class-transformer";
import { ArticleContentType, Degree } from "@prisma/client";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from "class-validator";
import { SourceLinkDto } from "./editorial.dto";

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

  @IsOptional() @IsEnum(ArticleContentType) contentType?: ArticleContentType;
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
