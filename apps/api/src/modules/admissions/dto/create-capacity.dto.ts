import { IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateCapacityDto {
  @IsInt()
  @Min(1300)
  examYear!: number;

  @IsString()
  @MinLength(1)
  quota!: string;

  @IsInt()
  @Min(0)
  capacity!: number;
}
