export type ProducerType = "external_ai" | "human";

export interface Provenance {
  producer_type: ProducerType;
  producer_name?: string;
  producer_version?: string;
  source_artifact: string;
  generated_at?: string;
  checksum?: string;
}

export interface Asset {
  media_key: string;
  filename: string;
  mime_type: string;
  checksum: string;
  width?: number;
  height?: number;
}

export type ArticleBlock =
  | { type: "text"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "quote"; text: string; cite?: string }
  | { type: "image"; media_key: string; alt?: string; caption?: string }
  | { type: "table"; headers?: string[]; rows: string[][] }
  | { type: "latex"; latex: string };

export interface ArticleV1 {
  schema_version: "article.v1";
  external_id: string;
  title: string;
  slug: string;
  summary: string;
  content_blocks: ArticleBlock[];
  taxonomy: { major: string[]; tags?: string[] };
  source?: { url?: string; page?: number };
  assets?: Asset[];
  provenance: Provenance;
  review_status: "draft" | "in_review" | "approved" | "rejected";
}

export type ArticleContentTypeV2 = "article" | "guide" | "news" | "case_study";

export interface ArticleV2Source {
  source_external_id: string;
  relation:
    | "DEFINES"
    | "SUPPORTS"
    | "DERIVED_FROM"
    | "TRANSLATION_OF"
    | "ANSWER_KEY_FOR"
    | "CORRECTS"
    | "SUPERSEDES";
  locator?: string;
  claim?: string;
  order?: number;
}

export interface ArticleLinkGroupBlock {
  type: "link_group";
  items: { label: string; href: string }[];
}

export interface ArticleV2 {
  schema_version: "article.v2";
  external_id: string;
  content_type: ArticleContentTypeV2;
  title: string;
  slug: string;
  summary: string;
  quick_answer: string;
  content_blocks: (ArticleBlock | ArticleLinkGroupBlock)[];
  taxonomy: {
    major: string[];
    tags?: string[];
    degrees: ("master" | "phd")[];
    fields: string[];
    subject_codes: string[];
    topic_codes: string[];
  };
  seo: { title: string; description: string };
  validity: {
    exam_year?: number;
    time_sensitive: boolean;
    source_checked_at?: string;
    review_due_at?: string;
  };
  sources: ArticleV2Source[];
  editorial?: { author_slug?: string };
  assets?: Asset[];
  provenance: Provenance;
  review_status: "draft" | "in_review" | "approved" | "rejected";
}

export type ArticleContract = ArticleV1 | ArticleV2;

export interface ReportCardV1 {
  schema_version: "report-card.v1";
  external_id: string;
  anonymous_id: string;
  exam_year: number;
  degree: "master" | "phd";
  field: string;
  quota: string;
  subject_scores: { subject_code: string; percent: number }[];
  rank: { value: number; scope: "national" | "quota" | "field" };
  admissions: { program_code: string; status: "accepted" | "rejected" | "waitlisted" }[];
  provenance: Provenance;
}

export type QuestionBlock =
  | { type: "text"; text: string }
  | { type: "latex"; latex: string }
  | { type: "image"; media_key: string; alt?: string }
  | { type: "table"; headers?: string[]; rows: string[][] }
  | { type: "chart"; media_key: string; caption?: string };

export interface QuestionOption {
  number: 1 | 2 | 3 | 4;
  blocks: QuestionBlock[];
}

export interface QuestionV1 {
  schema_version: "question.v1";
  external_id: string;
  exam: { degree: "master" | "phd"; major: string; year: number };
  subject_code: string;
  topic_codes: string[];
  stem_blocks: QuestionBlock[];
  options: QuestionOption[];
  correct_option: 1 | 2 | 3 | 4;
  solution_blocks: QuestionBlock[];
  assets?: Asset[];
  source?: { page?: number; question_number?: number };
  provenance: Provenance;
}
