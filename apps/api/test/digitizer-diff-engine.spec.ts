import { compareCandidates } from "../src/modules/digitizer/diff-engine";
import type { CandidateQuestion } from "../src/modules/digitizer/types";

function candidate(
  text = "Compute n log n",
  option1 = "10",
  latex = "n\\\\log n",
): CandidateQuestion {
  return {
    questionNumber: 1,
    source: {
      sha256: "a".repeat(64),
      originalPath: "ce/1403/booklet.pdf",
      pages: [2],
    },
    stemBlocks: [
      { type: "text", text },
      { type: "latex", latex },
    ],
    options: [1, 2, 3, 4].map((number) => ({
      number: number as 1 | 2 | 3 | 4,
      blocks: [
        {
          type: "text",
          text: number === 1 ? option1 : `option-${number}`,
        },
      ],
    })),
    extractor: { name: "test" },
  };
}

describe("compareCandidates", () => {
  it("accepts exact agreement", () => {
    expect(compareCandidates(candidate(), candidate()).materialAgreement).toBe(true);
  });

  it("treats digit changes as material", () => {
    expect(
      compareCandidates(candidate("value 10"), candidate("value 100")).materialAgreement,
    ).toBe(false);
  });

  it("treats operator changes as material", () => {
    expect(compareCandidates(candidate("x < y"), candidate("x <= y")).reasonCodes).toContain(
      "STEM_MATERIAL_DIFF",
    );
  });

  it("treats negation changes as material", () => {
    expect(
      compareCandidates(candidate("Which is true?"), candidate("Which is not true?")).reasonCodes,
    ).toContain("STEM_MATERIAL_DIFF");
  });

  it("detects option reordering", () => {
    const reordered = candidate();
    reordered.options = [
      reordered.options[1],
      reordered.options[0],
      reordered.options[2],
      reordered.options[3],
    ];
    expect(compareCandidates(candidate(), reordered).reasonCodes).toContain(
      "OPTION_ORDER_DIFF",
    );
  });

  it("detects formula changes", () => {
    expect(
      compareCandidates(
        candidate("same", "10", "n\\\\log n"),
        candidate("same", "10", "n^2\\\\log n"),
      ).reasonCodes,
    ).toContain("FORMULA_MATERIAL_DIFF");
  });

  it("normalizes harmless whitespace only", () => {
    expect(compareCandidates(candidate("A   B"), candidate("A B")).materialAgreement).toBe(true);
  });
});
