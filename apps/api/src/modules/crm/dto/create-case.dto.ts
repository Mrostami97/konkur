import { IsString, MinLength } from "class-validator";

export class CreateCaseDto {
  @IsString()
  @MinLength(1)
  subject!: string;
}
