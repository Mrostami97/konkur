import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsIn(["MASTER", "PHD"])
  targetDegree?: "MASTER" | "PHD";

  @IsOptional()
  @IsString()
  @MinLength(1)
  targetField?: string;
}
