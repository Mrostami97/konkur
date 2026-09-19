import type { QaStatus } from "./types";

export interface GoldenSetCase {
  expectedStatus: QaStatus;
  actualStatus: QaStatus;
  questionNumberCorrect: boolean;
  fourOptionsCorrect: boolean;
  materialAgreement: boolean;
}

export interface GoldenSetMetrics {
  caseCount: number;
  exactQuestionNumberRate: number;
  exactFourOptionRate: number;
  materialAgreementRate: number;
  falseVerifiedCount: number;
  statusConfusion: Record<string, number>;
  passesQualityGate: boolean;
}

export function evaluateGoldenSet(cases: GoldenSetCase[]): GoldenSetMetrics {
  const caseCount = cases.length;
  const rate = (predicate: (value: GoldenSetCase) => boolean): number =>
    caseCount === 0 ? 0 : cases.filter(predicate).length / caseCount;

  const statusConfusion: Record<string, number> = {};
  for (const value of cases) {
    const key = `${value.expectedStatus}->${value.actualStatus}`;
    statusConfusion[key] = (statusConfusion[key] ?? 0) + 1;
  }

  const falseVerifiedCount = cases.filter(
    (value) =>
      value.actualStatus === "VERIFIED" &&
      value.expectedStatus !== "VERIFIED",
  ).length;

  return {
    caseCount,
    exactQuestionNumberRate: rate((value) => value.questionNumberCorrect),
    exactFourOptionRate: rate((value) => value.fourOptionsCorrect),
    materialAgreementRate: rate((value) => value.materialAgreement),
    falseVerifiedCount,
    statusConfusion,
    passesQualityGate: falseVerifiedCount === 0,
  };
}
