import { IsString, Matches, MinLength } from "class-validator";

export class CreateUniversityDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "code must be kebab-case" })
  code!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  city!: string;
}
