import { IsUUID } from "class-validator";

export class AddChoiceDto {
  @IsUUID()
  programId!: string;
}
