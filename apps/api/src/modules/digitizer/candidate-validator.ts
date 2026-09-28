import type { CandidateQuestion, DigitizerReasonCode } from "./types";

export interface CandidateValidation {
  valid: boolean;
  reasonCodes: DigitizerReasonCode[];
}

function hasCompleteSourceProvenance(candidate: CandidateQuestion): boolean {
  const source = candidate.source;
  return (
    /^[a-fA-F0-9]{64}$/.test(source.sha256) &&
    source.originalPath.trim().length > 0 &&
    source.pages.length > 0 &&
    source.pages.every((page) => Number.isInteger(page) && page > 0)
  );
}

export function validateCandidate(candidate: CandidateQuestion): CandidateValidation {
  const reasonCodes: DigitizerReasonCode[] = [];

  if (!Number.isInteger(candidate.questionNumber) || candidate.questionNumber <= 0) {
    reasonCodes.push("QUESTION_NUMBER_INVALID");
  }

  if (!hasCompleteSourceProvenance(candidate)) {
    reasonCodes.push("SOURCE_PROVENANCE_INCOMPLETE");
  }

  if (candidate.options.length !== 4) {
    reasonCodes.push("OPTION_COUNT_INVALID");
  }

  const optionNumbers = candidate.options.map((option) => option.number).sort((a, b) => a - b);
  if (
    optionNumbers.length !== 4 ||
    optionNumbers.some((number, index) => number !== index + 1)
  ) {
    reasonCodes.push("OPTION_NUMBERS_INVALID");
  }

  return { valid: reasonCodes.length === 0, reasonCodes };
}
