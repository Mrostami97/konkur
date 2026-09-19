import { routeQuestion } from "../src/modules/digitizer/qa-router";

describe("routeQuestion", () => {
  const clean = {
    candidateValid: true,
    boundaryVerified: true,
    materialAgreement: true,
    diagramsVerified: true,
    formulasVerified: true,
    answerVerified: true,
    answerConflict: false,
    taxonomyVerified: true,
    dedupe: "NEW" as const,
  };

  it("verifies only when every mandatory gate passes", () => {
    expect(routeQuestion(clean)).toEqual({ status: "VERIFIED", reasonCodes: [] });
  });

  it.each([
    ["taxonomy", { taxonomyVerified: false }, "TAXONOMY_UNVERIFIED"],
    ["dedupe unavailable", { dedupe: "UNAVAILABLE" as const }, "DEDUPE_UNAVAILABLE"],
    ["dedupe conflict", { dedupe: "CONFLICT" as const }, "DEDUPE_CONFLICT"],
    ["answer conflict", { answerConflict: true }, "ANSWER_CONFLICT"],
    ["A/B conflict", { materialAgreement: false }, "EXTRACTION_CONFLICT"],
    ["boundary", { boundaryVerified: false }, "BOUNDARY_UNVERIFIED"],
  ])("routes %s failures to manual review", (_name, patch, reason) => {
    const decision = routeQuestion({ ...clean, ...patch });
    expect(decision.status).toBe("NEEDS_MANUAL_REVIEW");
    expect(decision.reasonCodes).toContain(reason);
  });

  it("rejects structurally invalid candidates", () => {
    expect(
      routeQuestion({
        ...clean,
        candidateValid: false,
        candidateReasonCodes: ["OPTION_COUNT_INVALID"],
      }),
    ).toEqual({
      status: "REJECTED",
      reasonCodes: ["OPTION_COUNT_INVALID"],
    });
  });
});
