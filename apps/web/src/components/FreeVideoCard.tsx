import { subjects } from "../content/editorial";
import { Glyph, SUBJECT_TONE, SubjectGlyph } from "./SubjectIcon";

/** The public projection of a free external lecture, as `/resources?kind=VIDEO` returns it. */
export interface FreeVideo {
  slug: string;
  title: string;
  summary: string;
  externalUrl: string | null;
  subjectCodes: string[];
  sources?: { source?: { publisher?: string } }[];
}

/** Instructor name after the dash in a free-lecture title. */
export function lectureInstructor(title: string) {
  const [, instructor] = title.split("—");
  return instructor?.trim() ?? null;
}

export function lectureSubject(video: FreeVideo) {
  return subjects.find((subject) => video.subjectCodes.includes(subject.slug));
}

/**
 * One free lecture series. The whole card is the outbound link: the videos are
 * the publisher's, and their terms allow linking only, so the card never
 * plays or embeds anything here -- it sends the student to the course page.
 */
export function FreeVideoCard({ video }: { video: FreeVideo & { externalUrl: string } }) {
  const subject = lectureSubject(video);
  const tone = SUBJECT_TONE[subject?.slug ?? ""] ?? "teal";
  const instructor = lectureInstructor(video.title);
  const publisher = video.sources?.[0]?.source?.publisher;
  return (
    <a href={video.externalUrl} target="_blank" rel="noopener noreferrer" className="h-video">
      <div className={`h-video-thumb h-t-${tone}`}>
        <SubjectGlyph slug={subject?.slug ?? ""} className="h-video-glyph" />
        <span className="h-play">
          <Glyph name="play" />
        </span>
      </div>
      <div className="h-video-body">
        <span className="h-video-subject">{subject?.title ?? "ویدیوی آموزشی"}</span>
        <h3>{instructor ?? video.title}</h3>
        <p>{video.summary}</p>
        <span className="h-video-src">{publisher ?? "لینک به سایت ناشر"} ↗</span>
      </div>
    </a>
  );
}
