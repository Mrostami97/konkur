import { IsBoolean } from "class-validator";

export class SetSampleDto {
  /** A sample question is fully public including its answer key, so this is an
   * editorial decision rather than a display toggle. */
  @IsBoolean()
  isSample!: boolean;
}
