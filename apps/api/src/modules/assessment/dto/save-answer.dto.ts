import { IsIn, IsOptional } from "class-validator";

export class SaveAnswerDto {
  @IsOptional()
  @IsIn([1, 2, 3, 4])
  selectedOption?: number | null;
}
