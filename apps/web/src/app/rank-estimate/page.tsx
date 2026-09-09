"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader, StatCard } from "../../components/ui";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";

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

const confidenceLabels: Record<string, string> = {
  LOW: "کم",
  MEDIUM: "متوسط",
  HIGH: "بیشتر",
};

function formatRank(value: number): string {
  return toPersianDigits(value.toLocaleString("en-US"));
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
      setError(err instanceof ApiError && err.status === 400
        ? "برای ساخت بازه، حداقل پنج کارنامه با دست‌کم دو درس مشترک لازم است."
        : err instanceof Error ? err.message : "تخمین رتبه ناموفق بود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-container">
      <PageHeader eyebrow="تحلیل عملکرد" title="تخمین رتبه" description="با داده‌های عملکردی و کارنامه‌های مشابه، جایگاه احتمالی‌ات را بهتر درک کن." />
      <div className="surface-card surface-card-muted analysis-note">
      <p>
        این تخمین بر اساس مقایسه با کارنامه‌های ثبت‌شدهٔ مشابه محاسبه می‌شود؛ یک عدد قطعی نیست.
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
          <div className="section-heading"><div><h2>نتیجهٔ آخرین محاسبه</h2><p>این خروجی توزیع رتبه در کارنامه‌های مشابه را نشان می‌دهد، نه رتبهٔ قطعی آینده.</p></div></div>
          <div className="stats-grid">
            <StatCard
              label="میانهٔ نمونه‌های مشابه"
              value={formatRank(estimate.rankMedian)}
              detail={`سطح حجم نمونه: ${confidenceLabels[estimate.confidence] ?? estimate.confidence}`}
              tone="teal"
            />
            <StatCard
              label="بازهٔ مرکزی ۵۰٪"
              value={`${formatRank(estimate.rankP50Low)} تا ${formatRank(estimate.rankP50High)}`}
              detail="از صدک ۲۵ تا ۷۵ نمونه‌های مشابه"
              tone="blue"
            />
            <StatCard
              label="بازهٔ مرکزی ۸۰٪"
              value={`${formatRank(estimate.rankP80Low)} تا ${formatRank(estimate.rankP80High)}`}
              detail="از صدک ۱۰ تا ۹۰ نمونه‌های مشابه"
              tone="purple"
            />
          </div>
          <div className="surface-card surface-card-muted analysis-note">
            <p><strong>پشتوانهٔ این محاسبه:</strong> {toPersianDigits(estimate.comparableCount)} کارنامهٔ قابل مقایسه</p>
            <p>حداقل لازم برای محاسبه: ۵ کارنامه با دست‌کم دو درس مشترک</p>
            <p>
              سال‌های داده: {estimate.comparableYears.length > 0
                ? toPersianDigits([...estimate.comparableYears].sort((a, b) => a - b).join("، "))
                : "ثبت نشده"}
            </p>
          </div>
          <h3>حساسیت به بهبود هر درس</h3>
          <p className="muted-copy">این بخش جابه‌جایی میانهٔ همین نمونه‌ها را پس از افزایش فرضی ۱۰ واحد درصد در یک درس نشان می‌دهد؛ پیش‌بینی اثر قطعی مطالعه نیست.</p>
          <ul>
            {Object.entries(estimate.sensitivity).map(([subject, delta]) => (
              <li key={subject}>
                {subject}: {delta === 0
                  ? "برای سنجش تغییر، دادهٔ کافی وجود ندارد"
                  : `${toPersianDigits(Math.abs(delta))} رتبه جابه‌جایی در میانهٔ همین نمونه‌ها`}
              </li>
            ))}
          </ul>
          <h3>محدودیت‌های تفسیر</h3>
          <ul>
            <li>بازه‌ها صدک‌های تجربی کارنامه‌های مشابه‌اند و فاصلهٔ اطمینان آماری یا تضمین قبولی نیستند.</li>
            <li>ظرفیت دانشگاه‌ها، سختی آزمون، سهمیه و رفتار انتخاب‌رشته در هر سال تغییر می‌کند.</li>
            <li>شباهت فقط از درس‌های مشترک و داده‌های ثبت‌شده سنجیده می‌شود؛ کیفیت مطالعه را اندازه نمی‌گیرد.</li>
          </ul>
          <details>
            <summary>روش محاسبه</summary>
            <p className="muted-copy" dir="ltr">{estimate.methodology}</p>
          </details>
          <div className="page-header-action">
            <Link className="button button-primary" href="/programs">بررسی برنامه‌های دانشگاهی</Link>
            <Link className="button button-secondary" href="/report-cards">دیدن کارنامه‌های عمومی</Link>
          </div>
        </section>
      )}
      {!estimate && !loading && <EmptyState title="هنوز تخمینی ثبت نشده است" description="درصد درس‌ها را وارد کن تا تحلیل اولیه‌ات از طریق سرویس واقعی محاسبه شود." />}
      <AdmissionsJourney current="estimate" />
    </main>
  );
}
