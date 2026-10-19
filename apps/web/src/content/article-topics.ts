/**
 * Which 1406 syllabus topics (content/syllabus-tree.json) each lesson note or
 * topic-test article teaches, so a chapter of the chapter-by-chapter bank can
 * point at what to read before its tests. An article whose own `topicCodes`
 * are set (article.v2 import) is matched by those as well; this list covers
 * the ones published before articles carried topic codes.
 */
export const ARTICLE_TOPICS: Record<string, string[]> = {
  // داده‌ساختارها و الگوریتم‌ها
  "amortized-analysis": ["dsa-analysis-amortized"],
  "recurrences-master-theorem": ["dsa-analysis-recurrences", "dsa-analysis-master"],
  "recurrence-relations-konkur-tests": ["dsa-analysis-recurrences", "dsa-analysis-master"],
  "hashing-longest-chain": ["dsa-sorting-hashing"],
  "hashing-konkur-tests": ["dsa-sorting-hashing"],
  "union-find-linear-sorting": ["dsa-advanced-disjoint-sets", "dsa-sorting-linear"],
  "huffman-code-greedy": ["dsa-off-greedy"],
  "np-complete-reductions": ["dsa-off-np", "aut-computability-complexity"],
  // نظریهٔ زبان‌ها و ماشین‌ها
  "regular-languages-dfa-nfa": ["aut-fa-dfa", "aut-fa-nfa", "aut-regular-expressions"],
  "regular-languages-konkur-tests": ["aut-fa-dfa", "aut-fa-nfa", "aut-regular-expressions", "aut-regular-languages"],
  "pumping-lemma": ["aut-regular-props-pumping"],
  "context-free-grammars-pda": ["aut-cfl-grammars", "aut-pda-pda"],
  "turing-machines-decidability": ["aut-computability-tm", "aut-computability-decidability", "aut-computability-halting"],
  // سیستم‌عامل
  "cpu-scheduling": ["os-process-scheduling"],
  "cpu-scheduling-konkur-tests": ["os-process-scheduling"],
  "process-synchronization": ["os-sync-critical", "os-sync-monitors"],
  "deadlock-bankers-algorithm": ["os-sync-deadlock"],
  "deadlock-konkur-tests": ["os-sync-deadlock"],
};

/** A published article as GET /articles lists it (only the fields used here). */
export interface ListedArticle {
  slug: string;
  title: string;
  taxonomyTags?: string[];
  subjectCodes?: string[];
  topicCodes?: string[];
  contentType?: string | null;
}

export interface ReadingLink {
  slug: string;
  title: string;
  /** «درس‌نامه» teaches the topic; «حل تست» works its konkur tests. */
  kind: "lesson" | "tests";
}

function kindOf(article: ListedArticle): ReadingLink["kind"] {
  return (article.taxonomyTags ?? []).includes("درس‌نامه") ? "lesson" : "tests";
}

/** For each chapter, the articles that teach one of its topics, lesson notes first. */
export function readingByChapter(
  articles: ListedArticle[],
  chapters: { code: string; topics: { code: string }[] }[],
): Record<string, ReadingLink[]> {
  const result: Record<string, ReadingLink[]> = {};
  for (const chapter of chapters) {
    const topics = new Set(chapter.topics.map((topic) => topic.code));
    const links = articles
      .filter((article) => [...(article.topicCodes ?? []), ...(ARTICLE_TOPICS[article.slug] ?? [])].some((code) => topics.has(code)))
      .map((article) => ({ slug: article.slug, title: article.title, kind: kindOf(article) }))
      .sort((a, b) => Number(a.kind === "tests") - Number(b.kind === "tests"));
    if (links.length) result[chapter.code] = links;
  }
  return result;
}

/** A subject's year-by-year solution articles («پاسخ تشریحی کنکور …»), newest first. */
export function solutionArticles(articles: ListedArticle[], subjectCode: string): ReadingLink[] {
  return articles
    .filter((article) => (article.subjectCodes ?? []).length === 1 && article.subjectCodes![0] === subjectCode)
    .filter((article) => (article.taxonomyTags ?? []).includes("پاسخ تشریحی"))
    .map((article) => ({ slug: article.slug, title: article.title, kind: "tests" as const }))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}
