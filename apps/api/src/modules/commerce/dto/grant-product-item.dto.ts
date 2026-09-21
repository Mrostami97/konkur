import { IsString, IsUUID, MinLength } from "class-validator";

export class GrantCourseDto {
  @IsUUID()
  courseId!: string;
}

export class GrantResourceDto {
  @IsUUID()
  resourceId!: string;
}

export class GrantQuestionBankDto {
  @IsString()
  @MinLength(1)
  subjectCode!: string;
}
