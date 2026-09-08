import phase11RawCorpus from "./phase11-corpus.json";

export type Phase11SubjectSlug = keyof typeof phase11RawCorpus.subjects;
export type Phase11MasterGuideSlug = keyof typeof phase11RawCorpus.tracks;

export type Phase11MasterCollectionCode = "1277" | "1276" | "1209";
export type Phase11Date = `${string}/${string}/${string}`;

export interface Phase11Source {
  readonly kind: "official-notice" | "academic-syllabus" | "owned-archive";
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly publishedAt?: Phase11Date;
  readonly checkedAt: Phase11Date;
}

export interface Phase11ExamBundle {
  readonly key: string;
  readonly title: string;
  readonly officialSubjects: readonly string[];
  readonly coefficient?: 0 | 1 | 2 | 3 | 4;
  readonly coefficientsByCode?: Readonly<Record<"1" | "2", 0 | 1 | 2 | 3 | 4>>;
  readonly subjectSlugs: readonly Phase11SubjectSlug[];
  readonly note?: string;
}

export interface Phase11MasterTrack {
  readonly guideSlug: Phase11MasterGuideSlug;
  readonly collectionCode: Phase11MasterCollectionCode;
  readonly officialName: string;
  readonly coefficientCodes?: readonly ("1" | "2")[];
  readonly quickAnswer: string;
  readonly reviewedAt: Phase11Date;
  readonly bundles: readonly Phase11ExamBundle[];
}

export interface Phase11LearningPathItem {
  readonly title: string;
  readonly detail: string;
}

export type Phase11LearningPath =
  | readonly [Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem]
  | readonly [Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem]
  | readonly [Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem, Phase11LearningPathItem];

export interface Phase11Cta {
  readonly label: string;
  readonly href: `/${string}`;
}

export interface Phase11SubjectContent {
  readonly slug: Phase11SubjectSlug;
  readonly quickAnswer: string;
  readonly reviewedAt: Phase11Date;
  readonly learningPath: Phase11LearningPath;
  readonly commonMistakes: readonly [string, string, string];
  readonly sources: readonly [Phase11Source, ...Phase11Source[]];
  readonly ctas: {
    readonly internal: Phase11Cta;
    readonly resource: Phase11Cta;
  };
}

export type Phase11SubjectContentMap = {
  readonly [Slug in Phase11SubjectSlug]: Phase11SubjectContent & { readonly slug: Slug };
};

export type Phase11MasterTrackMap = {
  readonly [Slug in Phase11MasterGuideSlug]: Phase11MasterTrack & { readonly guideSlug: Slug };
};

export interface Phase11Corpus {
  readonly officialSource: Phase11Source;
  readonly guideSlugs: readonly Phase11MasterGuideSlug[];
  readonly subjectSlugs: readonly Phase11SubjectSlug[];
  readonly syllabSources: Readonly<Partial<Record<Phase11SubjectSlug, Phase11Source>>>;
  readonly ownedSources: Readonly<Partial<Record<Phase11SubjectSlug, Phase11Source>>>;
  readonly tracks: Phase11MasterTrackMap;
  readonly subjects: Phase11SubjectContentMap;
}

// JSON is the runtime source of truth so plain Node.js tests can inspect it.
// The cast is intentionally centralized here; consumers only see the strict corpus types above.
export const phase11Corpus = phase11RawCorpus as unknown as Phase11Corpus;

export const sanjeshMaster1406NoticeSource = phase11Corpus.officialSource;
export const phase11MasterGuideSlugs = phase11Corpus.guideSlugs;
export const phase11SubjectSlugs = phase11Corpus.subjectSlugs;
export const phase11SyllabSources = phase11Corpus.syllabSources;
export const phase11OwnedSources = phase11Corpus.ownedSources;
export const phase11MasterTracks = phase11Corpus.tracks;
export const phase11SubjectContent = phase11Corpus.subjects;

export function phase11DateIso(value: Phase11Date): string {
  const normalized = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const match = normalized.match(/^1405\/06\/(\d{1,2})$/);
  if (!match) return value;
  // 1 Shahrivar 1405 is 23 August 2026. Date.UTC safely rolls into September.
  return new Date(Date.UTC(2026, 7, 22 + Number(match[1]))).toISOString().slice(0, 10);
}
