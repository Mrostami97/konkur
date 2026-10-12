/**
 * Lesson notes: the articles that teach a topic of a subject (with worked
 * konkur tests), as opposed to the data, admissions and planning articles.
 * They keep their /articles/<slug> addresses but are listed on their own page,
 * grouped by subject, so a student studying a subject finds them in one place.
 *
 * Import-free on purpose: the web tests load modules without the app's paths.
 */
export const LESSON_NOTES_PATH = "/lesson-notes";
export const LESSON_NOTES_LABEL = "درس‌نامه‌ها";

/** An article tagged with one of these is a lesson note. */
export const LESSON_NOTE_TAGS = ["درس‌نامه", "حل تست"];

export function isLessonNote(article: { taxonomyTags?: string[]; contentType?: string | null }): boolean {
  if (article.contentType === "GUIDE") return false;
  return (article.taxonomyTags ?? []).some((tag) => LESSON_NOTE_TAGS.includes(tag));
}

/** Every string in the content blocks, for a word count. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => key !== "type" && key !== "media_key" && key !== "href")
      .map(([, inner]) => textOf(inner))
      .join(" ");
  }
  return "";
}

/** Persian prose reads at about 200 words a minute; tables slow it a little. */
export function readingMinutes(contentBlocks: unknown): number {
  const words = textOf(contentBlocks).split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}
