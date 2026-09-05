"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

interface Question {
  id: string;
  subjectCode: string;
  examMajor: string;
  examYear: number;
  stemBlocks: { type: string; text?: string }[];
}

interface Subject {
  code: string;
  title: string;
}

export default function QuestionBankPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectCode, setSubjectCode] = useState("");
  const [examYear, setExamYear] = useState("");
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ items: Question[]; total: number } | null>(null);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (subjectCode) params.set("subjectCode", subjectCode);
    if (examYear) params.set("examYear", examYear);
    if (q) params.set("q", q);
    const res = await apiFetch<{ items: Question[]; total: number }>(`/questions?${params.toString()}`);
    setResult(res);
  }

  useEffect(() => {
    apiFetch<Subject[]>("/subjects").then(setSubjects).catch(() => {});
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stemPreview(q: Question): string {
    const textBlock = q.stemBlocks.find((b) => b.type === "text");
    return textBlock?.text ?? "(بدون متن ساده)";
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>بانک سؤال</h1>
      <form onSubmit={search} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)}>
          <option value="">همه درس‌ها</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.title}
            </option>
          ))}
        </select>
        <input placeholder="سال کنکور" value={examYear} onChange={(e) => setExamYear(e.target.value)} style={{ width: "6rem" }} />
        <input placeholder="جست‌وجو" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit">جست‌وجو</button>
      </form>

      {result && (
        <>
          <p>{result.total} سؤال یافت شد</p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {result.items.map((question) => (
              <li key={question.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.6rem" }}>
                <Link href={`/questions/${question.id}`}>
                  {stemPreview(question).slice(0, 120)}
                </Link>
                <p style={{ fontSize: "0.85rem", color: "#486581" }}>
                  {question.subjectCode} — {question.examMajor} — {question.examYear}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
