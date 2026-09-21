import { IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from "class-validator";

export class CreateProductDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be kebab-case" })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsIn(["COURSE", "RESOURCE", "BUNDLE", "QUESTION_BANK"])
  kind!: "COURSE" | "RESOURCE" | "BUNDLE" | "QUESTION_BANK";

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  courseIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  resourceIds?: string[];

  /**
   * Question-bank subject codes this product grants (owner decision: bank
   * access is SUBJECT-scoped, not whole-bank/per-topic). For a QUESTION_BANK
   * product this is the product's own bank scope; for a COURSE product it is
   * how "purchasing this course includes its question bank" is expressed --
   * an explicit product-configuration choice, not derived from lesson
   * topics.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionBankSubjectCodes?: string[];
}
