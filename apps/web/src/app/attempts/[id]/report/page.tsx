"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import { ContentBlocks } from "../../../../components/ContentBlocks";
import { Badge, DataState } from "../../../../components/ds";
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

export default function ReportPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">گزارش آزمون</p>
          <h1>{report?.examTitle ?? "نتیجهٔ آزمون"}</h1>
        </div>
      </div>

      <section className="pg-shell pg-sec">
        <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
          {report && (
            <div className="ds-stack-lg">
              <div>
                <div className="rp-summary">
                  <div className="rp-cell">
                    <span>درصد صحیح</span>
                    <strong>{toPersianDigits(report.score.percentCorrect.toFixed(1))}٪</strong>
                  </div>
                  <div className="rp-cell rp-cell-good">
                    <span>پاسخ صحیح</span>
                    <strong>{toPersianDigits(report.score.correctCount)}</strong>
                  </div>
                  <div className="rp-cell rp-cell-bad">
                    <span>پاسخ غلط</span>
                    <strong>{toPersianDigits(report.score.wrongCount)}</strong>
                  </div>
                  <div className="rp-cell">
                    <span>بی‌پاسخ</span>
                    <strong>{toPersianDigits(report.score.unansweredCount)}</strong>
                  </div>
                </div>
                <p className="rp-version">
                  نسخهٔ نمره‌دهی: <span className="ds-code">{report.score.scoreVersion}</span> — نمرهٔ خام{" "}
                  {toPersianDigits(report.score.rawScore)}
                </p>
              </div>

              <div className="ds-stack">
                {report.items.map((item, index) => {
                  const answered = item.selectedOption !== null;
                  const correct = item.selectedOption === item.question.correctOption;
                  return (
                    <section className="rp-q" key={item.question.id}>
                      <div className="rp-q-head">
                        <span className="rp-q-n">سؤال {toPersianDigits(index + 1)}</span>
                        {!answered
                          ? <Badge>بی‌پاسخ</Badge>
                          : correct
                            ? <Badge tone="success">پاسخ درست</Badge>
                            : <Badge tone="danger">پاسخ نادرست</Badge>}
                      </div>

                      <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />

                      <div className="rp-options">
                        {item.question.options.map((option) => {
                          const chosen = item.selectedOption === option.number;
                          const isAnswer = option.number === item.question.correctOption;
                          const tone = isAnswer
                            ? "rp-option-correct"
                            : chosen
                              ? "rp-option-chosen-wrong"
                              : "";
                          return (
                            <div className={`rp-option ${tone}`} key={option.number}>
                              {isAnswer && <span className="rp-mark">پاسخ درست</span>}
                              {chosen && !isAnswer && <span className="rp-mark">انتخاب شما</span>}
                              <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="rp-solution">
                        <strong>راه‌حل</strong>
                        <ContentBlocks blocks={item.question.solutionBlocks} assets={item.question.assets} />
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="ds-row">
                <Link className="ds-btn ds-btn-secondary" href="/exams">بازگشت به آزمون‌ها</Link>
              </div>
            </div>
          )}
        </DataState>
      </section>
    </main>
  );
}
