"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";

interface Subject { code: string; title: string; chapters: number }

/** The bank by subject: one tile per subject, opening its chapters. */
export function SubjectsIndex({ catalog }: { catalog: Subject[] }) {
  const [totals, setTotals] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    apiFetch<{ subjects: Record<string, number> }>("/questions/counts")
      .then((data) => setTotals(data.subjects))
      .catch(() => setTotals(null));
  }, []);

  // Subjects with questions first, the rest after, each group in syllabus order.
  const ordered = totals ? [...catalog].sort((a, b) => Number(!totals[a.code]) - Number(!totals[b.code])) : catalog;

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker"><Link href="/questions">بانک سؤال</Link></p>
          <h1>بانک سؤال فصل‌به‌فصل</h1>
          <p>هر درس را باز کن تا فصل‌های سرفصل ۱۴۰۶ را با تعداد تست هر فصل ببینی، و هر فصل را جدا تمرین کنی یا از آن آزمون بدهی.</p>
        </div>
      </header>
      <div className="qb-wrap sb-grid">
        {ordered.map((subject) => {
          const count = totals?.[subject.code] ?? 0;
          return (
            <Link key={subject.code} href={`/questions/subjects/${subject.code}`} className="sb-tile" data-empty={totals !== null && !count ? true : undefined}>
              <strong>{subject.title}</strong>
              <span className="tnum">
                {toPersianDigits(subject.chapters)} فصل
                {totals !== null && <> · {count ? `${toPersianDigits(count)} تست` : "هنوز تستی ندارد"}</>}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
