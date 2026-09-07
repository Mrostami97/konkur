import { AccessMode, Degree } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateCourseDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsEnum(AccessMode)
  accessMode?: AccessMode;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Degree, { each: true })
  degreeTargets?: Degree[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldTargets?: string[];
}
