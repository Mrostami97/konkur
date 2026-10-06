import Link from "next/link";
import { courseFormat, courseShortTitle, type CourseCatalogItem } from "../app/courses/catalog";
import { coursePublishers, courseSubject, courseSubjectTitle, courseTone } from "../app/courses/course-visual";
import { CourseArt } from "./CourseArt";
import { toPersianDigits } from "../lib/format";
import { Glyph } from "./SubjectIcon";
import "./course-card.css";

/**
 * One course in the catalogue and on the homepage: a cover in the subject's
 * colour with its publisher set inside a drawing of the subject, what kind
 * of course it is, how much is inside, who publishes it, and the price. The whole card is one link (the title's).
 */
export function CourseCard({ item, headingLevel = 3 }: { item: CourseCatalogItem; headingLevel?: 2 | 3 }) {
  const { course } = item;
  const subject = courseSubject(course);
  const subjectTitle = courseSubjectTitle(course);
  const format = courseFormat(course);
  const publishers = coursePublishers(course);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const facts = [
    course.moduleCount ? `${toPersianDigits(course.moduleCount)} فصل` : null,
    course.lessonCount ? `${toPersianDigits(course.lessonCount)} درس` : null,
  ].filter(Boolean);

  return (
    <article className="ccd" data-tone={courseTone(course)} data-format={format === "حل تست" ? "tests" : "lessons"}>
      <div className="ccd-cover" aria-hidden="true">
        <span className="ccd-grid" />
        <CourseArt subject={subject} tests={format === "حل تست"} avatar={publishers[0].avatarUrl} uid={course.slug} className="ccd-art" />
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

        <p className="ccd-teachers">
          <span className="ccd-avatars" aria-hidden="true">
            {publishers.slice(0, 3).map((person) =>
              person.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={person.displayName} src={person.avatarUrl} alt="" width={28} height={28} loading="lazy" />
              ) : (
                <span key={person.displayName}>{person.displayName.slice(0, 1)}</span>
              ),
            )}
          </span>
          <span>ناشر: {publishers.map((person) => person.displayName).join("، ")}</span>
        </p>

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
