import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class AddExamItemDto {
  @IsUUID()
  questionId!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;
}
