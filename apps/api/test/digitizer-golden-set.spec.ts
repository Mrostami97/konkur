import { evaluateGoldenSet } from "../src/modules/digitizer/golden-set";

describe("evaluateGoldenSet", () => {
  it("passes a sample with zero false VERIFIED cases", () => {
    const metrics = evaluateGoldenSet([
      {
        expectedStatus: "VERIFIED",
        actualStatus: "VERIFIED",
        questionNumberCorrect: true,
        fourOptionsCorrect: true,
        materialAgreement: true,
      },
      {
        expectedStatus: "NEEDS_MANUAL_REVIEW",
        actualStatus: "NEEDS_MANUAL_REVIEW",
        questionNumberCorrect: true,
        fourOptionsCorrect: true,
        materialAgreement: false,
      },
    ]);

    expect(metrics.falseVerifiedCount).toBe(0);
    expect(metrics.passesQualityGate).toBe(true);
    expect(metrics.exactQuestionNumberRate).toBe(1);
  });

  it("hard-fails when an unsafe item is falsely VERIFIED", () => {
    const metrics = evaluateGoldenSet([
      {
        expectedStatus: "NEEDS_MANUAL_REVIEW",
        actualStatus: "VERIFIED",
        questionNumberCorrect: true,
        fourOptionsCorrect: true,
        materialAgreement: true,
      },
    ]);

    expect(metrics.falseVerifiedCount).toBe(1);
    expect(metrics.passesQualityGate).toBe(false);
  });
});
