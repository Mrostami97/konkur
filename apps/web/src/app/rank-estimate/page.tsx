"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader, StatCard } from "../../components/ui";

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
          subjectScores: scores.map((s) => ({ subjectCode: s.subjectCode, percent: Number(toEnglishDigits(s.percent)) })),
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
    <main className="page-container">
      <PageHeader eyebrow="تحلیل عملکرد" title="تخمین رتبه" description="با داده‌های عملکردی و کارنامه‌های مشابه، جایگاه احتمالی‌ات را بهتر درک کن." />
      <div className="surface-card surface-card-muted analysis-note">
      <p>
        این تخمین بر اساس مقایسه با کارنامه‌های واقعی و تأییدشده مشابه محاسبه می‌شود؛ یک عدد قطعی نیست.
      </p>
      </div>

      <form className="surface-card rank-form" onSubmit={submit}>
        <div className="field-grid field-grid-two"><label className="field-group"><span>مقطع</span><select className="field-input" value={degree} onChange={(e) => setDegree(e.target.value as "master" | "phd")}>
          <option value="master">ارشد</option>
          <option value="phd">دکتری</option>
        </select></label><label className="field-group"><span>گرایش</span><input className="field-input" placeholder="گرایش" value={field} onChange={(e) => setField(e.target.value)} required /></label><label className="field-group"><span>سهمیه</span><input className="field-input" placeholder="سهمیه" value={quota} onChange={(e) => setQuota(e.target.value)} required /></label></div>

        {scores.map((s, i) => (
          <div className="score-row" key={i}>
            <input className="field-input" placeholder="کد درس" value={s.subjectCode} onChange={(e) => updateScore(i, "subjectCode", e.target.value)} required />
            <input className="field-input score-percent" inputMode="decimal" placeholder="درصد" value={s.percent} onChange={(e) => updateScore(i, "percent", toPersianDigits(e.target.value))} required />
          </div>
        ))}
        <button className="button button-secondary" type="button" onClick={() => setScores([...scores, { subjectCode: "", percent: "" }])}>
          افزودن درس
        </button>
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? "در حال محاسبه..." : "محاسبه تخمین"}
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      {estimate && (
        <section className="surface-card rank-result">
          <div className="section-heading"><div><h2>نتیجهٔ آخرین محاسبه</h2><p>بازه‌ها را در کنار میانهٔ رتبه بخوان؛ این تخمین قطعی نیست.</p></div></div>
          <div className="stats-grid"><StatCard label="میانه رتبه" value={toPersianDigits(estimate.rankMedian.toLocaleString("en-US"))} detail={`اطمینان ${estimate.confidence}`} tone="teal" /><StatCard label="بازهٔ ۵۰٪" value={`${toPersianDigits(estimate.rankP50Low)} تا ${toPersianDigits(estimate.rankP50High)}`} tone="blue" /><StatCard label="بازهٔ ۸۰٪" value={`${toPersianDigits(estimate.rankP80Low)} تا ${toPersianDigits(estimate.rankP80High)}`} tone="purple" /></div>
          <p>
            تعداد کارنامه‌های مشابه: {toPersianDigits(estimate.comparableCount)} (سال‌های {toPersianDigits(estimate.comparableYears.join("، "))})
          </p>
          <h3>حساسیت به بهبود هر درس</h3>
          <ul>
            {Object.entries(estimate.sensitivity).map(([subject, delta]) => (
              <li key={subject}>
                {subject}: {delta === 0 ? "بدون داده کافی" : `${delta > 0 ? "+" : ""}${toPersianDigits(delta)} تغییر در میانه رتبه`}
              </li>
            ))}
          </ul>
          <p className="muted-copy">{estimate.methodology}</p>
        </section>
      )}
      {!estimate && !loading && <EmptyState title="هنوز تخمینی ثبت نشده است" description="درصد درس‌ها را وارد کن تا تحلیل اولیه‌ات از طریق سرویس واقعی محاسبه شود." />}
    </main>
  );
}
