import tree from "../content/syllabus-tree.json";

/**
 * The 1406 syllabus as the bank's topic tree (subject → chapter → topic), the
 * same file the question import places questions with
 * (content/import-packages/questions/taxonomy-1406.mjs), so a title shown on a
 * question is always the one it was filed under.
 */
export interface SyllabusTopic {
  code: string;
  title: string;
}

export interface SyllabusChapter {
  code: string;
  title: string;
  /** Topics the 1406 list dropped, kept for past exams. */
  offSyllabus?: boolean;
  topics: SyllabusTopic[];
}

export const SYLLABUS = tree as Record<string, SyllabusChapter[]>;

/** Courses the 1406 exam dropped; their questions stay in the bank, marked so. */
export const OUTSIDE_1406_SUBJECTS: Record<string, string> = {
  "general-math": "ریاضی عمومی",
  "engineering-math": "ریاضیات مهندسی",
  signals: "سیگنال‌ها و سیستم‌ها",
  "digital-electronics": "الکترونیک دیجیتال",
  management: "اصول و مبانی مدیریت",
};

/** Where a topic code sits: its chapter and topic, or null when unknown. */
export function topicPlace(subjectCode: string, topicCode: string | undefined) {
  if (!topicCode) return null;
  for (const chapter of SYLLABUS[subjectCode] ?? []) {
    const topic = chapter.topics.find((item) => item.code === topicCode);
    if (topic) return { chapter, topic };
  }
  return null;
}

/** A chapter's topic codes, to filter the bank by the whole chapter. */
export function chapterTopicCodes(subjectCode: string, chapterCode: string): string[] {
  return SYLLABUS[subjectCode]?.find((chapter) => chapter.code === chapterCode)?.topics.map((topic) => topic.code) ?? [];
}
