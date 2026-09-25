import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

/** One uploaded image, named by the media_key its image block uses. */
export class LessonAssetDto {
  @IsString()
  @MinLength(1)
  media_key!: string;

  @Matches(/^sha256:[0-9a-f]{64}$/, { message: "checksum must be sha256:<64 hex>" })
  checksum!: string;
}

export class CreateLessonDto {
  @IsString()
  @MinLength(1)
  title!: string;

  /** Omitted: after the module's last lesson. */
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsArray()
  @ArrayMinSize(1)
  contentBlocks!: unknown[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonAssetDto)
  assets?: LessonAssetDto[];

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  topicIds?: string[];
}

/** Editing a lesson replaces its content and images together, so a block
 * can never point at an image the lesson no longer carries. */
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonAssetDto)
  assets?: LessonAssetDto[];

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}
