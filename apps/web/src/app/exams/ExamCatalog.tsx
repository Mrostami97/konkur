"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { konkurPercent, toPersianDigits } from "../../lib/format";
import { StartExamButton } from "../../components/StartExamButton";

export interface CatalogExam {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  simulatesExamCode: string | null;
  simulatesYear: number | null;
  itemCount: number | null;
  sections: { title: string }[];
}

interface MyAttempt {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  exam: { id: string };
  score: { correctCount: number; wrongCount: number; unansweredCount: number } | null;
}

/** The master's exams a simulator can stand in for, in the order a student looks for them. */
const TRACKS: { code: string; title: string; short: string }[] = [
  { code: "1277", title: "ارشد مهندسی کامپیوتر", short: "مهندسی کامپیوتر" },
  { code: "1276", title: "ارشد فناوری اطلاعات", short: "فناوری اطلاعات" },
  { code: "1209", title: "ارشد علوم کامپیوتر", short: "علوم کامپیوتر" },
];
const OTHER = { code: "other", title: "آزمون‌های موضوعی", short: "موضوعی" };

function trackOf(exam: CatalogExam) {
  return TRACKS.find((track) => track.code === exam.simulatesExamCode) ?? OTHER;
}

export function ExamCatalog({ exams }: { exams: CatalogExam[] }) {
  const groups = useMemo(() => {
    const order = [...TRACKS, OTHER];
    return order
      .map((track) => ({
        track,
        exams: exams
          .filter((exam) => trackOf(exam).code === track.code)
          .sort((a, b) => (b.simulatesYear ?? 0) - (a.simulatesYear ?? 0)),
      }))
      .filter((group) => group.exams.length > 0);
  }, [exams]);
  const [filter, setFilter] = useState<string>("all");
  // The student's own attempts, when signed in: a card then says how it went.
  const [mine, setMine] = useState<Map<string, MyAttempt[]>>(new Map());

  useEffect(() => {
    apiFetch<MyAttempt[]>("/me/attempts")
      .then((attempts) => {
        const byExam = new Map<string, MyAttempt[]>();
        for (const attempt of attempts) byExam.set(attempt.exam.id, [...(byExam.get(attempt.exam.id) ?? []), attempt]);
        setMine(byExam);
      })
      .catch(() => undefined);
  }, []);

  const shown = filter === "all" ? groups : groups.filter((group) => group.track.code === filter);

  return (
    <div className="xc">
      {groups.length > 1 && (
        <div className="xc-filter" role="tablist" aria-label="رشته">
          <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>
            همه <span>{toPersianDigits(exams.length)}</span>
          </button>
          {groups.map((group) => (
            <button key={group.track.code} type="button" role="tab" aria-selected={filter === group.track.code} onClick={() => setFilter(group.track.code)}>
              {group.track.short} <span>{toPersianDigits(group.exams.length)}</span>
            </button>
          ))}
        </div>
      )}

      {shown.map((group) => (
        <section className="xc-group" key={group.track.code} data-track={group.track.code} aria-labelledby={`xc-${group.track.code}`}>
          <header className="xc-group-head">
            <h2 id={`xc-${group.track.code}`}>{group.track.title}</h2>
            {group.track.code !== "other" && <span>کد {toPersianDigits(group.track.code)}</span>}
          </header>
          <div className="xc-grid">
            {group.exams.map((exam) => {
              const attempts = mine.get(exam.id) ?? [];
              const open = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
              const last = attempts.find((attempt) => attempt.score);
              const lastPercent = last?.score ? konkurPercent(last.score) : null;
              return (
                <article className="xc-card" key={exam.id}>
                  <div className="xc-card-top">
                    {exam.simulatesYear ? (
                      <span className="xc-year">
                        <small>کنکور</small>
                        <b className="tnum">{toPersianDigits(exam.simulatesYear)}</b>
                      </span>
                    ) : (
                      <span className="xc-year xc-year-topic"><b>آزمون</b></span>
                    )}
                    <div className="xc-card-title">
                      <h3>{exam.title}</h3>
                      <p>{exam.description}</p>
                    </div>
                  </div>

                  <dl className="xc-facts">
                    {exam.itemCount !== null && (
                      <div><dt>سؤال</dt><dd className="tnum">{toPersianDigits(exam.itemCount)}</dd></div>
                    )}
                    <div><dt>دقیقه</dt><dd className="tnum">{toPersianDigits(exam.durationMinutes)}</dd></div>
                    {exam.sections.length > 0 && (
                      <div><dt>بخش</dt><dd className="tnum">{toPersianDigits(exam.sections.length)}</dd></div>
                    )}
                  </dl>

                  {exam.sections.length > 0 && (
                    <ul className="xc-sections" aria-label="بخش‌های آزمون">
                      {exam.sections.slice(0, 6).map((section) => <li key={section.title}>{section.title}</li>)}
                    </ul>
                  )}

                  <div className="xc-foot">
                    {open ? (
                      <Link className="button button-primary" href={`/attempts/${open.id}`}>ادامهٔ آزمون</Link>
                    ) : (
                      <StartExamButton examId={exam.id} />
                    )}
                    {last && lastPercent !== null && (
                      <Link className="xc-mine" href={`/attempts/${last.id}/report`}>
                        <span className="xc-mine-meter" aria-hidden="true">
                          <span style={{ width: `${Math.max(0, Math.min(100, lastPercent))}%` }} />
                        </span>
                        <span>
                          آخرین بار <b className="tnum">{toPersianDigits(Math.round(lastPercent))}٪</b> · کارنامه
                        </span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
