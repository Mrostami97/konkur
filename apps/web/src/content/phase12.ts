import phase12RawCorpus from "./phase12-corpus.json";
import type { EditorialPage, EditorialSection, EditorialSource, ExamDegree } from "./editorial";

export type Phase12Kind = "PLANNING" | "OFFICIAL";
export type Phase12Date = `${string}/${string}/${string}`;
export type Phase12Slug =
  | "start-from-zero"
  | "twelve-month-study-plan"
  | "six-month-study-plan"
  | "three-month-study-plan"
  | "working-candidate-study-plan"
  | "switch-to-computer-science"
  | "weekly-study-plan"
  | "active-review"
  | "error-log"
  | "final-month-review"
  | "exam-time-management"
  | "choose-study-resources"
  | "master-exam-changes-1406"
  | "master-computer-engineering-subjects-1406"
  | "master-information-technology-subjects-1406"
  | "master-computer-science-subjects-1406"
  | "registration-calendar-1406"
  | "official-notices-and-corrections"
  | "historical-budget-computer-engineering"
  | "historical-budget-information-technology"
  | "historical-budget-computer-science"
  | "booklets-and-answer-keys";

export interface Phase12Source extends EditorialSource {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly publishedAt?: string;
  readonly checkedAt: string;
}

export interface Phase12InternalLink {
  readonly href: `/${string}`;
  readonly title: string;
  readonly label: string;
  readonly description?: string;
}

export interface Phase12HistoricalRecord {
  readonly year: string;
  readonly subject: string;
  readonly topic: string;
  readonly questionCount: number;
  readonly sourceUrl: string;
}

export interface Phase12Page {
  readonly kind: Phase12Kind;
  readonly slug: Phase12Slug;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly degree: ExamDegree;
  readonly field: string;
  readonly readingMinutes: number;
  readonly quickAnswer: string;
  readonly sections: readonly EditorialSection[];
  readonly sourceIds: readonly string[];
  readonly internalLinks: readonly Phase12InternalLink[];
  readonly historicalData?: readonly Phase12HistoricalRecord[];
}

export interface Phase12Corpus {
  readonly reviewedAt: Phase12Date;
  readonly sources: Readonly<Record<string, Phase12Source>>;
  readonly planningPages: readonly Phase12Page[];
  readonly officialPages: readonly Phase12Page[];
}

// The JSON file is the single content source so routes, tests and future import jobs
// can inspect the same records without parsing a React component.
export const phase12Corpus = phase12RawCorpus as unknown as Phase12Corpus;
export const phase12PlanningPages = phase12Corpus.planningPages;
export const phase12OfficialPages = phase12Corpus.officialPages;
export const phase12Pages = [...phase12PlanningPages, ...phase12OfficialPages] as const;

function asciiDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function phase12EditorialDate(value: Phase12Date): string {
  return asciiDigits(value).replaceAll("/", "-");
}

function resolveSources(page: Phase12Page): EditorialSource[] {
  return page.sourceIds.map((sourceId) => {
    const source = phase12Corpus.sources[sourceId];
    if (!source) throw new Error(`Unknown Phase 12 source: ${sourceId} (${page.slug})`);
    return { ...source };
  });
}

export function phase12PageToEditorial(page: Phase12Page): EditorialPage {
  const reviewedAt = phase12EditorialDate(phase12Corpus.reviewedAt);
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    quickAnswer: page.quickAnswer,
    category: page.category,
    degree: page.degree,
    field: page.field,
    author: "تحریریه kunkur01",
    reviewer: "در انتظار بازبینی انسانی",
    publishedAt: reviewedAt,
    reviewedAt,
    readingMinutes: page.readingMinutes,
    sections: page.sections.map((section) => ({ ...section })),
    sources: resolveSources(page),
  };
}

export const phase12EditorialPages = phase12Pages.map(phase12PageToEditorial);

export function findPhase12Page(slug: string): Phase12Page | undefined {
  return phase12Pages.find((page) => page.slug === slug);
}

export function findPhase12EditorialPage(slug: string): EditorialPage | undefined {
  const page = findPhase12Page(slug);
  return page ? phase12PageToEditorial(page) : undefined;
}
