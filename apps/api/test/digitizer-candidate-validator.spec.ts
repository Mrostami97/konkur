import { validateCandidate } from "../src/modules/digitizer/candidate-validator";
import type { CandidateQuestion } from "../src/modules/digitizer/types";

function candidate(): CandidateQuestion {
  return {
    questionNumber: 1,
    source: {
      sha256: "a".repeat(64),
      originalPath: "ce/1403/booklet.pdf",
      pages: [2],
      bookletCode: "164C",
    },
    stemBlocks: [{ type: "text", text: "Question?" }],
    options: [1, 2, 3, 4].map((number) => ({
      number: number as 1 | 2 | 3 | 4,
      blocks: [{ type: "text", text: `option-${number}` }],
    })),
    extractor: { name: "test-a", version: "1" },
  };
}

describe("validateCandidate", () => {
  it("accepts a complete four-option candidate", () => {
    expect(validateCandidate(candidate())).toEqual({ valid: true, reasonCodes: [] });
  });

  it("rejects a candidate with fewer than four options", () => {
    const value = candidate();
    value.options = value.options.slice(0, 3);
    expect(validateCandidate(value).reasonCodes).toEqual([
      "OPTION_COUNT_INVALID",
      "OPTION_NUMBERS_INVALID",
    ]);
  });

  it("rejects duplicate option numbers", () => {
    const value = candidate();
    value.options = [value.options[0], value.options[0], value.options[2], value.options[3]];
    expect(validateCandidate(value).reasonCodes).toContain("OPTION_NUMBERS_INVALID");
  });

  it("rejects invalid question numbers", () => {
    const value = candidate();
    value.questionNumber = 0;
    expect(validateCandidate(value).reasonCodes).toContain("QUESTION_NUMBER_INVALID");
  });

  it("rejects incomplete source provenance", () => {
    const value = candidate();
    value.source.sha256 = "";
    expect(validateCandidate(value).reasonCodes).toContain("SOURCE_PROVENANCE_INCOMPLETE");
  });
});
