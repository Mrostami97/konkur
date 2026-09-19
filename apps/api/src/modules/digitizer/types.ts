export type QaStatus = "VERIFIED" | "NEEDS_MANUAL_REVIEW" | "REJECTED";
export type DedupeDisposition = "NEW" | "MATCH" | "CONFLICT" | "UNAVAILABLE";

export type DigitizerReasonCode =
  | "OPTION_COUNT_INVALID"
  | "OPTION_NUMBERS_INVALID"
  | "QUESTION_NUMBER_INVALID"
  | "SOURCE_PROVENANCE_INCOMPLETE"
  | "STEM_MATERIAL_DIFF"
  | "OPTION_MATERIAL_DIFF"
  | "OPTION_ORDER_DIFF"
  | "FORMULA_MATERIAL_DIFF"
  | "BOUNDARY_UNVERIFIED"
  | "EXTRACTION_CONFLICT"
  | "DIAGRAM_UNVERIFIED"
  | "FORMULA_UNVERIFIED"
  | "ANSWER_UNVERIFIED"
  | "ANSWER_CONFLICT"
  | "TAXONOMY_UNVERIFIED"
  | "DEDUPE_UNAVAILABLE"
  | "DEDUPE_CONFLICT";

export interface SourceRef {
  sha256: string;
  originalPath: string;
  pages: number[];
  bookletCode?: string;
  cropAssets?: string[];
  boundingBoxes?: Array<{ page: number; x: number; y: number; width: number; height: number }>;
}

export interface BookletIdentity {
  degree: "master" | "phd";
  major: string;
  year: number;
  bookletCode?: string;
  examCode?: string;
}

export interface QuestionBoundary {
  questionNumber: number;
  source: SourceRef;
  spansPages: boolean;
  verified: boolean;
}

export type CandidateBlock =
  | { type: "text"; text: string }
  | { type: "latex"; latex: string }
  | { type: "image"; mediaKey: string; alt?: string }
  | { type: "table"; rows: string[][] };

export interface CandidateOption {
  number: 1 | 2 | 3 | 4;
  blocks: CandidateBlock[];
}

export interface CandidateQuestion {
  questionNumber: number;
  source: SourceRef;
  stemBlocks: CandidateBlock[];
  options: CandidateOption[];
  extractor: { name: string; version?: string };
}

export interface ExtractorContext {
  booklet: BookletIdentity;
  assetsRoot?: string;
}

export interface ExtractorAdapter {
  readonly name: string;
  extract(boundary: QuestionBoundary, context: ExtractorContext): Promise<CandidateQuestion>;
}
