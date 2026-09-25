import { IsIn, IsString, MinLength } from "class-validator";

export class RenameModuleDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

export class MoveDto {
  @IsIn(["up", "down"])
  direction!: "up" | "down";
}
