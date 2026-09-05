import { IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateProductDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(["COURSE"])
  kind!: "COURSE";

  @IsOptional()
  @IsUUID()
  courseId?: string;
}
