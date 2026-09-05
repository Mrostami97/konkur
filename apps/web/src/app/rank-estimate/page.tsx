"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

interface SubjectScore {
  subjectCode: string;
  percent: string;
}

interface Estimate {
  rankMedian: number;
  rankP50Low: number;
  rankP50High: number;
  rankP80Low: number;
  rankP80High: number;
  confidence: string;
  comparableCount: number;
  comparableYears: number[];
  sensitivity: Record<string, number>;
  methodology: string;
}

export default function RankEstimatePage() {
  const router = useRouter();
  const [degree, setDegree] = useState<"master" | "phd">("master");
  const [field, setField] = useState("computer-engineering");
  const [quota, setQuota] = useState("region-1");
  const [scores, setScores] = useState<SubjectScore[]>([{ subjectCode: "algorithms", percent: "" }]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Estimate>("/me/rank-estimates/latest").then(setEstimate).catch(() => {});
  }, []);

  function updateScore(index: number, field: "subjectCode" | "percent", value: string) {
    setScores((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<Estimate>("/me/rank-estimates", {
        method: "POST",
        body: {
          degree,
          field,
          quota,
          subjectScores: scores.map((s) => ({ subjectCode: s.subjectCode, percent: Number(s.percent) })),
        },
      });
      setEstimate(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "تخمین رتبه ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>تخمین رتبه</h1>
      <p style={{ fontSize: "0.85rem", color: "#486581" }}>
        این تخمین بر اساس مقایسه با کارنامه‌های واقعی و تأییدشده مشابه محاسبه می‌شود؛ یک عدد قطعی نیست.
      </p>

      <form onSubmit={submit}>
        <select value={degree} onChange={(e) => setDegree(e.target.value as "master" | "phd")} style={{ marginBottom: "0.4rem" }}>
          <option value="master">ارشد</option>
          <option value="phd">دکتری</option>
        </select>
        <input placeholder="گرایش" value={field} onChange={(e) => setField(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="سهمیه" value={quota} onChange={(e) => setQuota(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />

        {scores.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <input placeholder="کد درس" value={s.subjectCode} onChange={(e) => updateScore(i, "subjectCode", e.target.value)} required />
            <input placeholder="درصد" value={s.percent} onChange={(e) => updateScore(i, "percent", e.target.value)} required style={{ width: "5rem" }} />
          </div>
        ))}
        <button type="button" onClick={() => setScores([...scores, { subjectCode: "", percent: "" }])}>
          افزودن درس
        </button>
        <button type="submit" disabled={loading} style={{ marginInlineStart: "0.5rem" }}>
          {loading ? "در حال محاسبه..." : "محاسبه تخمین"}
        </button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {estimate && (
        <div style={{ background: "#F4F8FB", padding: "1rem", borderRadius: 6, marginTop: "1rem" }}>
          <h2>نتیجه</h2>
          <p>
            میانه رتبه: <strong>{estimate.rankMedian}</strong> (این عدد به‌تنهایی قابل اتکا نیست — بازه‌ها را ببینید)
          </p>
          <p>بازه ۵۰٪: از {estimate.rankP50Low} تا {estimate.rankP50High}</p>
          <p>بازه ۸۰٪: از {estimate.rankP80Low} تا {estimate.rankP80High}</p>
          <p>سطح اطمینان: {estimate.confidence}</p>
          <p>
            تعداد کارنامه‌های مشابه: {estimate.comparableCount} (سال‌های {estimate.comparableYears.join("، ")})
          </p>
          <h3>حساسیت به بهبود هر درس</h3>
          <ul>
            {Object.entries(estimate.sensitivity).map(([subject, delta]) => (
              <li key={subject}>
                {subject}: {delta === 0 ? "بدون داده کافی" : `${delta > 0 ? "+" : ""}${delta} تغییر در میانه رتبه`}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: "0.8rem", color: "#486581" }}>{estimate.methodology}</p>
        </div>
      )}
    </main>
  );
}
