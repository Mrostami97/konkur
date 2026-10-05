import { IsInt, Max, Min } from "class-validator";
import { MAX_LESSON_VIDEO_BYTES } from "../learning.service";

export class StartVideoUploadDto {
  /** The whole file's size in bytes. */
  @IsInt()
  @Min(1)
  @Max(MAX_LESSON_VIDEO_BYTES)
  size!: number;
}
