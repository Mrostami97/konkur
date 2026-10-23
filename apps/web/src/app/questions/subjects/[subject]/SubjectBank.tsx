"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import type { SyllabusChapter } from "../../../../lib/syllabus";
import { startPractice } from "../../start-practice";
import type { ReadingLink } from "../../../../content/article-topics";

/** GET /questions/chapter-stats: per syllabus topic, questions, worked solutions and questions per exam year. */
export interface ChapterStats {
  years: number[];
  /** The latest konkur in the whole bank, so "recent" means the same years on every subject. */
  latestYear?: number | null;
  topics: Record<string, { n: number; solved: number; byYear: Record<string, number> }>;
}
type Progress = Record<string, { seen: number; right: number }>;

/** How many questions a chapter practice or exam draws. */
const PRACTICE_COUNT = 10;
const EXAM_COUNT = 20;
/** "Recent" means the latest exam years in the bank. */
const RECENT_YEARS = 5;

const fa = (n: number) => toPersianDigits(n);
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * One subject's bank, chapter by chapter in the 1406 syllabus order: each
 * chapter with its number of past tests, its share of the subject, how often it
 * came in the latest exams, how many tests have a worked solution, the
 * signed-in student's progress, its topics, and three ways in: read its tests,
 * practise with the key after each, or sit a timed exam of its own. Chapters
 * dropped from the 1406 syllabus come last, marked as such.
 */
export function SubjectBank({
  code,
  title,
  chapters,
  initialStats,
  reading = {},
  solutions = [],
}: {
  code: string;
  title: string;
  chapters: SyllabusChapter[];
  initialStats: ChapterStats | null;
  /** Per chapter code, the articles that teach its topics. */
  reading?: Record<string, ReadingLink[]>;
  /** The subject's year-by-year solution articles. */
  solutions?: ReadingLink[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState<ChapterStats | null>(initialStats);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ chapter: string; text: string } | null>(null);

  useEffect(() => {
    if (!initialStats) apiFetch<ChapterStats>(`/questions/chapter-stats?subjectCode=${encodeURIComponent(code)}`).then(setStats).catch(() => setStats(null));
    apiFetch<Progress>(`/questions/progress?subjectCode=${encodeURIComponent(code)}`).then(setProgress).catch(() => setProgress(null));
  }, [code, initialStats]);

  // The latest five konkurs (e.g. 1401–1405). A subject whose reviewed questions stop earlier has no
  // recent window, and its frequencies are counted over every year in the bank, labelled so.
  const latest = stats ? stats.latestYear ?? Math.max(0, ...stats.years) : 0;
  const window = latest ? Array.from({ length: RECENT_YEARS }, (_, i) => latest - RECENT_YEARS + 1 + i) : [];
  const hasRecent = Boolean(stats && window.some((y) => Object.values(stats.topics).some((t) => t.byYear[y])));
  const recentYears = hasRecent ? window : [];
  const topic = (topicCode: string) => stats?.topics[topicCode];
  const sumOf = (codes: string[], pick: (t: ChapterStats["topics"][string]) => number) =>
    codes.reduce((sum, c) => sum + (topic(c) ? pick(topic(c)!) : 0), 0);
  const recentOf = (t: ChapterStats["topics"][string]) => recentYears.reduce((sum, y) => sum + (t.byYear[y] ?? 0), 0);
  /** How often a topic comes: in the latest konkurs, or over all years when the subject has none of those. */
  const freqOf = (t: ChapterStats["topics"][string]) => (hasRecent ? recentOf(t) : t.n);
  const freqLabel = hasRecent ? `${fa(RECENT_YEARS)} کنکور اخیر` : "همهٔ سال‌های بانک";

  const ordered = [...chapters.filter((c) => !c.offSyllabus), ...chapters.filter((c) => c.offSyllabus)];
  const rows = ordered.map((chapter) => {
    const codes = chapter.topics.map((t) => t.code);
    return {
      chapter,
      codes,
      total: sumOf(codes, (t) => t.n),
      solved: sumOf(codes, (t) => t.solved),
      recent: sumOf(codes, recentOf),
      freq: sumOf(codes, freqOf),
      perYear: recentYears.map((y) => sumOf(codes, (t) => t.byYear[y] ?? 0)),
      seen: progress ? codes.reduce((s, c) => s + (progress[c]?.seen ?? 0), 0) : 0,
      right: progress ? codes.reduce((s, c) => s + (progress[c]?.right ?? 0), 0) : 0,
    };
  });
  const subjectTotal = rows.reduce((s, r) => s + r.total, 0);
  const subjectSolved = rows.reduce((s, r) => s + r.solved, 0);
  const subjectRecent = rows.reduce((s, r) => s + r.recent, 0);
  const maxPerYear = Math.max(1, ...rows.flatMap((r) => r.perYear));
  // The chapters that carried the most tests in the latest exams (1406 syllabus only).
  const frequent = rows
    .filter((r) => !r.chapter.offSyllabus && r.freq > 0)
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 3);
  const frequentCodes = new Set(frequent.map((r) => r.chapter.code));
  const hotTopics = ordered
    .filter((c) => !c.offSyllabus)
    .flatMap((c) => c.topics.map((t) => ({ ...t, chapter: c.title, recent: topic(t.code) ? freqOf(topic(t.code)!) : 0 })))
    .filter((t) => t.recent > 0)
    .sort((a, b) => b.recent - a.recent)
    .slice(0, 6);
  const suggestion = suggest(rows, progress);
  const here = `/questions/subjects/${code}`;

  async function start(chapter: SyllabusChapter, mode: "feedback" | "exam", topicCodes: string[], total: number) {
    setBusy(`${chapter.code}:${mode}`);
    setMessage(null);
    const count = Math.min(mode === "exam" ? EXAM_COUNT : PRACTICE_COUNT, Math.max(1, total));
    const result = await startPractice({ subjectCode: code, topicCodes, count }, mode, `آزمون فصل ${chapter.title}`, here);
    setBusy(null);
    if ("href" in result) router.push(result.href);
    else setMessage({ chapter: chapter.code, text: result.message });
  }

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker">
            <Link href="/questions">بانک سؤال</Link> › <Link href="/questions/subjects">فصل‌به‌فصل</Link>
          </p>
          <h1>بانک سؤال {title}</h1>
          <p>
            تست‌های کنکور ارشد {title} به ترتیب فصل‌های سرفصل ۱۴۰۶. هر فصل را که خواندی، تست‌هایش را تمرین کن یا از همان فصل آزمون بده.
          </p>
        </div>
      </header>

      <div className="qb-wrap sb-chapters">
        {stats && subjectTotal > 0 && (
          <section className="sb-summary" aria-label="خلاصهٔ بانک این درس">
            <div className="sb-stat">
              <strong className="tnum">{fa(subjectTotal)}</strong>
              <span>تست کنکور</span>
            </div>
            <div className="sb-stat">
              <strong className="tnum">{fa(subjectSolved)}</strong>
              <span>با پاسخ تشریحی</span>
            </div>
            {recentYears.length > 0 && (
              <div className="sb-stat">
                <strong className="tnum">{fa(subjectRecent)}</strong>
                <span>
                  تست در {fa(recentYears.length)} سال اخیر ({fa(recentYears[0])}–{fa(recentYears[recentYears.length - 1])})
                </span>
              </div>
            )}
            {stats.years.length > 0 && (
              <div className="sb-stat">
                <strong className="tnum">{fa(stats.years.length)}</strong>
                <span>سال کنکور، از {fa(stats.years[0])}</span>
              </div>
            )}
          </section>
        )}

        {suggestion && (
          <p className="sb-suggest">
            <span>پیشنهاد برای ادامه:</span> <a href={`#${suggestion.row.chapter.code}`}>{suggestion.row.chapter.title}</a>؛ {suggestion.why}
          </p>
        )}

        {frequent.length > 0 && (
          <section className="sb-hot" aria-labelledby="sb-hot-title">
            <h2 id="sb-hot-title">پرتکرارترین‌ها در {freqLabel}</h2>
            <div className="sb-hot-row">
              {frequent.map((row) => (
                <a key={row.chapter.code} href={`#${row.chapter.code}`} className="sb-chip">
                  {row.chapter.title}
                  <small className="tnum">{fa(row.freq)} تست</small>
                </a>
              ))}
            </div>
            {hotTopics.length > 0 && (
              <ul className="sb-hot-topics">
                {hotTopics.map((t) => (
                  <li key={t.code}>
                    <Link href={`/questions?subject=${encodeURIComponent(code)}&topic=${encodeURIComponent(t.code)}`}>{t.title}</Link>
                    <small className="tnum">{fa(t.recent)} تست{hasRecent ? " اخیر" : ""} · {t.chapter}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {stats && subjectTotal === 0 && (
          <p className="sb-note">
            تست‌های این درس هنوز به فصل‌ها و مبحث‌های سرفصل ۱۴۰۶ نسبت داده نشده‌اند؛ تا آن موقع می‌توانی{" "}
            <Link href={`/questions?subject=${encodeURIComponent(code)}`}>همهٔ تست‌های این درس را در بانک ببینی</Link>.
          </p>
        )}

        {rows.map((row, index) => {
          const { chapter, codes, total, solved, recent, perYear, seen, right } = row;
          const expanded = open === chapter.code;
          return (
            <section
              className="sb-chapter"
              id={chapter.code}
              key={chapter.code}
              data-off={chapter.offSyllabus || undefined}
              data-empty={stats !== null && total === 0 ? true : undefined}
            >
              <div className="sb-chapter-head">
                <span className="sb-n tnum" aria-hidden="true">{chapter.offSyllabus ? "–" : fa(index + 1)}</span>
                <div className="sb-chapter-title">
                  <h2>{chapter.title}</h2>
                  <p className="tnum">
                    {stats ? (total ? `${fa(total)} تست · ${fa(percent(total, subjectTotal))}٪ از تست‌های درس` : "هنوز تستی در این فصل نیامده") : " "}
                    {frequentCodes.has(chapter.code) && <span className="qv-tag">پرتکرار</span>}
                    {chapter.offSyllabus && <span className="qv-tag qv-tag-muted">خارج از سرفصل ۱۴۰۶</span>}
                  </p>
                </div>
                <button type="button" className="sb-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : chapter.code)}>
                  {expanded ? "بستن مبحث‌ها" : `${fa(chapter.topics.length)} مبحث`}
                </button>
              </div>

              {total > 0 && (
                <div className="sb-facts">
                  {recentYears.length > 0 && (
                    <div className="sb-years" aria-label={`تعداد تست این فصل در ${recentYears.length} سال اخیر`}>
                      {recentYears.map((year, i) => (
                        <span key={year} className="sb-year" title={`${fa(year)}: ${fa(perYear[i])} تست`}>
                          <span className="sb-year-bar" style={{ height: `${Math.max(perYear[i] ? 12 : 0, (perYear[i] / maxPerYear) * 100)}%` }} />
                          <small className="tnum">{toPersianDigits(String(year).slice(-2))}</small>
                        </span>
                      ))}
                    </div>
                  )}
                  <ul className="sb-fact-list">
                    {recentYears.length > 0 && <li className="tnum">{recent ? `${fa(recent)} تست در ${fa(recentYears.length)} سال اخیر` : `در ${fa(recentYears.length)} سال اخیر تستی نداشته`}</li>}
                    <li className="tnum">{solved ? `${fa(solved)} تست با پاسخ تشریحی` : "پاسخ تشریحی در راه است"}</li>
                  </ul>
                </div>
              )}

              {reading[chapter.code] && (
                <div className="sb-reading">
                  <span>پیش از تست‌ها بخوان:</span>
                  {reading[chapter.code].map((link) => (
                    <Link key={link.slug} href={`/articles/${link.slug}`} data-kind={link.kind}>
                      {link.title}
                    </Link>
                  ))}
                </div>
              )}

              {progress && total > 0 && (
                <div className="sb-progress" aria-label={`پیشرفت تو در این فصل: ${seen} از ${total} تست دیده، ${right} درست`}>
                  <div className="sb-bar">
                    <span style={{ width: `${Math.min(100, (right / total) * 100)}%` }} data-kind="right" />
                    <span style={{ width: `${Math.min(100, ((seen - right) / total) * 100)}%` }} data-kind="seen" />
                  </div>
                  <small className="tnum">
                    {seen ? `${fa(seen)} از ${fa(total)} دیده‌ای، ${fa(right)} تا را بار آخر درست زدی` : "هنوز از این فصل تستی نزده‌ای"}
                  </small>
                </div>
              )}

              {expanded && (
                <ul className="sb-topics">
                  {chapter.topics.map((t) => {
                    const s = topic(t.code);
                    const recentTopic = s ? recentOf(s) : 0;
                    return (
                      <li key={t.code}>
                        <Link href={`/questions?subject=${encodeURIComponent(code)}&topic=${encodeURIComponent(t.code)}`}>{t.title}</Link>
                        <small className="tnum">
                          {fa(s?.n ?? 0)} تست
                          {recentTopic ? ` · ${fa(recentTopic)} اخیر` : ""}
                          {progress?.[t.code]?.seen ? ` · ${fa(progress[t.code].seen)} دیده` : ""}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              )}

              {total > 0 && (
                <div className="sb-actions">
                  <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions?subject=${encodeURIComponent(code)}&chapter=${encodeURIComponent(chapter.code)}`}>
                    تست‌های این فصل
                  </Link>
                  <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" disabled={busy !== null} onClick={() => void start(chapter, "feedback", codes, total)}>
                    {busy === `${chapter.code}:feedback` ? "در حال آماده‌سازی…" : "تمرین تست‌به‌تست"}
                  </button>
                  <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" disabled={busy !== null} onClick={() => void start(chapter, "exam", codes, total)}>
                    {busy === `${chapter.code}:exam` ? "در حال ساختن…" : "آزمون زمان‌دار"}
                  </button>
                </div>
              )}
              {message?.chapter === chapter.code && <p className="xb-message" role="alert">{message.text}</p>}
            </section>
          );
        })}

        <nav className="sb-more" aria-label="ادامهٔ مطالعهٔ این درس">
          <Link href={`/subjects/${code}`}>درس‌نامه، منابع و تست‌های نمونهٔ رایگان {title} ←</Link>
          {solutions.map((link) => (
            <Link key={link.slug} href={`/articles/${link.slug}`}>{link.title} ←</Link>
          ))}
          <Link href={`/questions/build?subject=${encodeURIComponent(code)}`}>آزمون‌ساز: آزمون دلخواه از چند فصل ←</Link>
          <Link href="/questions/subjects">بانک فصل‌به‌فصل درس‌های دیگر ←</Link>
        </nav>
      </div>
    </main>
  );
}

type Row = { chapter: SyllabusChapter; total: number; freq: number; seen: number; right: number };

/**
 * Where a signed-in student should go next: the weakest chapter they have
 * worked on (enough answers to judge), else the most frequent 1406 chapter
 * they have not started. Nothing for a visitor without progress.
 */
function suggest(rows: Row[], progress: Progress | null): { row: Row; why: string } | null {
  if (!progress) return null;
  const inSyllabus = rows.filter((r) => !r.chapter.offSyllabus && r.total > 0);
  const tried = inSyllabus.filter((r) => r.seen >= 5);
  if (tried.length) {
    const weakest = [...tried].sort((a, b) => a.right / a.seen - b.right / b.seen)[0];
    const rate = Math.round((weakest.right / weakest.seen) * 100);
    if (rate < 70) return { row: weakest, why: `فقط ${fa(rate)}٪ تست‌هایی که از این فصل زدی درست بوده؛ دوباره مرورش کن.` };
  }
  const untouched = inSyllabus.filter((r) => r.seen === 0).sort((a, b) => b.freq - a.freq)[0];
  if (untouched) return { row: untouched, why: untouched.freq ? `از فصل‌های پرتکرار است و هنوز از آن تستی نزده‌ای.` : "هنوز از این فصل تستی نزده‌ای." };
  return null;
}
