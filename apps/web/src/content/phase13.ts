import phase13RawCorpus from "./phase13-corpus.json";
import type { EditorialSection, EditorialSource, ExamDegree } from "./editorial";

export { phase13RawCorpus };

export type Phase13Kind = "DECISION" | "CASE_STUDY";
export type Phase13SourceCheckDate = `${string}/${string}/${string}`;
export type Phase13SourceId = keyof typeof phase13RawCorpus.sources;

export type Phase13DecisionSlug =
  | "computer-it-cs-comparison"
  | "computer-engineering-master-specializations"
  | "information-technology-specializations-careers"
  | "computer-science-specializations-research"
  | "how-to-read-master-scorecard"
  | "percent-rank-scenarios"
  | "compare-computer-universities"
  | "master-field-selection-guide";

export type Phase13CaseStudySlug =
  | "case-study-automata-100-percent"
  | "case-study-data-structures-10-of-11"
  | "case-study-data-structures-9-correct"
  | "case-study-course-alignment-9-of-12"
  | "case-study-phd-16-of-19"
  | "case-study-question-design-1401";

export type Phase13Slug = Phase13DecisionSlug | Phase13CaseStudySlug;

export interface Phase13Source extends EditorialSource {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly publishedAt?: string;
  readonly checkedAt: string;
  readonly supportedClaim: string;
}

export interface Phase13InternalLink {
  readonly href: `/${string}`;
  readonly title: string;
  readonly label: string;
  readonly description?: string;
}

interface Phase13PageBase<Kind extends Phase13Kind, Slug extends Phase13Slug> {
  readonly kind: Kind;
  readonly slug: Slug;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly degree: ExamDegree;
  readonly field: string;
  readonly readingMinutes: number;
  readonly quickAnswer: string;
  readonly sections: readonly EditorialSection[];
  readonly sourceIds: readonly Phase13SourceId[];
  readonly internalLinks: readonly Phase13InternalLink[];
}

export type Phase13DecisionPage = Phase13PageBase<"DECISION", Phase13DecisionSlug>;

export interface Phase13CaseStudy
  extends Phase13PageBase<"CASE_STUDY", Phase13CaseStudySlug> {
  readonly examYear: 1401 | 1405;
  readonly metric: string;
}

export type Phase13Page = Phase13DecisionPage | Phase13CaseStudy;

export interface Phase13Corpus {
  readonly sourceCheckedAt: Phase13SourceCheckDate;
  readonly sources: Readonly<Record<Phase13SourceId, Phase13Source>>;
  readonly decisionPages: readonly Phase13DecisionPage[];
  readonly caseStudies: readonly Phase13CaseStudy[];
}

// The JSON file remains the single runtime content source. This centralized cast
// keeps consumers on the discriminated, slug-safe types declared above.
export const phase13Corpus = phase13RawCorpus as unknown as Phase13Corpus;
export const phase13Sources = phase13Corpus.sources;
export const phase13DecisionPages = phase13Corpus.decisionPages;
export const phase13RawCaseStudies = phase13Corpus.caseStudies;

export const phase13ConflictOfInterestDisclosure = {
  title: "افشای تعارض منافع",
  paragraphs: [
    "منبع این مطالعهٔ موردی از آرشیو متعلق به مدرس و عرضه‌کنندهٔ دوره است؛ بنابراین ادعای عملکرد، تطبیق یا سابقه را گزارش دست‌اولِ دارای نفع تجاری بدان، نه ارزیابی مستقل.",
  ],
  note: "انتشار یا بازاستفاده از کارنامه و تصویر دانشجو منوط به ثبت رضایت صریح و قابل لغو است؛ تا پیش از آن، منبع فقط به‌صورت پیوند ارجاعی استفاده می‌شود.",
} satisfies EditorialSection;

export function phase13CaseStudyMetricSection(page: Phase13CaseStudy): EditorialSection {
  return {
    title: "معیار مستند این نمونه",
    paragraphs: [`معیار ثبت‌شده: ${page.metric}`],
    note: "این معیار فقط همان گزارش پیوندشده را توصیف می‌کند و تضمین یا پیش‌بینی نتیجهٔ داوطلب دیگری نیست.",
  };
}

export const phase13CaseStudies: readonly Phase13CaseStudy[] = phase13RawCaseStudies.map((page) => ({
  ...page,
  sections: [
    phase13CaseStudyMetricSection(page),
    phase13ConflictOfInterestDisclosure,
    ...page.sections,
  ],
}));
export const phase13Pages = [...phase13DecisionPages, ...phase13CaseStudies] as const;

export const phase13DecisionSlugs = phase13DecisionPages.map((page) => page.slug);
export const phase13CaseStudySlugs = phase13CaseStudies.map((page) => page.slug);
export const phase13Slugs = [...phase13DecisionSlugs, ...phase13CaseStudySlugs] as const;

export function resolvePhase13Sources(page: Phase13Page): Phase13Source[] {
  return page.sourceIds.map((sourceId) => {
    const source = phase13Sources[sourceId];
    if (!source) throw new Error(`Unknown Phase 13 source: ${sourceId} (${page.slug})`);
    return { ...source };
  });
}

export function findPhase13DecisionPage(slug: string): Phase13DecisionPage | undefined {
  return phase13DecisionPages.find((page) => page.slug === slug);
}

export function findPhase13CaseStudy(slug: string): Phase13CaseStudy | undefined {
  return phase13CaseStudies.find((page) => page.slug === slug);
}

export function findPhase13Page(slug: string): Phase13Page | undefined {
  return findPhase13DecisionPage(slug) ?? findPhase13CaseStudy(slug);
}
