import { IsInt, Matches, Max, Min } from "class-validator";

/** A simulator of one real exam year: which exam, and how long it runs. */
export class CreateSimulatorDto {
  @Matches(/^[0-9]{3,5}$/)
  examCode!: string;

  @IsInt()
  @Min(1300)
  @Max(1500)
  examYear!: number;

  @IsInt()
  @Min(10)
  @Max(600)
  durationMinutes!: number;
}
