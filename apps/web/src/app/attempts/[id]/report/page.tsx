"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { konkurPercent, toPersianDigits } from "../../../../lib/format";
import { ContentBlocks } from "../../../../components/ContentBlocks";
import { DataState } from "../../../../components/ds";
import { StandingPanel } from "./StandingPanel";
import { ReportCard, type CardItem, type CardReport } from "./ReportCard";
import { DifficultySwarm, ScoreDonut, TimeSwarm } from "./ReportCharts";
import { PaceChart, type PacePoint } from "../ExamCoach";
import "../coach.css";
import "./report.css";
import "./report-charts.css";

interface Block { type: string; [key: string]: unknown }
interface Option { number: number; blocks: Block[] }

interface ReportItem {
  question: {
    id: string;
    subjectCode: string;
    passage: { externalId: string; blocks: Block[] } | null;
    stemBlocks: Block[];
    options: Option[];
    correctOption: number;
    acceptedOptions: number[];
    solutionBlocks: Block[];
    assets: { media_key: string; checksum: string }[];
  };
  sectionId: string | null;
  selectedOption: number | null;
  timeSpentMs: number;
  changeCount: number;
  flagged: boolean;
  answeredAt: string | null;
  crowdCorrectPercent: number | null;
}

interface Report extends CardReport {
  examTitle: string;
  submittedAt: string | null;
  startedAt: string;
  deadlineAt: string;
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

/** An option the final key accepts: the key, or another one accepted after objections. */
function isKey(question: ReportItem["question"], option: number) {
  return option === question.correctOption || (question.acceptedOptions ?? []).includes(option);
}

function outcomeOf(item: ReportItem): Outcome {
  if (item.selectedOption === null) return "blank";
  return isKey(item.question, item.selectedOption) ? "correct" : "wrong";
}

/** The English section reads left to right, punctuation included. */
const textDirection = (subjectCode: string) => (subjectCode === "english" ? { dir: "ltr" as const, lang: "en" } : {});

const issued = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

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

  const cardItems: CardItem[] = useMemo(
    () =>
      rows.map(({ item, index, outcome }) => ({
        index,
        outcome,
        sectionId: item.sectionId,
        subjectCode: item.question.subjectCode,
        timeSpentMs: item.timeSpentMs,
        changeCount: item.changeCount,
        flagged: item.flagged,
        crowdCorrectPercent: item.crowdCorrectPercent,
      })),
    [rows],
  );

  const total = counts.all;
  const share = (count: number) => `${total ? (count / total) * 100 : 0}%`;

  /** The sitting replayed: when each final answer was given, against the clock. */
  const pace = useMemo(() => {
    if (!report?.startedAt || !report.deadlineAt) return null;
    const start = Date.parse(report.startedAt);
    const deadline = Date.parse(report.deadlineAt);
    const end = Math.min(report.submittedAt ? Date.parse(report.submittedAt) : deadline, deadline);
    const times = report.items
      .filter((item) => item.selectedOption !== null && item.answeredAt)
      .map((item) => Math.max(0, (Date.parse(item.answeredAt!) - start) / 1000))
      .sort((a, b) => a - b);
    if (times.length < 2) return null;
    return {
      trail: times.map((t, i) => [Math.round(t), i + 1] as PacePoint),
      elapsed: Math.max(0, (end - start) / 1000),
      duration: Math.max(1, (deadline - start) / 1000),
      answered: times.length,
    };
  }, [report]);

  const charts = report && (
    <>
      <TimeSwarm
        items={cardItems}
        durationMs={report.deadlineAt && report.startedAt ? Date.parse(report.deadlineAt) - Date.parse(report.startedAt) : 0}
        onJump={jump}
      />
      <DifficultySwarm items={cardItems} onJump={jump} />
      {pace && (
        <section className="rc-block" aria-labelledby="rx-pace-title">
          <div className="rc-head">
            <h2 id="rx-pace-title">ریتم پاسخ‌دادن</h2>
            <p>
              هر پله یک پاسخ است، در لحظه‌ای که آخرین بار ثبتش کردی؛ خط‌چین ریتم یکنواختی است که با پایان وقت همهٔ سؤال‌ها را تمام می‌کند.
            </p>
          </div>
          <div className="rx-pace">
            <PaceChart trail={pace.trail} elapsed={pace.elapsed} duration={pace.duration} answered={pace.answered} total={total} nowLabel="ثبت آزمون" />
          </div>
        </section>
      )}
    </>
  );

  return (
    <main className="rp">
      <header className="rp-top">
        <div className="rp-wrap rp-top-inner">
          <div>
            <p className="rp-kicker">کارنامهٔ آزمون</p>
            <h1>{report?.examTitle ?? "نتیجهٔ آزمون"}</h1>
            {report?.submittedAt && <p className="rp-issued">صادرشده در {issued.format(new Date(report.submittedAt))}</p>}
          </div>
          <nav className="rp-top-actions" aria-label="بعد از آزمون">
            <button type="button" className="ds-btn ds-btn-primary rp-print" onClick={() => window.print()}>
              دریافت PDF کارنامه
            </button>
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
                  <ScoreDonut correct={counts.correct} wrong={counts.wrong} blank={counts.blank} percent={konkurPercent(report.score)} />
                  <div className="rp-lead-text">
                    <h2 id="rp-score-title">درصد به روش کنکور</h2>
                    <strong className="tnum">{percent(konkurPercent(report.score))}</strong>
                    <p>هر پاسخ نادرست یک‌سوم یک پاسخ درست کم می‌کند؛ همان حسابی که سنجش می‌کند.</p>
                  </div>
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

              <ReportCard report={report} items={cardItems} onJump={jump} charts={charts} />

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
                        <span className="rp-q-meta">
                          {item.timeSpentMs > 0 && <span className="tnum">{toPersianDigits(Math.max(1, Math.round(item.timeSpentMs / 1000)))} ثانیه</span>}
                          {item.crowdCorrectPercent !== null && <span className="tnum">{toPersianDigits(item.crowdCorrectPercent)}٪ درست زدند</span>}
                        </span>
                        <span className="rp-status" data-outcome={outcome}>
                          <span aria-hidden="true">{OUTCOME_MARK[outcome]}</span> {OUTCOME_LABEL[outcome]}
                        </span>
                      </div>

                      {item.question.passage && (
                        <details className="rp-passage" {...textDirection(item.question.subjectCode)}>
                          <summary>متن مشترک</summary>
                          <ContentBlocks blocks={item.question.passage.blocks} assets={item.question.assets} />
                        </details>
                      )}

                      <div className="rp-stem" {...textDirection(item.question.subjectCode)}>
                        <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
                      </div>

                      <div className="rp-options" {...textDirection(item.question.subjectCode)}>
                        {item.question.options.map((option) => {
                          const chosen = item.selectedOption === option.number;
                          const isAnswer = isKey(item.question, option.number);
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
