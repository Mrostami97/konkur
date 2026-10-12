import type { Metadata } from "next";
import Link from "next/link";
import type { PublicArticleRecord } from "../../components/PublicContent";
import { StructuredData } from "../../components/StructuredData";
import { Glyph, SUBJECT_TONE, SubjectGlyph } from "../../components/SubjectIcon";
import { EmptyState } from "../../components/ui";
import { subjects } from "../../content/editorial";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { isLessonNote, LESSON_NOTE_TAGS, LESSON_NOTES_LABEL, LESSON_NOTES_PATH, readingMinutes } from "../../lib/lesson-notes";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import "../articles/articles.css";
import "./lesson-notes.css";

export const metadata: Metadata = pageMetadata({
  title: "درس‌نامه‌های کنکور ارشد کامپیوتر، درس‌به‌درس",
  description: "درس‌نامه‌های داده‌ساختارها و الگوریتم‌ها، نظریهٔ زبان‌ها و ماشین‌ها و سیستم عامل؛ هر مبحث با مثال، تست کنکور و پاسخ تشریحی.",
  path: LESSON_NOTES_PATH,
});

interface NoteCard {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  minutes: number;
}

interface SubjectShelf {
  slug: string;
  title: string;
  notes: NoteCard[];
}

/**
 * Lesson notes grouped by subject, in the order the subject map lists the
 * subjects. The notes keep their /articles addresses; only the listing moved
 * here, out of the general article library.
 */
export default async function LessonNotesPage() {
  let unavailable = false;
  let published: PublicArticleRecord[] = [];
  try {
    published = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
  } catch {
    unavailable = true;
  }

  const notes = published
    .filter(isLessonNote)
    .sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""));
  const subjectTitles = new Set(subjects.map((subject) => subject.title));
  const card = (article: PublicArticleRecord): NoteCard => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    // The topic words only: not the «درس‌نامه» tag or the subject's own name.
    topics: article.taxonomyTags.filter((tag) => !LESSON_NOTE_TAGS.includes(tag) && !subjectTitles.has(tag)).slice(0, 3),
    minutes: readingMinutes(article.contentBlocks),
  });

  const shelves: SubjectShelf[] = subjects
    .map((subject) => ({
      slug: subject.slug,
      title: subject.title,
      notes: notes.filter((note) => note.subjectCodes[0] === subject.slug).map(card),
    }))
    .filter((shelf) => shelf.notes.length > 0);
  const known = new Set(shelves.map((shelf) => shelf.slug));
  const other = notes.filter((note) => !known.has(note.subjectCodes[0] ?? "")).map(card);
  if (other.length > 0) shelves.push({ slug: "other", title: "درس‌های دیگر", notes: other });

  const listSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: LESSON_NOTES_LABEL,
    url: absoluteUrl(LESSON_NOTES_PATH),
    inLanguage: "fa-IR",
    hasPart: notes.map((note) => ({ "@type": "Article", headline: note.title, url: absoluteUrl(`/articles/${note.slug}`) })),
  };

  return (
    <main className="al ln">
      {notes.length > 0 && <StructuredData data={listSchema} />}
      <header className="al-hero">
        <div className="al-wrap">
          <nav className="ln-crumbs" aria-label="مسیر صفحه">
            <Link href="/">خانه</Link>
            <span aria-hidden>/</span>
            <span>{LESSON_NOTES_LABEL}</span>
          </nav>
          <p className="al-kicker">درس‌به‌درس، مبحث‌به‌مبحث</p>
          <h1>درس‌نامه‌ها</h1>
          <p className="al-lede">
            هر درس‌نامه یک مبحث را از تعریف تا تست کنکور پیش می‌برد: مفهوم، مثال حل‌شده، دام‌های رایج و چند تست واقعی با پاسخ تشریحی.
            درس را انتخاب کن و از اولین مبحث شروع کن.
          </p>
          {shelves.length > 0 && (
            <nav className="ln-jump" aria-label="درس‌ها">
              {shelves.map((shelf) => (
                <a href={`#${shelf.slug}`} key={shelf.slug} data-tone={SUBJECT_TONE[shelf.slug] ?? "teal"}>
                  <SubjectGlyph slug={shelf.slug} />
                  {shelf.title}
                  <span>{toPersianDigits(shelf.notes.length)}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      <div className="al-wrap ln-body">
        {unavailable && (
          <div className="ds-alert ds-alert-warning">
            <span>
              <strong>درس‌نامه‌ها الان باز نمی‌شوند.</strong> چند دقیقهٔ دیگر دوباره سر بزن.
            </span>
          </div>
        )}

        {!unavailable && shelves.length === 0 && (
          <EmptyState
            title="هنوز درس‌نامه‌ای اینجا نیست"
            description="تا آن موقع، تست‌های هر مبحث در بانک سؤال هست."
            action={<Link className="ds-btn ds-btn-primary" href="/questions">رفتن به بانک سؤال</Link>}
          />
        )}

        {shelves.map((shelf) => (
          <section className="ln-subject" id={shelf.slug} key={shelf.slug} data-tone={SUBJECT_TONE[shelf.slug] ?? "teal"} aria-labelledby={`${shelf.slug}-title`}>
            <header className="ln-subject-head">
              <span className="ln-subject-icon"><SubjectGlyph slug={shelf.slug} /></span>
              <div>
                <h2 id={`${shelf.slug}-title`}>{shelf.title}</h2>
                <p>{toPersianDigits(shelf.notes.length)} درس‌نامه</p>
              </div>
              {shelf.slug !== "other" && (
                <span className="ln-subject-links">
                  <Link href={`/subjects/${shelf.slug}`}>صفحهٔ درس</Link>
                  <Link href={`/questions?subject=${shelf.slug}`}>تست‌های این درس</Link>
                </span>
              )}
            </header>
            <ol className="ln-list">
              {shelf.notes.map((note, index) => (
                <li key={note.slug}>
                  <Link href={`/articles/${note.slug}`} className="al-card ln-card">
                    <span className="ln-card-step">{toPersianDigits(index + 1)}</span>
                    <h3 className="al-card-title">{note.title}</h3>
                    <p className="al-card-summary">{note.summary}</p>
                    {note.topics.length > 0 && (
                      <ul className="al-card-tags">
                        {note.topics.map((topic) => <li key={topic}>{topic}</li>)}
                      </ul>
                    )}
                    <span className="al-card-meta">
                      <span>خواندن درس‌نامه ←</span>
                      <span className="al-card-time">
                        <Glyph name="pace" />
                        {toPersianDigits(note.minutes)} دقیقه
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
