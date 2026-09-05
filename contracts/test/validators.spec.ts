import * as fs from "fs";
import * as path from "path";
import { validateArticle, validateQuestion, validateReportCard } from "../src/validators";

const validDir = path.join(__dirname, "../fixtures/valid");
const invalidDir = path.join(__dirname, "../fixtures/invalid");

function load(dir: string, file: string) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
}

describe("valid fixtures", () => {
  it("accepts article.json", () => {
    const result = validateArticle(load(validDir, "article.json"));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("accepts report-card.json", () => {
    const result = validateReportCard(load(validDir, "report-card.json"));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("accepts question.json", () => {
    const result = validateQuestion(load(validDir, "question.json"));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("invalid fixtures", () => {
  it("rejects article-missing-summary.json", () => {
    const result = validateArticle(load(invalidDir, "article-missing-summary.json"));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects report-card-contains-pii.json (unknown field)", () => {
    const result = validateReportCard(load(invalidDir, "report-card-contains-pii.json"));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/additional/i);
  });

  it("rejects question-three-options.json (needs exactly 4)", () => {
    const result = validateQuestion(load(invalidDir, "question-three-options.json"));
    expect(result.valid).toBe(false);
  });

  it("rejects question-duplicate-option-numbers.json (schema-valid, domain-invalid)", () => {
    const result = validateQuestion(load(invalidDir, "question-duplicate-option-numbers.json"));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/option numbers must be exactly/);
  });
});
