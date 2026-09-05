import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";

import articleSchema from "../schemas/article.v1.schema.json";
import reportCardSchema from "../schemas/report-card.v1.schema.json";
import questionSchema from "../schemas/question.v1.schema.json";
import type { ArticleV1, QuestionV1, ReportCardV1 } from "./types";

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const compiled = {
  "article.v1": ajv.compile(articleSchema) as ValidateFunction<ArticleV1>,
  "report-card.v1": ajv.compile(reportCardSchema) as ValidateFunction<ReportCardV1>,
  "question.v1": ajv.compile(questionSchema) as ValidateFunction<QuestionV1>,
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
export function checkQuestionOptionIntegrity(question: QuestionV1): string[] {
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

export function validateArticle(data: unknown): ValidationResult<ArticleV1> {
  const validate = compiled["article.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  return { valid: true, data: data as ArticleV1, errors: [] };
}

export function validateReportCard(data: unknown): ValidationResult<ReportCardV1> {
  const validate = compiled["report-card.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  return { valid: true, data: data as ReportCardV1, errors: [] };
}

export function validateQuestion(data: unknown): ValidationResult<QuestionV1> {
  const validate = compiled["question.v1"];
  const ok = validate(data);
  if (!ok) return { valid: false, errors: formatErrors(validate.errors) };
  const domainErrors = checkQuestionOptionIntegrity(data as QuestionV1);
  if (domainErrors.length > 0) return { valid: false, errors: domainErrors };
  return { valid: true, data: data as QuestionV1, errors: [] };
}
