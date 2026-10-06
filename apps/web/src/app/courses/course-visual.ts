import { OWNER_NAME } from "../../components/OwnerByline";
import { SUBJECT_GLYPH, SUBJECT_TONE } from "../../components/SubjectIcon";
import { subjects } from "../../content/editorial";
import type { CatalogCourse, CourseInstructor } from "./catalog";

/** A course's publisher when none is set on it: the site's owner. */
export const OWNER_PUBLISHER: CourseInstructor & { href: string } = {
  slug: "",
  displayName: OWNER_NAME,
  avatarUrl: "/brand/mohammad-rostami-avatar.webp",
  href: "/about",
};

/**
 * Who publishes a course, for its cover and its page: the published teacher
 * profiles set on it, or the owner, who publishes every course that has none
 * (owner, 2026-10-06; courses by other publishers get their own profile).
 */
export function coursePublishers(course: Pick<CatalogCourse, "instructors">): (CourseInstructor & { href: string })[] {
  const set = (course.instructors ?? []).map((person) => ({ ...person, href: `/authors/${person.slug}` }));
  return set.length > 0 ? set : [OWNER_PUBLISHER];
}

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
