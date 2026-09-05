import { IsString, Matches, MinLength } from "class-validator";

export class CreateTopicDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "code must be kebab-case" })
  code!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "subjectCode must be kebab-case" })
  subjectCode!: string;
}
