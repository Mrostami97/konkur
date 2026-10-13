import * as fs from "fs";
import * as path from "path";
import { validateArticle, validateArticleV2, validateQuestion, validateReportCard } from "../src/validators";

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

  it("accepts article-v2.json without changing article.v1", () => {
    const fixture = load(validDir, "article-v2.json");
    expect(validateArticle(fixture).valid).toBe(true);
    expect(validateArticleV2(fixture).valid).toBe(true);
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

  it("rejects a time-sensitive article.v2 without source review dates", () => {
    const result = validateArticle(load(invalidDir, "article-v2-time-sensitive-without-review.json"));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/source_checked_at|review_due_at/);
  });

  it("rejects external URLs inside article.v2 internal link groups", () => {
    const fixture = load(validDir, "article-v2.json");
    fixture.content_blocks.at(-1).items[0].href = "https://example.com/redirect";
    const result = validateArticleV2(fixture);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/pattern/);
  });

  it("accepts an article.v2 answer-key block and rejects an option outside 1-5", () => {
    const fixture = load(validDir, "article-v2.json");
    fixture.content_blocks.push({
      type: "answer_key",
      caption: "key",
      groups: [{ title: "English", items: [{ n: 1, answer: [2] }, { n: 2, answer: [], mark: "deleted" }, { n: 3, answer: [2, 3], mark: "multi" }] }],
    });
    expect(validateArticleV2(fixture).valid).toBe(true);
    fixture.content_blocks.at(-1).groups[0].items[0].answer = [7];
    expect(validateArticleV2(fixture).valid).toBe(false);
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

  it("accepts question-v2.json: no topic or solution yet, two accepted options, review state", () => {
    const result = validateQuestion(load(validDir, "question-v2.json"));
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("rejects a question.v2 whose accepted options leave out correct_option", () => {
    const result = validateQuestion(load(invalidDir, "question-v2-accepted-without-correct.json"));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("/accepted_options must include correct_option");
  });

  it("rejects a question.v2 without its review state", () => {
    const item = load(validDir, "question-v2.json") as Record<string, unknown>;
    delete item.review;
    expect(validateQuestion(item).valid).toBe(false);
  });
});
