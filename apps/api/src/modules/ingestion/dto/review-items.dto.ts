import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID } from "class-validator";

export class ReviewItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  itemIds!: string[];

  @IsIn(["APPROVE", "REJECT"])
  decision!: "APPROVE" | "REJECT";

  @IsOptional()
  @IsString()
  note?: string;
}
