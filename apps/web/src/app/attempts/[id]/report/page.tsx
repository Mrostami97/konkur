"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
import { ContentBlocks } from "../../../../components/ContentBlocks";

interface Block {
  type: string;
  [key: string]: unknown;
}

interface Option {
  number: number;
  blocks: Block[];
}

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

  useEffect(() => {
    apiFetch<Report>(`/attempts/${params.id}/report`).then(setReport).catch(() => {});
  }, [params.id]);

  if (!report) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>گزارش آزمون: {report.examTitle}</h1>
      <div style={{ background: "#F4F8FB", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
        <p>درصد صحیح: {toPersianDigits(report.score.percentCorrect.toFixed(1))}٪</p>
        <p>
          صحیح: {toPersianDigits(report.score.correctCount)} — غلط: {toPersianDigits(report.score.wrongCount)} — بی‌پاسخ: {toPersianDigits(report.score.unansweredCount)}
        </p>
        <p style={{ fontSize: "0.8rem", color: "#486581" }}>نسخه نمره‌دهی: {report.score.scoreVersion}</p>
      </div>

      {report.items.map((item, index) => {
        const isCorrect = item.selectedOption === item.question.correctOption;
        return (
          <div
            key={item.question.id}
            style={{
              border: `1px solid ${isCorrect ? "green" : "#D7E2EA"}`,
              borderRadius: 6,
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <p style={{ fontWeight: "bold" }}>سؤال {toPersianDigits(index + 1)}</p>
            <ContentBlocks blocks={item.question.stemBlocks} assets={item.question.assets} />
            {item.question.options.map((option) => {
              const isSelected = item.selectedOption === option.number;
              const isTheCorrectOne = option.number === item.question.correctOption;
              return (
                <div
                  key={option.number}
                  style={{
                    fontWeight: isTheCorrectOne ? "bold" : "normal",
                    color: isTheCorrectOne ? "green" : isSelected ? "crimson" : "inherit",
                  }}
                >
                  {isSelected ? "→ " : ""}
                  <ContentBlocks blocks={option.blocks} assets={item.question.assets} />
                </div>
              );
            })}
            <div style={{ background: "#F4F8FB", padding: "0.5rem", marginTop: "0.5rem" }}>
              <strong>راه‌حل</strong>
              <ContentBlocks blocks={item.question.solutionBlocks} assets={item.question.assets} />
            </div>
          </div>
        );
      })}
    </main>
  );
}
