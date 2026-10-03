"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { konkurPercent, toPersianDigits } from "../../../../lib/format";
import { ContentBlocks } from "../../../../components/ContentBlocks";
import { DataState } from "../../../../components/ds";
import { StandingPanel } from "./StandingPanel";
import "./report.css";

interface Block { type: string; [key: string]: unknown }
interface Option { number: number; blocks: Block[] }

interface ReportItem {
  question: {
    id: string;
    stemBlocks: Block[];
    options: Option[];
    correctOption: number;
    solutionBlocks: Block[];
    assets: { media_key: string; checksum: string }[];
  };
  selectedOption: number | null;
}

interface Report {
  examTitle: string;
  status: string;
  score: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    rawScore: number;
    percentCorrect: number;
    scoreVersion: string;
  };
  items: ReportItem[];
}

type Outcome = "correct" | "wrong" | "blank";
type Filter = "all" | Outcome;

function outcomeOf(item: ReportItem): Outcome {
  if (item.selectedOption === null) return "blank";
  return item.selectedOption === item.question.correctOption ? "correct" : "wrong";
}

const OUTCOME_LABEL: Record<Outcome, string> = { correct: "درست", wrong: "نادرست", blank: "بی‌پاسخ" };
const OUTCOME_MARK: Record<Outcome, string> = { correct: "✓", wrong: "✕", blank: "–" };

function percent(value: number) {
  return `${toPersianDigits(value.toFixed(1))}٪`;
}

export default function ReportPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = use(pendingParams);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await apiFetch<Report>(`/attempts/${params.id}/report`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن گزارش آزمون ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (report?.items ?? []).map((item, index) => ({ item, index, outcome: outcomeOf(item) })),
    [report],
  );
  const counts = useMemo(() => {
    const tally: Record<Filter, number> = { all: rows.length, correct: 0, wrong: 0, blank: 0 };
    rows.forEach((row) => (tally[row.outcome] += 1));
    return tally;
  }, [rows]);
  const shown = filter === "all" ? rows : rows.filter((row) => row.outcome === filter);

  const jump = (index: number) => {
    setFilter("all");
    requestAnimationFrame(() => {
      const target = document.getElementById(`r-${index + 1}`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    });
  };

  const total = counts.all;
  const share = (count: number) => `${total ? (count / total) * 100 : 0}%`;

  return (
    <main className="rp">
      <header className="rp-top">
        <div className="rp-wrap rp-top-inner">
          <div>
            <p className="rp-kicker">گزارش آزمون</p>
            <h1>{report?.examTitle ?? "نتیجهٔ آزمون"}</h1>
          </div>
          <nav className="rp-top-actions" aria-label="بعد از آزمون">
            <Link className="ds-btn ds-btn-secondary" href="/account/exams">آزمون‌ها و رتبه‌های من</Link>
            <Link className="ds-btn ds-btn-ghost" href="/exams">آزمون‌های دیگر</Link>
          </nav>
        </div>
      </header>

      <div className="rp-wrap rp-body">
        <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
          {report && (
            <>
              {/* ------------------------------------------------------ score */}
              <section className="rp-score" aria-labelledby="rp-score-title">
                <div className="rp-lead">
                  <h2 id="rp-score-title">درصد به روش کنکور</h2>
                  <strong className="tnum">{percent(konkurPercent(report.score))}</strong>
                  <p>هر پاسخ نادرست یک‌سوم یک پاسخ درست کم می‌کند؛ همان حسابی که سنجش می‌کند.</p>
                </div>
                <div className="rp-split">
                  <div className="rp-bar" role="img" aria-label={`${toPersianDigits(counts.correct)} درست، ${toPersianDigits(counts.wrong)} نادرست، ${toPersianDigits(counts.blank)} بی‌پاسخ`}>
                    <span className="rp-bar-correct" style={{ width: share(counts.correct) }} />
                    <span className="rp-bar-wrong" style={{ width: share(counts.wrong) }} />
                    <span className="rp-bar-blank" style={{ width: share(counts.blank) }} />
                  </div>
                  <dl className="rp-counts">
                    <div data-outcome="correct"><dt>درست</dt><dd className="tnum">{toPersianDigits(counts.correct)}</dd></div>
                    <div data-outcome="wrong"><dt>نادرست</dt><dd className="tnum">{toPersianDigits(counts.wrong)}</dd></div>
                    <div data-outcome="blank"><dt>بی‌پاسخ</dt><dd className="tnum">{toPersianDigits(counts.blank)}</dd></div>
                    <div><dt>درصد پاسخ درست</dt><dd className="tnum">{percent(report.score.percentCorrect)}</dd></div>
                  </dl>
                </div>
              </section>

              {report.status === "SUBMITTED" && <StandingPanel attemptId={params.id} />}

              {/* ----------------------------------------------------- review */}
              <section className="rp-review" aria-labelledby="rp-review-title">
                <div className="rp-review-head">
                  <h2 id="rp-review-title">مرور سؤال‌ها</h2>
                  <div className="rp-tabs" role="tablist" aria-label="نمایش سؤال‌ها">
                    {(["all", "wrong", "blank", "correct"] as Filter[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={filter === key}
                        className="rp-tab"
                        onClick={() => setFilter(key)}
                        disabled={key !== "all" && counts[key] === 0}
                      >
                        {key === "all" ? "همه" : OUTCOME_LABEL[key as Outcome]}
                        <span className="tnum">{toPersianDigits(counts[key])}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <ol className="rp-strip" aria-label="وضعیت هر سؤال">
                  {rows.map((row) => (
                    <li key={row.item.question.id}>
                      <button
                        type="button"
                        data-outcome={row.outcome}
                        onClick={() => jump(row.index)}
                        aria-label={`سؤال ${toPersianDigits(row.index + 1)}، ${OUTCOME_LABEL[row.outcome]}`}
                      >
                        {toPersianDigits(row.index + 1)}
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="rp-sheet">
                  {shown.map(({ item, index, outcome }) => (
                    <article className="rp-q" id={`r-${index + 1}`} key={item.question.id} tabIndex={-1} data-outcome={outcome}>
                      <div className="rp-q-head">
                        <span className="rp-q-n">سؤال {toPersianDigits(index + 1)}</span>
                        <span className="rp-status" data-outcome={outcome}>
                          <span aria-hidden="true">{OUTCOME_MARK[outcome]}</span> {OUTCOME_LABEL[outcome]}
                        </span>
                      </div>

                      <div className="rp-stem">
                        <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
                      </div>

                      <div className="rp-options">
                        {item.question.options.map((option) => {
                          const chosen = item.selectedOption === option.number;
                          const isAnswer = option.number === item.question.correctOption;
                          return (
                            <div
                              className="rp-option"
                              data-answer={isAnswer || undefined}
                              data-chosen-wrong={(chosen && !isAnswer) || undefined}
                              key={option.number}
                            >
                              <span className="rp-opt-n" aria-hidden="true">{toPersianDigits(option.number)}</span>
                              <span className="rp-opt-body">
                                <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
                              </span>
                              {isAnswer && <span className="rp-mark">{chosen ? "پاسخ تو، درست" : "پاسخ درست"}</span>}
                              {chosen && !isAnswer && <span className="rp-mark">پاسخ تو</span>}
                            </div>
                          );
                        })}
                      </div>

                      {item.question.solutionBlocks.length > 0 && (
                        <details className="rp-solution" open={outcome !== "correct"}>
                          <summary>راه‌حل</summary>
                          <div className="rp-solution-body">
                            <ContentBlocks blocks={item.question.solutionBlocks} assets={item.question.assets} />
                          </div>
                        </details>
                      )}
                    </article>
                  ))}
                  {shown.length === 0 && <p className="rp-none">در این دسته سؤالی نیست.</p>}
                </div>
              </section>
            </>
          )}
        </DataState>
      </div>
    </main>
  );
}
