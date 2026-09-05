import { IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateModuleDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsInt()
  @Min(0)
  order!: number;
}
