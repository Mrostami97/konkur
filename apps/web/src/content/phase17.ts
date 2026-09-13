import phase17RawCorpus from "./phase17-corpus.json";
import type { EditorialSection, EditorialSource, ExamDegree } from "./editorial";

export type Phase17Kind = "COLUMN" | "OFFICIAL" | "SPECIALIST" | "PREPARATION";
export type Phase17Stage = "WRITTEN" | "POST_WRITTEN" | "BOTH";
export type Phase17Date = `${string}/${string}/${string}`;
export type Phase17ItemId = `P17-${string}`;
export type Phase17OfficialSetCode = "2247" | "2354" | "2358" | "2354/2358" | "2247/2354/2358";
export type Phase17Slug =
  | "phd-computer-engineering-1406"
  | "phd-information-technology-1406"
  | "phd-computer-science-1406"
  | "phd-computer-engineering-subjects-1406"
  | "phd-information-technology-subjects-1406"
  | "phd-computer-science-subjects-1406"
  | "phd-computer-architecture-study-guide"
  | "phd-software-algorithms-study-guide"
  | "phd-artificial-intelligence-study-guide"
  | "phd-networks-secure-computing-study-guide"
  | "phd-information-technology-study-guide"
  | "phd-computer-science-research-path"
  | "phd-written-exam-study-plan"
  | "phd-english-study-guide"
  | "phd-research-cv-guide"
  | "phd-interview-preparation";

export interface Phase17Source extends EditorialSource {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly publishedAt?: string;
  readonly checkedAt: string;
  readonly supportedClaim: string;
}

export interface Phase17InternalLink {
  readonly href: `/${string}`;
  readonly title: string;
  readonly label: string;
  readonly description?: string;
}

export interface Phase17Page {
  readonly phaseItemId: Phase17ItemId;
  readonly sequence: number;
  readonly kind: Phase17Kind;
  readonly stage: Phase17Stage;
  readonly slug: Phase17Slug;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly degree: Extract<ExamDegree, "دکتری">;
  readonly field: string;
  readonly examYear: 1406;
  readonly officialSetCode?: Phase17OfficialSetCode;
  readonly readingMinutes: number;
  readonly quickAnswer: string;
  readonly sections: readonly EditorialSection[];
  readonly relatedSubjectCodes: readonly string[];
  readonly sourceIds: readonly string[];
  readonly internalLinks: readonly Phase17InternalLink[];
}

export interface Phase17Corpus {
  readonly phase: 17;
  readonly title: string;
  readonly preparedAt: Phase17Date;
  readonly publicationStatus: "DRAFT";
  readonly humanReviewRequired: true;
  readonly officialSnapshot: {
    readonly sourceId: string;
    readonly status: string;
    readonly warning: string;
  };
  readonly sources: Readonly<Record<string, Phase17Source>>;
  readonly pages: readonly Phase17Page[];
}

// This module intentionally exports draft data only. Phase 17 pages must enter
// the versioned review workflow and are not part of the public static fallback.
export const phase17Corpus = phase17RawCorpus as unknown as Phase17Corpus;
export const phase17Pages = phase17Corpus.pages;

export function findPhase17Page(slug: string): Phase17Page | undefined {
  return phase17Pages.find((page) => page.slug === slug);
}
