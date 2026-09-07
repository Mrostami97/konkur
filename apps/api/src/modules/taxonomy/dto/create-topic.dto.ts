import { Prisma } from "@prisma/client";
import { IsArray, IsInt, IsObject, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateTopicDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "code must be kebab-case" })
  code!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "subjectCode must be kebab-case" })
  subjectCode!: string;

  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonObject;

  @IsOptional()
  @IsArray()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    each: true,
    message: "each prerequisite code must be kebab-case",
  })
  prerequisiteCodes?: string[];
}
