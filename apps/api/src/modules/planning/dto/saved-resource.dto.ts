import { IsString, Matches } from "class-validator";

export class SavedResourceDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  resourceSlug!: string;
}
