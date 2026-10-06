import Link from "next/link";
import { courseFormat, courseShortTitle, type CourseCatalogItem } from "../app/courses/catalog";
import { courseSubject, courseSubjectTitle, courseTone } from "../app/courses/course-visual";
import { toPersianDigits } from "../lib/format";
import { Glyph, SubjectGlyph } from "./SubjectIcon";
import "./course-card.css";

/**
 * One course in the catalogue and on the homepage: a cover in the subject's
 * colour with its mark, what kind of course it is, how much is inside, who
 * teaches it, and the price. The whole card is one link (the title's).
 */
export function CourseCard({ item, headingLevel = 3 }: { item: CourseCatalogItem; headingLevel?: 2 | 3 }) {
  const { course } = item;
  const subject = courseSubject(course);
  const subjectTitle = courseSubjectTitle(course);
  const format = courseFormat(course);
  const instructors = course.instructors ?? [];
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const facts = [
    course.moduleCount ? `${toPersianDigits(course.moduleCount)} فصل` : null,
    course.lessonCount ? `${toPersianDigits(course.lessonCount)} درس` : null,
  ].filter(Boolean);

  return (
    <article className="ccd" data-tone={courseTone(course)} data-format={format === "حل تست" ? "tests" : "lessons"}>
      <div className="ccd-cover" aria-hidden="true">
        <span className="ccd-grid" />
        {subject ? <SubjectGlyph slug={subject} className="ccd-glyph" /> : <Glyph name="book" className="ccd-glyph" />}
        <span className="ccd-format">
          <Glyph name={format === "حل تست" ? "target" : "book"} className="ccd-format-icon" />
          {format}
        </span>
        {course.hasVideo && (
          <span className="ccd-video">
            <Glyph name="play" className="ccd-format-icon" />
            ویدیویی
          </span>
        )}
      </div>

      <div className="ccd-body">
        {subjectTitle && <p className="ccd-subject">{subjectTitle}</p>}
        <Heading className="ccd-title">
          <Link href={item.href}>{courseShortTitle(course.title)}</Link>
        </Heading>
        <p className="ccd-desc">{course.description}</p>

        <ul className="ccd-facts">
          {facts.length > 0 ? facts.map((fact) => <li key={fact}>{fact}</li>) : <li>سرفصل‌ها در حال انتشار</li>}
          {(course.previewCount ?? 0) > 0 && <li className="ccd-free">{toPersianDigits(course.previewCount!)} درس نمونهٔ رایگان</li>}
        </ul>

        {instructors.length > 0 && (
          <p className="ccd-teachers">
            <span className="ccd-avatars" aria-hidden="true">
              {instructors.slice(0, 3).map((person) =>
                person.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={person.slug} src={person.avatarUrl} alt="" width={28} height={28} loading="lazy" />
                ) : (
                  <span key={person.slug}>{person.displayName.slice(0, 1)}</span>
                ),
              )}
            </span>
            <span>مدرس: {instructors.map((person) => person.displayName).join("، ")}</span>
          </p>
        )}

        <div className="ccd-foot">
          <strong className={item.hasPrice ? "ccd-price tnum" : "ccd-price ccd-price-soon"}>{item.priceLabel}</strong>
          <span className="ccd-cta" aria-hidden="true">
            {item.ctaLabel}
            <span className="ccd-arrow">←</span>
          </span>
        </div>
      </div>
    </article>
  );
}
