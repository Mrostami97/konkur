import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  contentBlocks?: unknown[];

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  topicIds?: string[];
}

export class RenameModuleDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

export class MoveDto {
  @IsIn(["up", "down"])
  direction!: "up" | "down";
}
