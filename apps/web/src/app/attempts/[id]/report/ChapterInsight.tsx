"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { subjectName } from "../../../../content/subject-names";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import { SYLLABUS, topicPlace } from "../../../../lib/syllabus";

/** One answered question of the attempt, as the chapter view needs it. */
export interface ChapterItem {
  subjectCode: string;
  topicCodes: string[];
  outcome: "correct" | "wrong" | "blank";
}

interface ChapterStats {
  years: number[];
  latestYear?: number | null;
  topics: Record<string, { n: number; byYear: Record<string, number> }>;
}

/** "Recent" means the latest exam years in the bank. */
const RECENT_YEARS = 5;
const fa = (n: number) => toPersianDigits(n);

interface Row {
  subjectCode: string;
  chapterCode: string;
  chapterTitle: string;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Konkur percentage: a wrong answer takes away a third of a right one. */
  percent: number;
  /** The chapter's share of the subject's questions in the latest exams, or null before the stats load. */
  weight: number | null;
  /** True when the subject has no questions in the latest konkurs and the weight counts every year. */
  allYears: boolean;
}

function verdict(row: Row): { label: string; tone: "weak" | "mid" | "good" } {
  if (row.percent >= 70) return { label: "مسلط", tone: "good" };
  if (row.percent < 40 && (row.weight ?? 0) >= 15) return { label: "اولویت اول", tone: "weak" };
  if (row.percent < 40) return { label: "نیاز به مرور", tone: "weak" };
  return { label: "نسبتاً خوب", tone: "mid" };
}

/**
 * The attempt chapter by chapter: for every 1406 chapter its questions came
 * from, the student's result next to how much of that subject the chapter
 * carried in the latest exams -- so a weak, heavy chapter stands out as the
 * first thing to review, with a link to practise it.
 */
export function ChapterInsight({ items }: { items: ChapterItem[] }) {
  const [stats, setStats] = useState<Record<string, ChapterStats>>({});
  const subjects = [...new Set(items.filter((item) => SYLLABUS[item.subjectCode] && item.topicCodes.length).map((item) => item.subjectCode))];

  useEffect(() => {
    for (const code of subjects) {
      apiFetch<ChapterStats>(`/questions/chapter-stats?subjectCode=${encodeURIComponent(code)}`)
        .then((data) => setStats((previous) => ({ ...previous, [code]: data })))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.join(",")]);

  const rows = new Map<string, Row>();
  for (const item of items) {
    const place = topicPlace(item.subjectCode, item.topicCodes[0]);
    if (!place) continue;
    const key = `${item.subjectCode}:${place.chapter.code}`;
    const row = rows.get(key) ?? {
      subjectCode: item.subjectCode,
      chapterCode: place.chapter.code,
      chapterTitle: place.chapter.title,
      questions: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      percent: 0,
      weight: null,
      allYears: false,
    };
    row.questions += 1;
    row[item.outcome] += 1;
    rows.set(key, row);
  }
  if (rows.size === 0) return null;

  for (const row of rows.values()) {
    row.percent = ((3 * row.correct - row.wrong) / (3 * row.questions)) * 100;
    const subjectStats = stats[row.subjectCode];
    if (subjectStats) {
      const latest = subjectStats.latestYear ?? Math.max(0, ...subjectStats.years);
      const window = Array.from({ length: RECENT_YEARS }, (_, i) => latest - RECENT_YEARS + 1 + i);
      const hasRecent = window.some((y) => Object.values(subjectStats.topics).some((t) => t.byYear[y]));
      row.allYears = !hasRecent;
      const recentOf = (topics: string[]) =>
        topics.reduce((sum, code) => sum + (hasRecent ? window.reduce((s, y) => s + (subjectStats.topics[code]?.byYear[y] ?? 0), 0) : subjectStats.topics[code]?.n ?? 0), 0);
      const chapter = SYLLABUS[row.subjectCode].find((c) => c.code === row.chapterCode);
      const all = SYLLABUS[row.subjectCode].flatMap((c) => c.topics.map((t) => t.code));
      const subjectRecent = recentOf(all);
      row.weight = subjectRecent && chapter ? Math.round((recentOf(chapter.topics.map((t) => t.code)) / subjectRecent) * 100) : 0;
    }
  }

  // Heavier and weaker first: what moves the next exam's mark the most.
  const ordered = [...rows.values()].sort(
    (a, b) => (b.weight ?? 0) * (100 - Math.max(0, b.percent)) - (a.weight ?? 0) * (100 - Math.max(0, a.percent)),
  );
  const many = subjects.length > 1;

  return (
    <section className="rc-block" aria-labelledby="rc-chapters-title">
      <div className="rc-head">
        <h2 id="rc-chapters-title">فصل‌به‌فصل: نتیجهٔ تو و وزن هر فصل در کنکور</h2>
        <p>
          برای هر فصل، درصد تو در این آزمون کنار سهم آن فصل از تست‌های درس در {fa(RECENT_YEARS)} کنکور اخیر. فصلی که وزنش زیاد و درصدت کم است،
          بیشترین اثر را روی درصد کنکورت دارد؛ از همان شروع کن.
        </p>
      </div>
      <div className="rc-chapters" role="table" aria-label="نتیجهٔ فصل‌به‌فصل">
        <div className="rc-chapter rc-chapter-head" role="row">
          <span role="columnheader">فصل</span>
          <span role="columnheader">درصد تو</span>
          <span role="columnheader">وزن در کنکور</span>
          <span role="columnheader" />
        </div>
        {ordered.map((row) => {
          const { label, tone } = verdict(row);
          return (
            <div className="rc-chapter" role="row" key={`${row.subjectCode}:${row.chapterCode}`}>
              <span role="cell" className="rc-chapter-name">
                <b>{row.chapterTitle}</b>
                <small className="tnum">
                  {many ? `${subjectName(row.subjectCode)} · ` : ""}
                  {fa(row.correct)} درست، {fa(row.wrong)} نادرست، {fa(row.blank)} نزده از {fa(row.questions)}
                </small>
              </span>
              <span role="cell" className="rc-chapter-score">
                <b className="tnum">{toPersianDigits(row.percent.toFixed(0))}٪</b>
                <em data-tone={tone}>{label}</em>
              </span>
              <span role="cell" className="rc-chapter-weight tnum">
                {row.weight === null ? "…" : `${fa(row.weight)}٪ از تست‌های درس${row.allYears ? " (همهٔ سال‌ها)" : ""}`}
              </span>
              <span role="cell" className="rc-chapter-link">
                <Link href={`/questions/subjects/${row.subjectCode}#${row.chapterCode}`}>تمرین این فصل</Link>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
