import { IsString, MinLength } from "class-validator";

export class AddInteractionDto {
  @IsString()
  @MinLength(1)
  type!: string;

  @IsString()
  @MinLength(1)
  note!: string;
}
