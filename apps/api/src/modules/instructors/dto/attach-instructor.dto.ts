import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class AttachInstructorDto {
  @IsUUID()
  contributorProfileId!: string;

  /** Basis points, 0-10000. See CourseInstructor in schema.prisma for why the
   * share is an integer rather than a percent. */
  @IsInt()
  @Min(0)
  @Max(10_000)
  revenueShareBp!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
