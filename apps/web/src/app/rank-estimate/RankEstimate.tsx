"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { useAvailability } from "../../lib/availability";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import { TARGET_FIELDS } from "../account/profile-options";

export interface SubjectOption { code: string; title: string }

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

const confidenceLabels: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "بیشتر" };

/** Quota codes as the report-card data stores them. */
const QUOTAS = [
  { value: "region-1", label: "منطقهٔ ۱" },
  { value: "region-2", label: "منطقهٔ ۲" },
  { value: "region-3", label: "منطقهٔ ۳" },
];

function formatRank(value: number): string {
  return toPersianDigits(value.toLocaleString("en-US"));
}

/** Where a rank sits on the 80% band, as a percentage of its width. */
function position(value: number, low: number, high: number) {
  if (high <= low) return 50;
  return Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100));
}

export function RankEstimate({ subjects }: { subjects: SubjectOption[] }) {
  // Estimates compare against published report cards; with none yet, say so.
  const noEvidence = useAvailability()?.reportCards === 0;
  const router = useRouter();
  const [degree, setDegree] = useState<"master" | "phd">("master");
  const [field, setField] = useState<string>(TARGET_FIELDS[0].value);
  const [quota, setQuota] = useState(QUOTAS[0].value);
  const [scores, setScores] = useState<SubjectScore[]>([{ subjectCode: "algorithms", percent: "" }]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const titleOf = useMemo(() => {
    const map = new Map(subjects.map((subject) => [subject.code, subject.title]));
    return (code: string) => map.get(code) ?? code;
  }, [subjects]);

  useEffect(() => {
    // A first-time visitor has no previous estimate, so a failure here is
    // the ordinary case rather than an error worth showing.
    apiFetch<Estimate>("/me/rank-estimates/latest").then(setEstimate).catch(() => setEstimate(null));
  }, []);

  function updateScore(index: number, key: keyof SubjectScore, value: string) {
    setScores((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function removeScore(index: number) {
    setScores((prev) => prev.filter((_, i) => i !== index));
  }

  function addScore() {
    const used = new Set(scores.map((row) => row.subjectCode));
    const next = subjects.find((subject) => !used.has(subject.code))?.code ?? "";
    setScores((prev) => [...prev, { subjectCode: next, percent: "" }]);
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
          subjectScores: scores.map((row) => ({ subjectCode: row.subjectCode, percent: Number(toEnglishDigits(row.percent)) })),
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
        : err instanceof Error ? err.message : "تخمین رتبه انجام نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="re">
      <header className="re-top">
        <div className="re-wrap">
          <p className="re-kicker">تخمین رتبه</p>
          <h1>با درصدهایت، بازهٔ رتبه‌ات را ببین</h1>
          <p>درصدها با کارنامه‌های ثبت‌شدهٔ مشابه مقایسه می‌شوند؛ خروجی یک بازه است، نه یک عدد قطعی.</p>
          <p>
            ارشد مهندسی کامپیوتر می‌خوانی؟{" "}
            <Link href="/rank-calculator/master-computer-engineering">تخمین رتبهٔ هر چهار کد با کارنامه‌های ۱۴۰۰ تا ۱۴۰۵، بدون ورود ←</Link>
          </p>
        </div>
      </header>

      <div className="re-wrap re-layout">
        <form className="re-form" onSubmit={submit} aria-labelledby="re-form-title">
          <h2 id="re-form-title">مشخصات و درصدها</h2>
          {noEvidence && (
            <p className="soon-banner" role="status">
              <span className="soon-pill">به‌زودی</span>
              کارنامه‌های مرجع هنوز منتشر نشده‌اند؛ تا آن موقع ممکن است بازه‌ای ساخته نشود.
            </p>
          )}

          <fieldset className="re-segment">
            <legend>مقطع</legend>
            {(["master", "phd"] as const).map((value) => (
              <label key={value} data-on={degree === value || undefined}>
                <input type="radio" name="degree" className="sr-only" checked={degree === value} onChange={() => setDegree(value)} />
                {value === "master" ? "ارشد" : "دکتری"}
              </label>
            ))}
          </fieldset>

          <div className="re-row">
            <label className="re-field">
              <span>رشته</span>
              <select value={field} onChange={(e) => setField(e.target.value)}>
                {TARGET_FIELDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="re-field">
              <span>سهمیه</span>
              <select value={quota} onChange={(e) => setQuota(e.target.value)}>
                {QUOTAS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="re-scores">
            <legend>درصد هر درس</legend>
            {scores.map((row, index) => (
              <div className="re-score" key={index}>
                <label className="sr-only" htmlFor={`re-subject-${index}`}>درس {toPersianDigits(index + 1)}</label>
                <select id={`re-subject-${index}`} value={row.subjectCode} onChange={(e) => updateScore(index, "subjectCode", e.target.value)} required>
                  <option value="" disabled>انتخاب درس</option>
                  {subjects.map((subject) => <option key={subject.code} value={subject.code}>{subject.title}</option>)}
                </select>
                <label className="sr-only" htmlFor={`re-percent-${index}`}>درصد {titleOf(row.subjectCode)}</label>
                <input
                  id={`re-percent-${index}`}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="٪"
                  value={row.percent}
                  onChange={(e) => updateScore(index, "percent", toPersianDigits(e.target.value))}
                  required
                />
                <button type="button" className="re-remove" onClick={() => removeScore(index)} disabled={scores.length === 1} aria-label={`حذف ${titleOf(row.subjectCode)}`}>
                  ×
                </button>
              </div>
            ))}
            <button className="re-add" type="button" onClick={addScore}>+ افزودن درس</button>
          </fieldset>

          <button className="ds-btn ds-btn-primary re-submit" type="submit" disabled={loading}>
            {loading ? "در حال محاسبه…" : "محاسبهٔ بازهٔ رتبه"}
          </button>
          {error && <p className="re-error" role="alert">{error}</p>}
        </form>

        <section className="re-result" aria-labelledby="re-result-title" aria-live="polite">
          <h2 id="re-result-title">نتیجه</h2>
          {!estimate ? (
            <p className="re-empty">درصد درس‌ها را وارد کن و «محاسبه» را بزن؛ نتیجه همین‌جا می‌آید.</p>
          ) : (
            <>
              <div className="re-median">
                <span>میانهٔ کارنامه‌های مشابه</span>
                <strong className="tnum">رتبهٔ {formatRank(estimate.rankMedian)}</strong>
              </div>

              {/* Better ranks (smaller numbers) start at the reading start. */}
              <div className="re-range" role="img" aria-label={`بازهٔ ۸۰٪ از ${formatRank(estimate.rankP80Low)} تا ${formatRank(estimate.rankP80High)}، بازهٔ ۵۰٪ از ${formatRank(estimate.rankP50Low)} تا ${formatRank(estimate.rankP50High)}`}>
                <div className="re-band">
                  <span
                    className="re-band-mid"
                    style={{
                      insetInlineStart: `${position(estimate.rankP50Low, estimate.rankP80Low, estimate.rankP80High)}%`,
                      insetInlineEnd: `${100 - position(estimate.rankP50High, estimate.rankP80Low, estimate.rankP80High)}%`,
                    }}
                  />
                  <span className="re-band-median" style={{ insetInlineStart: `${position(estimate.rankMedian, estimate.rankP80Low, estimate.rankP80High)}%` }} />
                </div>
                <div className="re-band-scale tnum">
                  <span>{formatRank(estimate.rankP80Low)}</span>
                  <span>{formatRank(estimate.rankP80High)}</span>
                </div>
              </div>

              <dl className="re-facts">
                <div><dt>بازهٔ ۵۰٪ میانی</dt><dd className="tnum">{formatRank(estimate.rankP50Low)} تا {formatRank(estimate.rankP50High)}</dd></div>
                <div><dt>بازهٔ ۸۰٪ میانی</dt><dd className="tnum">{formatRank(estimate.rankP80Low)} تا {formatRank(estimate.rankP80High)}</dd></div>
                <div><dt>کارنامهٔ قابل مقایسه</dt><dd className="tnum">{toPersianDigits(estimate.comparableCount)}</dd></div>
                <div><dt>اعتبار حجم نمونه</dt><dd>{confidenceLabels[estimate.confidence] ?? estimate.confidence}</dd></div>
              </dl>

              {Object.keys(estimate.sensitivity).length > 0 && (
                <div className="re-sense">
                  <h3>اگر ۱۰ درصد بیشتر بزنی</h3>
                  <ul>
                    {Object.entries(estimate.sensitivity).map(([subject, delta]) => (
                      <li key={subject}>
                        <span>{titleOf(subject)}</span>
                        <b className="tnum">
                          {delta === 0 ? "دادهٔ کافی نیست" : `حدود ${toPersianDigits(Math.abs(delta))} رتبه بهتر`}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="re-limits">
                <summary>این بازه را چطور بخوانم؟</summary>
                <ul>
                  <li>بازه‌ها صدک‌های کارنامه‌های مشابه‌اند، نه فاصلهٔ اطمینان آماری یا تضمین قبولی.</li>
                  <li>سختی آزمون، ظرفیت و رفتار انتخاب‌رشته هر سال فرق می‌کند.</li>
                  <li>
                    سال‌های داده:{" "}
                    {estimate.comparableYears.length > 0
                      ? toPersianDigits([...estimate.comparableYears].sort((a, b) => a - b).join("، "))
                      : "ثبت نشده"}
                  </li>
                </ul>
                <p dir="ltr">{estimate.methodology}</p>
              </details>

              <div className="re-next">
                <Link className="ds-btn ds-btn-secondary" href="/programs">رشته‌محل‌ها</Link>
                <Link className="ds-btn ds-btn-ghost" href="/report-cards">کارنامه‌های عمومی</Link>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="re-wrap">
        <AdmissionsJourney current="estimate" />
      </div>
    </main>
  );
}
