import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";

import articleSchema from "../schemas/article.v1.schema.json";
import articleV2Schema from "../schemas/article.v2.schema.json";
import reportCardSchema from "../schemas/report-card.v1.schema.json";
import questionSchema from "../schemas/question.v1.schema.json";
import questionV2Schema from "../schemas/question.v2.schema.json";
import type { ArticleContract, ArticleV1, ArticleV2, QuestionV1, QuestionV2, ReportCardV1 } from "./types";

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const compiled = {
  "article.v1": ajv.compile(articleSchema) as ValidateFunction<ArticleV1>,
  "article.v2": ajv.compile(articleV2Schema) as ValidateFunction<ArticleV2>,
  "report-card.v1": ajv.compile(reportCardSchema) as ValidateFunction<ReportCardV1>,
  "question.v1": ajv.compile(questionSchema) as ValidateFunction<QuestionV1>,
  "question.v2": ajv.compile(questionV2Schema) as ValidateFunction<QuestionV2>,
};

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`);
}

/**
 * Business rule JSON Schema cannot express cleanly: option numbers must be
 * exactly {1,2,3,4}, each appearing once, and correct_option must be one of them.
 * Doc §6.2 step 8 ("Domain QA") calls this out explicitly for questions.
 */
export function checkQuestionOptionIntegrity(question: Pick<QuestionV1, "options" | "correct_option">): string[] {
  const errors: string[] = [];
  const numbers = question.options.map((o) => o.number).sort();
  const expected = [1, 2, 3, 4];
  const matches = expected.every((n, i) => numbers[i] === n);
  if (!matches) {
    errors.push(
      `/options option numbers must be exactly [1,2,3,4] each once, got [${numbers.join(",")}]`,
    );
  }
  if (!expected.includes(question.correct_option)) {
    errors.push(`/correct_option must be one of 1,2,3,4`);
  }
  return errors;
}

export function validateArticle(data: unknown): ValidationResult<ArticleContract> {
  const version =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).schema_version
      : undefined;
  const validate = version === "article.v2" ? compiled["article.v2"] : compiled["article.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  return { valid: true, data: data as ArticleContract, errors: [] };
}

export function validateArticleV2(data: unknown): ValidationResult<ArticleV2> {
  const validate = compiled["article.v2"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  return { valid: true, data: data as ArticleV2, errors: [] };
}

export function validateReportCard(data: unknown): ValidationResult<ReportCardV1> {
  const validate = compiled["report-card.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  return { valid: true, data: data as ReportCardV1, errors: [] };
}

/** Either question version, chosen by schema_version. */
export function validateQuestion(data: unknown): ValidationResult<QuestionV1 | QuestionV2> {
  const version =
    data && typeof data === "object" ? (data as Record<string, unknown>).schema_version : undefined;
  if (version === "question.v2") return validateQuestionV2(data);
  const validate = compiled["question.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  const domainErrors = checkQuestionOptionIntegrity(data as QuestionV1);
  if (domainErrors.length > 0) return { valid: false, errors: domainErrors };
  return { valid: true, data: data as QuestionV1, errors: [] };
}

/**
 * question.v2: on top of the schema, the option numbers must be {1,2,3,4}, and
 * when more than one option is accepted the stored correct_option must be one
 * of them -- a key that lists 2 and 3 as correct cannot have 4 as "the" answer.
 */
export function validateQuestionV2(data: unknown): ValidationResult<QuestionV2> {
  const validate = compiled["question.v2"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  const question = data as QuestionV2;
  const errors = checkQuestionOptionIntegrity(question);
  if (question.accepted_options && !question.accepted_options.includes(question.correct_option)) {
    errors.push("/accepted_options must include correct_option");
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: question, errors: [] };
}
