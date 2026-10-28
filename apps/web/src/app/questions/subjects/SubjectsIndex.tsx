"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";

interface Subject { code: string; title: string; chapters: number }
export interface BankCounts { subjects: Record<string, number>; solved?: Record<string, number> }
type Summary = Record<string, { seen: number; right: number }>;

const fa = (n: number) => toPersianDigits(n);

/**
 * The bank by subject: one tile per subject with its chapters, questions and
 * worked solutions, and -- for a signed-in student -- how far they have got
 * in it, opening its chapters.
 */
export function SubjectsIndex({ catalog, initialCounts }: { catalog: Subject[]; initialCounts: BankCounts | null }) {
  const [counts, setCounts] = useState<BankCounts | null>(initialCounts);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!initialCounts) apiFetch<BankCounts>("/questions/counts").then(setCounts).catch(() => setCounts(null));
    apiFetch<Summary>("/questions/progress-summary").then(setSummary).catch(() => setSummary(null));
  }, [initialCounts]);

  const totals = counts?.subjects ?? null;
  // Subjects with questions first, the rest after, each group in syllabus order.
  const ordered = totals ? [...catalog].sort((a, b) => Number(!totals[a.code]) - Number(!totals[b.code])) : catalog;
  const allQuestions = totals ? catalog.reduce((sum, s) => sum + (totals[s.code] ?? 0), 0) : 0;
  const allSolved = counts?.solved ? catalog.reduce((sum, s) => sum + (counts.solved![s.code] ?? 0), 0) : 0;

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker"><Link href="/questions">بانک سؤال</Link></p>
          <h1>بانک سؤال فصل‌به‌فصل</h1>
          <p>
            {allQuestions > 0 && `${fa(allQuestions)} تست کنکور ارشد و دکتری کامپیوتر${allSolved ? `، ${fa(allSolved)} تا با پاسخ تشریحی` : ""}. `}
            هر درس را باز کن تا فصل‌های سرفصل ۱۴۰۶ را با تعداد تست هر فصل، سهم هر فصل در کنکورهای اخیر و پیشرفت خودت ببینی، و هر فصل را جدا تمرین کنی یا از آن آزمون بدهی.
          </p>
        </div>
      </header>
      <div className="qb-wrap sb-grid">
        {ordered.map((subject) => {
          const count = totals?.[subject.code] ?? 0;
          const solved = counts?.solved?.[subject.code] ?? 0;
          const mine = summary?.[subject.code];
          return (
            <Link key={subject.code} href={`/questions/subjects/${subject.code}`} className="sb-tile" data-empty={totals !== null && !count ? true : undefined}>
              <strong>{subject.title}</strong>
              <span className="tnum">
                {fa(subject.chapters)} فصل
                {totals !== null && <> · {count ? `${fa(count)} تست` : "هنوز تستی ندارد"}</>}
              </span>
              {count > 0 && solved > 0 && <span className="tnum sb-tile-solved">{fa(solved)} تست با پاسخ تشریحی</span>}
              {mine && count > 0 && (
                <span className="sb-tile-progress" aria-label={`پیشرفت تو: ${mine.seen} از ${count} تست، ${mine.right} درست`}>
                  <span className="sb-bar">
                    <span style={{ width: `${Math.min(100, (mine.right / count) * 100)}%` }} data-kind="right" />
                    <span style={{ width: `${Math.min(100, ((mine.seen - mine.right) / count) * 100)}%` }} data-kind="seen" />
                  </span>
                  <small className="tnum">{fa(mine.seen)} دیده · {fa(mine.right)} درست</small>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
