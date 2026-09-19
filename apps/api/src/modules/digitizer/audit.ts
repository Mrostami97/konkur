import type { CandidateQuestion, DigitizerReasonCode, QaStatus } from "./types";
import { sha256Json } from "../ingestion/checksum";

export interface DigitizerAuditRecord {
  externalIdCandidate: string;
  source: CandidateQuestion["source"];
  bookletCode?: string;
  extractorA: { name: string; version?: string; resultHash: string };
  extractorB: { name: string; version?: string; resultHash: string };
  diffReasonCodes: DigitizerReasonCode[];
  verificationGates: {
    boundaryVerified: boolean;
    diagramsVerified: boolean;
    formulasVerified: boolean;
    answerVerified: boolean;
    taxonomyVerified: boolean;
    dedupeVerified: boolean;
  };
  finalStatus: QaStatus;
  reasonCodes: DigitizerReasonCode[];
}

export function buildAuditRecord(input: {
  externalIdCandidate: string;
  candidateA: CandidateQuestion;
  candidateB: CandidateQuestion;
  diffReasonCodes: DigitizerReasonCode[];
  verificationGates: DigitizerAuditRecord["verificationGates"];
  finalStatus: QaStatus;
  reasonCodes: DigitizerReasonCode[];
}): DigitizerAuditRecord {
  return {
    externalIdCandidate: input.externalIdCandidate,
    source: input.candidateA.source,
    bookletCode: input.candidateA.source.bookletCode,
    extractorA: {
      ...input.candidateA.extractor,
      resultHash: sha256Json(input.candidateA),
    },
    extractorB: {
      ...input.candidateB.extractor,
      resultHash: sha256Json(input.candidateB),
    },
    diffReasonCodes: [...input.diffReasonCodes],
    verificationGates: { ...input.verificationGates },
    finalStatus: input.finalStatus,
    reasonCodes: [...input.reasonCodes],
  };
}
