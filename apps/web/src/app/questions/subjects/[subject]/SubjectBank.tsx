"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import type { SyllabusChapter } from "../../../../lib/syllabus";
import { startPractice } from "../../start-practice";

interface Counts { subjects: Record<string, number>; topics: Record<string, number> }
type Progress = Record<string, { seen: number; right: number }>;

/** How many questions a chapter practice or exam draws. */
const PRACTICE_COUNT = 10;
const EXAM_COUNT = 20;

/**
 * One subject's bank, chapter by chapter in the 1406 syllabus order: each
 * chapter with its number of past tests, the signed-in student's progress on
 * it, its topics, and three ways in: read its tests, practise with the key after
 * each, or sit a timed exam of its own. Chapters dropped from the 1406
 * syllabus come last, marked as such.
 */
export function SubjectBank({ code, title, chapters }: { code: string; title: string; chapters: SyllabusChapter[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ chapter: string; text: string } | null>(null);

  useEffect(() => {
    apiFetch<Counts>(`/questions/counts?subjectCode=${encodeURIComponent(code)}`).then(setCounts).catch(() => setCounts(null));
    apiFetch<Progress>(`/questions/progress?subjectCode=${encodeURIComponent(code)}`).then(setProgress).catch(() => setProgress(null));
  }, [code]);

  const topicCount = (topic: string) => counts?.topics[topic] ?? 0;
  const ordered = [...chapters.filter((c) => !c.offSyllabus), ...chapters.filter((c) => c.offSyllabus)];
  const here = `/questions/subjects/${code}`;

  async function start(chapter: SyllabusChapter, mode: "feedback" | "exam", topicCodes: string[]) {
    setBusy(`${chapter.code}:${mode}`);
    setMessage(null);
    const total = topicCodes.reduce((sum, topic) => sum + topicCount(topic), 0);
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
            {counts ? `${toPersianDigits(counts.subjects[code] ?? 0)} تست کنکور، ` : ""}
            فصل‌به‌فصل به ترتیب سرفصل ۱۴۰۶. هر فصل را که خواندی، تست‌هایش را تمرین کن یا از همان فصل آزمون بده.
          </p>
        </div>
      </header>

      <div className="qb-wrap sb-chapters">
        {counts && (counts.subjects[code] ?? 0) > 0 && Object.keys(counts.topics).length === 0 && (
          <p className="sb-note">
            تست‌های این درس هنوز به فصل‌ها و مبحث‌های سرفصل ۱۴۰۶ نسبت داده نشده‌اند؛ تا آن موقع می‌توانی{" "}
            <Link href={`/questions?subject=${encodeURIComponent(code)}`}>همهٔ تست‌های این درس را در بانک ببینی</Link>.
          </p>
        )}
        {ordered.map((chapter, index) => {
          const codes = chapter.topics.map((topic) => topic.code);
          const total = codes.reduce((sum, topic) => sum + topicCount(topic), 0);
          const seen = progress ? codes.reduce((sum, topic) => sum + (progress[topic]?.seen ?? 0), 0) : 0;
          const right = progress ? codes.reduce((sum, topic) => sum + (progress[topic]?.right ?? 0), 0) : 0;
          const expanded = open === chapter.code;
          return (
            <section className="sb-chapter" key={chapter.code} data-off={chapter.offSyllabus || undefined} data-empty={counts !== null && total === 0 ? true : undefined}>
              <div className="sb-chapter-head">
                <span className="sb-n tnum" aria-hidden="true">{chapter.offSyllabus ? "–" : toPersianDigits(index + 1)}</span>
                <div className="sb-chapter-title">
                  <h2>{chapter.title}</h2>
                  <p className="tnum">
                    {counts ? (total ? `${toPersianDigits(total)} تست` : "هنوز تستی در این فصل نیامده") : " "}
                    {chapter.offSyllabus && <span className="qv-tag qv-tag-muted">خارج از سرفصل ۱۴۰۶</span>}
                  </p>
                </div>
                <button type="button" className="sb-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : chapter.code)}>
                  {expanded ? "بستن مبحث‌ها" : `${toPersianDigits(chapter.topics.length)} مبحث`}
                </button>
              </div>

              {progress && total > 0 && (
                <div className="sb-progress" aria-label={`پیشرفت تو در این فصل: ${seen} از ${total} تست دیده، ${right} درست`}>
                  <div className="sb-bar">
                    <span style={{ width: `${Math.min(100, (right / total) * 100)}%` }} data-kind="right" />
                    <span style={{ width: `${Math.min(100, ((seen - right) / total) * 100)}%` }} data-kind="seen" />
                  </div>
                  <small className="tnum">
                    {seen ? `${toPersianDigits(seen)} از ${toPersianDigits(total)} دیده‌ای، ${toPersianDigits(right)} تا را بار آخر درست زدی` : "هنوز از این فصل تستی نزده‌ای"}
                  </small>
                </div>
              )}

              {expanded && (
                <ul className="sb-topics">
                  {chapter.topics.map((topic) => (
                    <li key={topic.code}>
                      <Link href={`/questions?subject=${encodeURIComponent(code)}&topic=${encodeURIComponent(topic.code)}`}>{topic.title}</Link>
                      <small className="tnum">
                        {toPersianDigits(topicCount(topic.code))} تست
                        {progress?.[topic.code]?.seen ? ` · ${toPersianDigits(progress[topic.code].seen)} دیده` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              )}

              {total > 0 && (
                <div className="sb-actions">
                  <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions?subject=${encodeURIComponent(code)}&chapter=${encodeURIComponent(chapter.code)}`}>
                    تست‌های این فصل
                  </Link>
                  <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" disabled={busy !== null} onClick={() => void start(chapter, "feedback", codes)}>
                    {busy === `${chapter.code}:feedback` ? "در حال آماده‌سازی…" : "تمرین تست‌به‌تست"}
                  </button>
                  <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" disabled={busy !== null} onClick={() => void start(chapter, "exam", codes)}>
                    {busy === `${chapter.code}:exam` ? "در حال ساختن…" : "آزمون زمان‌دار"}
                  </button>
                </div>
              )}
              {message?.chapter === chapter.code && <p className="xb-message" role="alert">{message.text}</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
