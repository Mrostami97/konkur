import { IsIn } from "class-validator";

/** Which 1406 master's exam the mock stands in for. */
export class CreateMockDto {
  @IsIn(["1277", "1276", "1209"])
  track!: "1277" | "1276" | "1209";
}
