import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class LogStudySessionDto {
  @IsString()
  @MinLength(1)
  subjectCode!: string;

  @IsOptional()
  @IsString()
  topicCode?: string;

  @IsInt()
  @Min(1)
  minutes!: number;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
