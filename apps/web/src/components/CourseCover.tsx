import { API_URL } from "../lib/api";
import { SubjectGlyph } from "./SubjectIcon";
import "./course-cover.css";

/**
 * A course's cover: the image the admin uploaded for it (owner, 2026-10-14:
 * covers are designed outside the site and uploaded per course), or, until
 * there is one, a plain cover in the subject's colour with the subject's name
 * and a large faint mark. It fills its parent, which sets the size and the
 * colour (--c1/--c2).
 */
export function CourseCover({
  coverUrl,
  subject,
  label,
  className,
}: {
  coverUrl?: string | null;
  subject: string | null;
  /** What the plain cover says: the subject, or the course's short title. */
  label: string;
  className?: string;
}) {
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`cc-photo ${className ?? ""}`} src={`${API_URL}${coverUrl}`} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className={`cc-plain ${className ?? ""}`}>
      <SubjectGlyph slug={subject ?? ""} className="cc-mark" />
      <span className="cc-name">{label}</span>
    </span>
  );
}
