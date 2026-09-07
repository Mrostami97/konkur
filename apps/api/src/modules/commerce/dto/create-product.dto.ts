import { IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateProductDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(["COURSE", "RESOURCE", "BUNDLE"])
  kind!: "COURSE" | "RESOURCE" | "BUNDLE";

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  courseIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  resourceIds?: string[];
}
