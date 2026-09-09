import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateProgramDto {
  @IsUUID()
  sourceId!: string;

  @IsUUID()
  universityId!: string;

  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "code must be kebab-case" })
  code!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn(["MASTER", "PHD"])
  degree!: "MASTER" | "PHD";

  @IsString()
  @MinLength(1)
  field!: string;

  @IsIn(["FREE", "PAID"])
  tuitionType!: "FREE" | "PAID";

  @IsOptional()
  @IsBoolean()
  hasDormitory?: boolean;
}
