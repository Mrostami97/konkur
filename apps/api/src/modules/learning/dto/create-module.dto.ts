import { ArrayUnique, IsArray, IsInt, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateModuleDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class UpdateModuleDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

export class ReorderLessonsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  lessonIds!: string[];
}
