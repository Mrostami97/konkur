import { SUBJECT_GLYPH, SUBJECT_TONE } from "../../components/SubjectIcon";
import { subjects } from "../../content/editorial";
import type { CatalogCourse } from "./catalog";

/**
 * The subject a course teaches, for its glyph, colour and label: the linked
 * subject when there is one, otherwise the longest subject slug inside the
 * course's own slug ("theory-of-automata-and-computation" → "automata").
 */
export function courseSubject(course: Pick<CatalogCourse, "slug" | "subject">): string | null {
  if (course.subject?.code && SUBJECT_GLYPH[course.subject.code]) return course.subject.code;
  const match = Object.keys(SUBJECT_GLYPH)
    .filter((slug) => course.slug.includes(slug))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

export function courseTone(course: Pick<CatalogCourse, "slug" | "subject">) {
  const subject = courseSubject(course);
  return (subject && SUBJECT_TONE[subject]) || "teal";
}

export function courseSubjectTitle(course: Pick<CatalogCourse, "slug" | "subject">): string | null {
  if (course.subject?.title) return course.subject.title;
  const slug = courseSubject(course);
  return subjects.find((subject) => subject.slug === slug)?.title ?? null;
}
