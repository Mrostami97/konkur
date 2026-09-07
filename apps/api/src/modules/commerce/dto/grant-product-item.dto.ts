import { IsUUID } from "class-validator";

export class GrantCourseDto {
  @IsUUID()
  courseId!: string;
}

export class GrantResourceDto {
  @IsUUID()
  resourceId!: string;
}
