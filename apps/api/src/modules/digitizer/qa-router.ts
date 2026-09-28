import type {
  DedupeDisposition,
  DigitizerReasonCode,
  QaStatus,
} from "./types";

export interface QaInput {
  candidateValid: boolean;
  candidateReasonCodes?: DigitizerReasonCode[];
  boundaryVerified: boolean;
  materialAgreement: boolean;
  diagramsVerified: boolean;
  formulasVerified: boolean;
  answerVerified: boolean;
  answerConflict: boolean;
  taxonomyVerified: boolean;
  dedupe: DedupeDisposition;
}

export interface QaDecision {
  status: QaStatus;
  reasonCodes: DigitizerReasonCode[];
}

export function routeQuestion(input: QaInput): QaDecision {
  if (!input.candidateValid) {
    return {
      status: "REJECTED",
      reasonCodes:
        input.candidateReasonCodes && input.candidateReasonCodes.length > 0
          ? [...input.candidateReasonCodes]
          : ["OPTION_COUNT_INVALID"],
    };
  }

  const reasonCodes: DigitizerReasonCode[] = [];
  if (!input.boundaryVerified) reasonCodes.push("BOUNDARY_UNVERIFIED");
  if (!input.materialAgreement) reasonCodes.push("EXTRACTION_CONFLICT");
  if (!input.diagramsVerified) reasonCodes.push("DIAGRAM_UNVERIFIED");
  if (!input.formulasVerified) reasonCodes.push("FORMULA_UNVERIFIED");
  if (!input.answerVerified) reasonCodes.push("ANSWER_UNVERIFIED");
  if (input.answerConflict) reasonCodes.push("ANSWER_CONFLICT");
  if (!input.taxonomyVerified) reasonCodes.push("TAXONOMY_UNVERIFIED");
  if (input.dedupe === "UNAVAILABLE") reasonCodes.push("DEDUPE_UNAVAILABLE");
  if (input.dedupe === "CONFLICT") reasonCodes.push("DEDUPE_CONFLICT");

  if (reasonCodes.length > 0) {
    return { status: "NEEDS_MANUAL_REVIEW", reasonCodes };
  }

  return { status: "VERIFIED", reasonCodes: [] };
}
