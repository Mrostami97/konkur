"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";

interface Block {
  type: string;
  [key: string]: unknown;
}

interface Option {
  number: number;
  blocks: Block[];
}

interface Question {
  id: string;
  subjectCode: string;
  examDegree: string;
  examMajor: string;
  examYear: number;
  topicCodes: string[];
  stemBlocks: Block[];
  options: Option[];
  correctOption: number;
  solutionBlocks: Block[];
  assets: { media_key: string; checksum: string }[];
  version: number;
}

export default function QuestionDetailPage({ params }: { params: { id: string } }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    apiFetch<Question>(`/questions/${params.id}`).then(setQuestion).catch(() => {});
  }, [params.id]);

  if (!question) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <p style={{ fontSize: "0.85rem", color: "#486581" }}>
        {question.subjectCode} — {question.examMajor} — {question.examYear} — نسخه {question.version}
      </p>
      <ContentBlocks blocks={question.stemBlocks} assets={question.assets} />

      <ol style={{ paddingInlineStart: "1.5rem" }}>
        {question.options.map((option) => (
          <li
            key={option.number}
            style={{
              margin: "0.5rem 0",
              fontWeight: revealed && option.number === question.correctOption ? "bold" : "normal",
              color: revealed && option.number === question.correctOption ? "green" : "inherit",
            }}
          >
            <ContentBlocks blocks={option.blocks} assets={question.assets} />
          </li>
        ))}
      </ol>

      {!revealed ? (
        <button onClick={() => setRevealed(true)}>نمایش پاسخ و راه‌حل</button>
      ) : (
        <div style={{ background: "#F4F8FB", padding: "1rem", borderRadius: 6 }}>
          <strong>راه‌حل</strong>
          <ContentBlocks blocks={question.solutionBlocks} assets={question.assets} />
        </div>
      )}
    </main>
  );
}
