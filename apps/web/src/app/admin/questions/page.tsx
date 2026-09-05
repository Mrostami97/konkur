"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

function AuthorQuestion() {
  const [externalId, setExternalId] = useState("");
  const [degree, setDegree] = useState<"master" | "phd">("master");
  const [major, setMajor] = useState("computer-engineering");
  const [year, setYear] = useState("1405");
  const [subjectCode, setSubjectCode] = useState("");
  const [topicCodes, setTopicCodes] = useState("");
  const [stem, setStem] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(1);
  const [solution, setSolution] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const job = await apiFetch<{ id: string; status: string }>("/admin/questions", {
        method: "POST",
        body: {
          external_id: externalId,
          exam: { degree, major, year: Number(year) },
          subject_code: subjectCode,
          topic_codes: topicCodes.split(",").map((s) => s.trim()).filter(Boolean),
          stem_blocks: [{ type: "text", text: stem }],
          options: options.map((text, i) => ({ number: i + 1, blocks: [{ type: "text", text }] })),
          correct_option: correctOption,
          solution_blocks: [{ type: "text", text: solution }],
        },
      });
      setResult(`با موفقیت در وظیفه ${job.id} ثبت شد؛ برای انتشار به /admin/import بروید.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت سؤال ناموفق بود");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>افزودن سؤال (بدون فایل zip)</h1>
      <p style={{ fontSize: "0.85rem", color: "#486581" }}>
        این فرم دقیقاً همان مسیر Stage → Review → Publish بارگذاری zip را طی می‌کند؛
        پس از ثبت، برای بررسی و انتشار به <Link href="/admin/import">ورود داده</Link> بروید.
      </p>
      <form onSubmit={submit}>
        <input placeholder="external_id" value={externalId} onChange={(e) => setExternalId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <select value={degree} onChange={(e) => setDegree(e.target.value as "master" | "phd")}>
            <option value="master">ارشد</option>
            <option value="phd">دکتری</option>
          </select>
          <input placeholder="گرایش" value={major} onChange={(e) => setMajor(e.target.value)} required />
          <input placeholder="سال" value={year} onChange={(e) => setYear(e.target.value)} required style={{ width: "5rem" }} />
        </div>
        <input placeholder="subject_code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="topic_codes (با کاما)" value={topicCodes} onChange={(e) => setTopicCodes(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <textarea placeholder="متن سؤال" value={stem} onChange={(e) => setStem(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        {options.map((opt, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
            <input
              type="radio"
              name="correct"
              checked={correctOption === i + 1}
              onChange={() => setCorrectOption(i + 1)}
            />
            <input
              placeholder={`گزینه ${i + 1}`}
              value={opt}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              required
              style={{ flex: 1, padding: "0.4rem" }}
            />
          </div>
        ))}
        <textarea placeholder="راه‌حل" value={solution} onChange={(e) => setSolution(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">ثبت سؤال</button>
      </form>
      {result && <p style={{ color: "green" }}>{result}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}

export default function AdminQuestionsPage() {
  return (
    <AdminGuard>
      <AuthorQuestion />
    </AdminGuard>
  );
}
