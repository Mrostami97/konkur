import { AccessMode, Degree } from "@prisma/client";
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength } from "class-validator";

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

  /** The course id on SpotPlayer, where this course's videos live. Leave
   * unset for a course with no video component. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  spotPlayerCourseId?: string;

  /** The course's total length in minutes, as shown on its card and page;
   * null clears it. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  durationMinutes?: number | null;
}

export class SetCourseMaterialsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  resourceIds!: string[];
}
