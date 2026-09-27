"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import modelJson from "../../../content/rank-model-1277.json";
import { formatPersianNumber, toEnglishDigits, toPersianDigits } from "../../../lib/format";
import {
  BOXES,
  CODE_LABELS,
  CODES,
  PERCENT_MIN,
  QUESTIONS_1405,
  admissionFit,
  estimateCode,
  percentFromAnswers,
  rankWithMore,
  roundRank,
  yearsFor,
  type AdmissionFit,
  type CodeEstimate,
  type CodeKey,
  type Quota,
  type RankModel,
} from "../../../lib/rank-model";

const model = modelJson as unknown as RankModel;
const STORAGE_KEY = "kunkur01:rank-calculator:v1";

type Mode = "percent" | "answers";
interface AnswerRow { correct: string; wrong: string; questions: string }
interface Saved { quota: Quota; mode: Mode; percents: string[]; answers: AnswerRow[]; gpa: string; year: number }

const emptyAnswers = (): AnswerRow[] => QUESTIONS_1405.map((count) => ({ correct: "", wrong: "", questions: String(count) }));
const SAMPLE: Pick<Saved, "percents" | "gpa"> = { percents: ["56", "21", "30", "47", "42", "35"], gpa: "17.8" };

const fitLabels: Record<AdmissionFit, string> = {
  strong: "بهتر از بیشتر قبولی‌ها",
  within: "در محدودهٔ قبولی‌ها",
  edge: "نزدیک مرز قبولی",
  far: "دور",
};

const fa = (value: number, digits = 0) => formatPersianNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const faRank = (rank: number) => fa(roundRank(rank));

function parseNumber(raw: string): number | null {
  const text = toEnglishDigits(raw.trim()).replace(/[−–]/g, "-").replace(/[٪%]/g, "").replace(/,/g, "");
  if (text === "" || text === "-" || text === ".") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Keep what the student typed, shown with Persian digits. */
const typed = (raw: string) => toPersianDigits(raw.replace(/[^\d۰-۹٠-٩.٫\-−]/g, "")).replace(/\./g, "٫");

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function RankCalculator() {
  const [quota, setQuota] = useState<Quota>("free");
  const [mode, setMode] = useState<Mode>("percent");
  const [percents, setPercents] = useState<string[]>(() => BOXES.map(() => ""));
  const [answers, setAnswers] = useState<AnswerRow[]>(emptyAnswers);
  const [gpa, setGpa] = useState("");
  const [year, setYear] = useState(1404);
  const [restored, setRestored] = useState(false);

  // Inputs stay on this device only, so a student can come back to them.
  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setQuota(saved.quota === "5_percent" ? "5_percent" : "free");
      setMode(saved.mode === "answers" ? "answers" : "percent");
      if (Array.isArray(saved.percents) && saved.percents.length === BOXES.length) setPercents(saved.percents);
      if (Array.isArray(saved.answers) && saved.answers.length === BOXES.length) setAnswers(saved.answers);
      if (typeof saved.gpa === "string") setGpa(saved.gpa);
      if (typeof saved.year === "number") setYear(saved.year);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ quota, mode, percents, answers, gpa, year } satisfies Saved));
    } catch {
      /* storage blocked: the calculator still works */
    }
  }, [restored, quota, mode, percents, answers, gpa, year]);

  const years = useMemo(() => yearsFor(model, quota), [quota]);
  const activeYear = years.find((item) => item.year === year) ?? years[years.length - 1];

  // One value per box, or an error message for the box.
  const boxValues = useMemo(() => BOXES.map((_, index) => {
    if (mode === "percent") {
      const value = parseNumber(percents[index]);
      if (value === null) return { value: null, error: null };
      if (value < PERCENT_MIN - 0.01 || value > 100) return { value: null, error: "درصد باید بین منفی ۳۳٫۳ و ۱۰۰ باشد." };
      return { value, error: null };
    }
    const row = answers[index];
    const correct = parseNumber(row.correct) ?? (row.correct.trim() === "" && row.wrong.trim() !== "" ? 0 : null);
    const wrong = parseNumber(row.wrong) ?? 0;
    const questions = parseNumber(row.questions);
    if (correct === null) return { value: null, error: null };
    if (!questions || questions <= 0 || !Number.isInteger(questions)) return { value: null, error: "تعداد تست را درست وارد کن." };
    if (correct < 0 || wrong < 0 || !Number.isInteger(correct) || !Number.isInteger(wrong)) return { value: null, error: "تعداد درست و غلط باید عدد صحیح باشد." };
    if (correct + wrong > questions) return { value: null, error: "درست و غلط از تعداد تست بیشتر شده." };
    return { value: percentFromAnswers(correct, wrong, questions), error: null };
  }), [mode, percents, answers]);

  const gpaValue = parseNumber(gpa);
  const gpaError = gpaValue !== null && (gpaValue < 10 || gpaValue > 20) ? "معدل باید بین ۱۰ و ۲۰ باشد." : null;
  const filled = boxValues.filter((box) => box.value !== null).length;
  const hasError = boxValues.some((box) => box.error !== null) || gpaError !== null;
  const ready = filled === BOXES.length && gpaValue !== null && !gpaError;
  const values = useMemo(() => boxValues.map((box) => box.value ?? 0), [boxValues]);

  const perYear = useMemo(() => {
    if (!ready || gpaValue === null) return [];
    return years.map((item) => ({
      year: item,
      codes: CODES.map((code) => estimateCode(model, item, code, values, gpaValue)).filter((value): value is CodeEstimate => value !== null),
    }));
  }, [ready, gpaValue, years, values]);

  const current = perYear.find((item) => item.year.year === activeYear.year);
  const best = current ? [...current.codes].sort((a, b) => a.rank - b.rank)[0] : null;

  const gains = useMemo(() => {
    if (!best || gpaValue === null) return [];
    return BOXES.map((box, index) => {
      const next = rankWithMore(model, activeYear, best.code, values, gpaValue, index, 10);
      return { box, index, next, room: values[index] < 100 };
    })
      .filter((item) => item.next !== null && item.room)
      .sort((a, b) => (a.next as number) - (b.next as number));
  }, [best, activeYear, gpaValue, values]);

  const programs = useMemo(() => {
    if (!current || quota !== "free") return [];
    const byCode = new Map(current.codes.map((estimate) => [estimate.code, estimate]));
    return model.admissions
      .map((pair) => {
        const estimate = byCode.get(String(pair.code) as CodeKey);
        return estimate ? { pair, estimate, fit: admissionFit(pair, estimate.rank) } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.fit !== "far");
  }, [current, quota]);

  function setPercent(index: number, raw: string) {
    setPercents((prev) => prev.map((value, i) => (i === index ? typed(raw) : value)));
  }
  function setAnswer(index: number, key: keyof AnswerRow, raw: string) {
    setAnswers((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: toPersianDigits(raw.replace(/[^\d۰-۹٠-٩]/g, "")) } : row)));
  }
  function switchMode(next: Mode) {
    if (next === mode) return;
    // Carry the computed percentages over, so the form never empties itself.
    if (next === "percent") {
      setPercents(boxValues.map((box, index) => (box.value === null ? percents[index] : typed(String(Math.round(box.value * 100) / 100)))));
    }
    setMode(next);
  }
  function fillSample() {
    setMode("percent");
    setPercents(SAMPLE.percents.map(toPersianDigits));
    setGpa(toPersianDigits(SAMPLE.gpa));
  }
  function clearAll() {
    setPercents(BOXES.map(() => ""));
    setAnswers(emptyAnswers());
    setGpa("");
  }

  return (
    <div className="rc-tool">
      <form className="rc-form" onSubmit={(event) => event.preventDefault()} aria-labelledby="rc-form-title">
        <div className="rc-form-head">
          <h2 id="rc-form-title">کارنامه‌ات را وارد کن</h2>
          <div className="rc-form-actions">
            <button type="button" className="rc-link-btn" onClick={fillSample}>پر کردن نمونه</button>
            <button type="button" className="rc-link-btn" onClick={clearAll}>پاک کردن</button>
          </div>
        </div>

        <fieldset className="rc-segment">
          <legend>سهمیه</legend>
          {([["free", "آزاد"], ["5_percent", "۵٪ ایثارگران"]] as const).map(([value, label]) => (
            <label key={value} data-on={quota === value || undefined}>
              <input type="radio" name="rc-quota" className="sr-only" checked={quota === value} onChange={() => setQuota(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset className="rc-segment">
          <legend>نوع ورود</legend>
          {([["percent", "درصد هر درس"], ["answers", "تعداد درست و غلط"]] as const).map(([value, label]) => (
            <label key={value} data-on={mode === value || undefined}>
              <input type="radio" name="rc-mode" className="sr-only" checked={mode === value} onChange={() => switchMode(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="rc-boxes" role="group" aria-label="درس‌ها">
          {BOXES.map((box, index) => {
            const state = boxValues[index];
            return (
              <div className="rc-box" key={box.key} data-error={state.error ? true : undefined}>
                <span className="rc-box-name" id={`rc-box-${box.key}`}>{box.title}</span>
                {mode === "percent" ? (
                  <label className="rc-percent">
                    <span className="sr-only">درصد {box.title}</span>
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      autoComplete="off"
                      placeholder="—"
                      value={percents[index]}
                      onChange={(event) => setPercent(index, event.target.value)}
                      aria-describedby={`rc-box-${box.key}`}
                      aria-invalid={state.error ? true : undefined}
                    />
                    <i aria-hidden="true">٪</i>
                  </label>
                ) : (
                  <div className="rc-answers">
                    <label><span>درست</span><input inputMode="numeric" dir="ltr" autoComplete="off" value={answers[index].correct} onChange={(event) => setAnswer(index, "correct", event.target.value)} aria-label={`تعداد درست ${box.title}`} /></label>
                    <label><span>غلط</span><input inputMode="numeric" dir="ltr" autoComplete="off" value={answers[index].wrong} onChange={(event) => setAnswer(index, "wrong", event.target.value)} aria-label={`تعداد غلط ${box.title}`} /></label>
                    <label><span>از</span><input inputMode="numeric" dir="ltr" autoComplete="off" value={answers[index].questions} onChange={(event) => setAnswer(index, "questions", event.target.value)} aria-label={`تعداد تست ${box.title}`} /></label>
                    <output className="rc-answers-percent tnum" aria-label={`درصد ${box.title}`}>
                      {state.value === null ? "—" : `${fa(state.value, 1)}٪`}
                    </output>
                  </div>
                )}
                {state.error && <p className="rc-box-error" role="alert">{state.error}</p>}
              </div>
            );
          })}
        </div>
        {mode === "answers" && (
          <p className="rc-hint">تعداد تست‌ها از کنکور ۱۴۰۵ پر شده؛ اگر آزمونت تعداد دیگری داشت، عوضش کن. درصد با فرمول سنجش حساب می‌شود: هر سه غلط یک درست را می‌برد.</p>
        )}

        <label className="rc-gpa">
          <span>معدل کارشناسی</span>
          <input inputMode="decimal" dir="ltr" autoComplete="off" placeholder="مثلاً ۱۷٫۵" value={gpa} onChange={(event) => setGpa(typed(event.target.value))} aria-invalid={gpaError ? true : undefined} />
        </label>
        {gpaError && <p className="rc-box-error" role="alert">{gpaError}</p>}
        <p className="rc-hint">معدل در رتبه اثر دارد؛ اگر هنوز فارغ‌التحصیل نشده‌ای، معدل فعلی‌ات را بزن.</p>
      </form>

      <section className="rc-result" aria-labelledby="rc-result-title" aria-live="polite">
        <div className="rc-result-head">
          <h2 id="rc-result-title">رتبهٔ تخمینی</h2>
          <div className="rc-years" role="group" aria-label="سال مرجع">
            {years.map((item) => (
              <button
                type="button"
                key={item.year}
                className="rc-year"
                aria-pressed={item.year === activeYear.year}
                onClick={() => setYear(item.year)}
              >
                {toPersianDigits(item.year)}
              </button>
            ))}
          </div>
        </div>

        {!ready || !current ? (
          <div className="rc-empty">
            <strong>{hasError ? "یکی از عددها درست نیست؛ کنار همان درس را ببین." : filled === 0 ? "درصد شش درس و معدلت را وارد کن." : `${toPersianDigits(BOXES.length - filled)} درس دیگر${gpaValue === null ? " و معدل" : ""} مانده.`}</strong>
            <p>نتیجه همین‌جا و بدون ثبت‌نام ساخته می‌شود؛ چیزی برای ما فرستاده نمی‌شود.</p>
          </div>
        ) : (
          <>
            <p className="rc-year-note">
              اگر این کارنامه در کنکور <b>{toPersianDigits(activeYear.year)}</b> بود، در سهمیهٔ {quota === "free" ? "آزاد" : "۵٪"}، بر پایهٔ {fa(activeYear.cards)} کارنامهٔ واقعی همان سال:
            </p>
            <div className="rc-codes">
              {current.codes.map((estimate) => (
                <CodeCard key={estimate.code} estimate={estimate} best={estimate.code === best?.code} />
              ))}
            </div>

            <YearTable perYear={perYear} activeYear={activeYear.year} onPick={setYear} />

            {best && gains.length > 0 && (
              <div className="rc-block">
                <h3>ده درصد بیشتر در کدام درس، بیشترین اثر را دارد؟</h3>
                <p className="rc-block-lead">برای کد {toPersianDigits(best.code)} ({CODE_LABELS[best.code].title})، بهترین کدت در {toPersianDigits(activeYear.year)}:</p>
                <ul className="rc-gains">
                  {gains.map((item) => {
                    const next = item.next as number;
                    const share = Math.max(0, Math.min(1, (best.rank - next) / best.rank));
                    return (
                      <li key={item.box.key}>
                        <span>{item.box.short}</span>
                        <span className="rc-gain-bar" aria-hidden="true"><i style={{ inlineSize: `${Math.max(4, share * 100)}%` }} /></span>
                        <b className="tnum">{faRank(best.rank)} ← {faRank(next)}</b>
                      </li>
                    );
                  })}
                </ul>
                <p className="rc-hint">اثر هر درس به ضریبش در این کد و تعداد کسانی بستگی دارد که در همان محدوده‌اند.</p>
              </div>
            )}

            {best && gpaValue !== null && (
              <div className="rc-block rc-gpa-effect">
                <h3>اثر معدل</h3>
                <p>
                  در {toPersianDigits(activeYear.year)} هر یک نمره معدل تقریباً به اندازهٔ {fa(activeYear.gpaShift, 2)} درصد میانگین وزنی ارزش داشت.
                  {gpaValue <= 19 && (() => {
                    const higher = estimateCode(model, activeYear, best.code, values, gpaValue + 1);
                    return higher ? <> با همین درصدها و معدل {fa(gpaValue + 1, 2)}، رتبهٔ کد {toPersianDigits(best.code)} حدود <b className="tnum">{faRank(higher.rank)}</b> می‌شد.</> : null;
                  })()}
                </p>
              </div>
            )}

            {quota === "free" && (
              <div className="rc-block">
                <h3>با این رتبه، کجا قبول شده‌اند؟</h3>
                <p className="rc-block-lead">
                  رتبه‌ات در کد هر رشته‌محل با رتبهٔ قبول‌شده‌های روزانهٔ سهمیهٔ آزاد ۱۴۰۰ تا ۱۴۰۴ در {toPersianDigits(model.admissions.length)} رشته‌محل پرطرفدار مقایسه شده است. روی هم رفته رتبهٔ قبولی رشته‌محل‌ها در این سال‌ها کم جابه‌جا شد؛ چیزی که از سالی به سال دیگر عوض می‌شود، رتبه‌ای است که درصدهای تو می‌گیرد. سال مرجع را عوض کن و ببین فهرست چطور تغییر می‌کند.
                </p>
                {programs.length === 0 ? (
                  <p className="rc-empty-inline">رتبه‌ات در سال {toPersianDigits(activeYear.year)} از رتبه‌های قبولی این رشته‌محل‌ها عقب‌تر است. فهرست کامل رشته‌محل‌ها بیشتر از این‌هاست؛ در انتخاب‌رشته همهٔ آن‌ها را ببین.</p>
                ) : (
                  <ul className="rc-programs">
                    {programs.map(({ pair, estimate, fit }) => (
                      <li key={`${pair.program}-${pair.university}`} data-fit={fit}>
                        <div>
                          <strong>{pair.program} {pair.university}</strong>
                          <span className="tnum">
                            کد {toPersianDigits(pair.code)} · میانهٔ رتبهٔ قبولی‌ها {fa(pair.median)} · نیمهٔ وسط {fa(pair.p25)} تا {fa(pair.p75)}
                          </span>
                        </div>
                        <em>{fitLabels[fit]}<small className="tnum"> · رتبهٔ تو {faRank(estimate.rank)}</small></em>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="rc-hint">
                  این رتبه‌ها از کارنامه‌هایی است که داوطلب‌ها منتشر کرده‌اند، پس مرز واقعی قبولی ممکن است عقب‌تر باشد. ظرفیت و رقابت هر سال فرق می‌کند.{" "}
                  <Link href="/articles/admitted-ranks-by-university">جدول کامل رتبهٔ قبولی‌ها</Link>
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CodeCard({ estimate, best }: { estimate: CodeEstimate; best: boolean }) {
  const label = CODE_LABELS[estimate.code];
  const rankText =
    estimate.edge === "better" ? `${faRank(estimate.rank)} یا بهتر`
      : estimate.edge === "worse" ? `بیشتر از ${faRank(estimate.rank)}`
        : `حدود ${faRank(estimate.rank)}`;
  return (
    <article className="rc-code" data-best={best || undefined}>
      <header>
        <span className="rc-code-num">کد {toPersianDigits(estimate.code)}</span>
        <h3>{label.title}</h3>
        {best && <span className="rc-code-best">بهترین کدت</span>}
      </header>
      <strong className="rc-code-rank tnum">{rankText}</strong>
      {estimate.edge === "inside" ? (
        <p className="rc-code-band tnum">
          ۸۰٪ کارنامه‌های مشابه: {faRank(estimate.low80)} تا {faRank(estimate.high80)}
        </p>
      ) : (
        <p className="rc-code-band">
          {estimate.edge === "better" ? "از بهترین کارنامه‌های این سال هم بهتری." : "پایین‌تر از کارنامه‌های موجود این سال؛ بازه قابل اعتماد نیست."}
        </p>
      )}
      <p className="rc-code-avg tnum">میانگین وزنی {formatPersianNumber(estimate.average, { maximumFractionDigits: 1 })}٪ · {label.programs}</p>
    </article>
  );
}

function YearTable({ perYear, activeYear, onPick }: { perYear: { year: { year: number }; codes: CodeEstimate[] }[]; activeYear: number; onPick: (year: number) => void }) {
  return (
    <div className="rc-block">
      <h3>همین کارنامه در سال‌های مختلف</h3>
      <p className="rc-block-lead">سختی آزمون و تعداد داوطلب هر سال فرق می‌کند؛ برای همین یک کارنامه در هر سال رتبهٔ دیگری گرفته است. کنکور تو هم ممکن است به هر کدام از این سال‌ها شبیه‌تر باشد.</p>
      <div className="rc-table-wrap">
        <table className="rc-table">
          <thead>
            <tr>
              <th scope="col">سال</th>
              {CODES.map((code) => <th scope="col" key={code}>کد {toPersianDigits(code)}<small>{CODE_LABELS[code].title}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {perYear.map((row) => (
              <tr key={row.year.year} data-on={row.year.year === activeYear || undefined} onClick={() => onPick(row.year.year)}>
                <th scope="row">{toPersianDigits(row.year.year)}</th>
                {CODES.map((code) => {
                  const estimate = row.codes.find((item) => item.code === code);
                  return (
                    <td key={code} className="tnum">
                      {!estimate ? "—" : estimate.edge === "better" ? `≤ ${faRank(estimate.rank)}` : estimate.edge === "worse" ? `> ${faRank(estimate.rank)}` : faRank(estimate.rank)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
