"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BuyButton } from "../../components/BuyButton";
import { Alert, Badge, Button, DsEmptyState, SkeletonRows } from "../../components/ds";
import { Glyph } from "../../components/SubjectIcon";
import { apiFetch, ApiError } from "../../lib/api";
import { formatRial, toEnglishDigits, toPersianDigits } from "../../lib/format";

interface TopicOption {
  code: string;
  title: string;
  total: number;
  available: number;
}

interface SubjectOption {
  code: string;
  title: string;
  slug: string | null;
  hasBankAccess: boolean;
  total: number;
  available: number;
  topics: TopicOption[];
}

interface PracticeExam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number | null;
  createdAt: string;
  attemptCount: number;
  latestAttempt: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
    score: { correctCount: number; wrongCount: number; unansweredCount: number; percentCorrect: number } | null;
  } | null;
}

interface BankProduct {
  id: string;
  title: string;
  kind: string;
  prices: { amountRial: number }[];
  questionBankGrants: { subjectCode: string }[];
}

type Source = "ALL" | "UNSEEN" | "MISTAKES";

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "ALL", label: "همهٔ سؤال‌ها", hint: "از کل سؤال‌های در دسترس" },
  { value: "UNSEEN", label: "فقط ندیده‌ها", hint: "سؤال‌هایی که در هیچ آزمونی نداشته‌ای" },
  { value: "MISTAKES", label: "فقط اشتباه‌ها", hint: "آخرین پاسخت به آن‌ها غلط بوده" },
];

const MINUTES_PER_QUESTION = 1.5;

const dateFormat = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

export function PracticeBuilder() {
  const router = useRouter();
  const [options, setOptions] = useState<SubjectOption[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mine, setMine] = useState<PracticeExam[]>([]);
  const [products, setProducts] = useState<BankProduct[]>([]);

  const [subjectCode, setSubjectCode] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [source, setSource] = useState<Source>("ALL");
  const [count, setCount] = useState("10");
  const [customTime, setCustomTime] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [preview, setPreview] = useState<{ available: number; hasBankAccess: boolean } | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retaking, setRetaking] = useState<string | null>(null);

  function load() {
    setLoadError(false);
    apiFetch<SubjectOption[]>("/me/practice/options")
      .then((list) => {
        setOptions(list);
        setSubjectCode((current) => current || list.find((subject) => subject.available > 0)?.code || list[0]?.code || "");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setSignedOut(true);
        else setLoadError(true);
      });
    apiFetch<PracticeExam[]>("/me/practice").then(setMine).catch(() => setMine([]));
  }

  useEffect(() => {
    load();
    apiFetch<BankProduct[]>("/products")
      .then((list) => setProducts(list.filter((product) => product.kind === "QUESTION_BANK")))
      .catch(() => setProducts([]));
  }, []);

  const subject = useMemo(() => options?.find((option) => option.code === subjectCode) ?? null, [options, subjectCode]);

  // The exact pool for the current choice. Topic counts cannot simply be
  // added up (a question can sit under two topics), so the API counts.
  useEffect(() => {
    if (!subjectCode) return;
    setPreview(null);
    const timer = window.setTimeout(() => {
      apiFetch<{ available: number; hasBankAccess: boolean }>("/me/practice/preview", {
        method: "POST",
        body: { subjectCode, topicCodes: topics, source },
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [subjectCode, topics, source]);

  const available = preview?.available ?? null;
  const countNumber = Number(toEnglishDigits(count)) || 0;

  // A narrower choice (one topic, or only mistakes) often has fewer questions
  // than the count already set; bring the count down to fit instead of
  // letting the build fail. Typing a larger number afterwards still warns.
  useEffect(() => {
    if (available === null || available === 0) return;
    setCount((current) => (Number(current) > available ? String(available) : current));
  }, [available]);
  const minutesNumber = Number(toEnglishDigits(minutes)) || 0;
  const defaultMinutes = Math.ceil(countNumber * MINUTES_PER_QUESTION);
  const bankProduct = subject && !subject.hasBankAccess
    ? products.find((product) => product.questionBankGrants.some((grant) => grant.subjectCode === subject.code))
    : undefined;

  function chooseSubject(code: string) {
    setSubjectCode(code);
    setTopics([]);
    setError(null);
  }

  function toggleTopic(code: string) {
    setTopics((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  function explain(err: unknown, retake = false): string | null {
    if (err instanceof ApiError && err.status === 401) {
      router.push("/login?next=/practice");
      return null;
    }
    if (err instanceof ApiError && err.code === "PROFILE_INCOMPLETE") {
      router.push("/account/profile?next=/practice");
      return null;
    }
    if (err instanceof ApiError && err.status === 429) return "امروز به سقف ساخت آزمون تمرینی رسیده‌ای؛ فردا دوباره امتحان کن.";
    if (retake && err instanceof ApiError && err.status === 403) {
      return "دسترسی بانک سؤال این درس تمام شده است؛ برای ادامه آزمون تازه‌ای با سؤال‌های در دسترس بساز.";
    }
    if (err instanceof ApiError && err.status === 400 && typeof err.details?.available === "number") {
      return `برای این انتخاب فقط ${toPersianDigits(err.details.available as number)} سؤال در دسترس است؛ تعداد را کمتر کن.`;
    }
    return "ساخت آزمون ممکن نشد. چند لحظهٔ دیگر دوباره امتحان کن.";
  }

  async function build(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (countNumber < 1) {
      setError("تعداد تست را وارد کن.");
      return;
    }
    if (available !== null && countNumber > available) {
      setError(`برای این انتخاب فقط ${toPersianDigits(available)} سؤال در دسترس است.`);
      return;
    }
    if (customTime && (minutesNumber < 1 || minutesNumber > 300)) {
      setError("زمان آزمون باید بین ۱ تا ۳۰۰ دقیقه باشد.");
      return;
    }
    setBuilding(true);
    try {
      const result = await apiFetch<{ attempt: { id: string } }>("/me/practice", {
        method: "POST",
        body: {
          subjectCode,
          topicCodes: topics,
          source,
          questionCount: countNumber,
          ...(customTime ? { durationMinutes: minutesNumber } : {}),
        },
      });
      router.push(`/attempts/${result.attempt.id}`);
    } catch (err) {
      setError(explain(err));
      setBuilding(false);
    }
  }

  async function retake(examId: string) {
    setRetaking(examId);
    setError(null);
    try {
      const attempt = await apiFetch<{ id: string }>(`/exams/${examId}/start`, { method: "POST" });
      router.push(`/attempts/${attempt.id}`);
    } catch (err) {
      setError(explain(err, true));
      setRetaking(null);
    }
  }

  if (signedOut) {
    return (
      <div className="ds-card ds-card-padded pr-gate">
        <span className="pg-ico"><Glyph name="target" /></span>
        <div>
          <b>برای ساختن آزمون وارد حسابت شو</b>
          <p>آزمون‌ساز نتیجهٔ هر آزمون را به نام خودت نگه می‌دارد تا بتوانی سؤال‌های ندیده یا اشتباه‌هایت را جدا تمرین کنی.</p>
        </div>
        <Link className="ds-btn ds-btn-primary" href="/login?next=/practice">ورود یا ثبت‌نام</Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert tone="danger">
        <span className="ds-grow">فهرست درس‌های آزمون‌ساز بارگذاری نشد.</span>
        <Button size="sm" onClick={load}>تلاش دوباره</Button>
      </Alert>
    );
  }

  if (options === null) return <SkeletonRows rows={5} height="3.2rem" />;

  if (options.length === 0) {
    return (
      <DsEmptyState
        title="بانک سؤال هنوز خالی است"
        description="وقتی نخستین تست‌های بانک منتشر شوند، از همین‌جا می‌توانی با آن‌ها آزمون بسازی."
        action={<Link className="ds-btn ds-btn-secondary" href="/exams">دیدن آزمون‌های آماده</Link>}
      />
    );
  }

  return (
    <div className="pr-layout">
      <form className="ds-card ds-card-padded pr-form" onSubmit={build} noValidate>
        <fieldset className="pr-fieldset">
          <legend>۱. درس</legend>
          <div className="pr-subjects" role="radiogroup" aria-label="درس">
            {options.map((option) => (
              <button
                type="button"
                role="radio"
                aria-checked={option.code === subjectCode}
                key={option.code}
                className={`pr-subject${option.code === subjectCode ? " is-on" : ""}`}
                onClick={() => chooseSubject(option.code)}
              >
                <b>{option.title}</b>
                <small>
                  {option.hasBankAccess
                    ? `${toPersianDigits(option.total)} تست`
                    : `${toPersianDigits(option.available)} از ${toPersianDigits(option.total)} تست باز`}
                </small>
              </button>
            ))}
          </div>
        </fieldset>

        {subject && subject.topics.length > 0 && (
          <fieldset className="pr-fieldset">
            <legend>
              ۲. مبحث <span className="pr-optional">(اختیاری؛ بدون انتخاب، همهٔ مباحث)</span>
            </legend>
            <div className="pr-chips">
              {subject.topics.map((topic) => {
                const on = topics.includes(topic.code);
                return (
                  <button
                    type="button"
                    key={topic.code}
                    aria-pressed={on}
                    className={`pr-chip${on ? " is-on" : ""}`}
                    onClick={() => toggleTopic(topic.code)}
                    disabled={topic.available === 0 && !on}
                  >
                    {topic.title}
                    <span>{toPersianDigits(topic.available)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="pr-fieldset">
          <legend>۳. کدام سؤال‌ها</legend>
          <div className="pr-sources">
            {SOURCES.map((item) => (
              <label key={item.value} className={`pr-source${source === item.value ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="source"
                  value={item.value}
                  checked={source === item.value}
                  onChange={() => setSource(item.value)}
                />
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="pr-fieldset">
          <legend>۴. تعداد و زمان</legend>
          <div className="pr-count-row">
            <label className="ds-field">
              <span className="ds-label">تعداد تست</span>
              <input
                className="ds-input"
                inputMode="numeric"
                value={toPersianDigits(count)}
                onChange={(event) => setCount(toEnglishDigits(event.target.value).replace(/\D/g, "").slice(0, 3))}
                aria-describedby="pr-count-hint"
              />
            </label>
            <div className="pr-quick" aria-label="تعداد پیشنهادی">
              {[5, 10, 20, 30].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`pr-chip${countNumber === value ? " is-on" : ""}`}
                  onClick={() => setCount(String(value))}
                  disabled={available !== null && value > available}
                >
                  {toPersianDigits(value)}
                </button>
              ))}
            </div>
          </div>
          <p id="pr-count-hint" className="ds-hint" aria-live="polite">
            {available === null
              ? "در حال شمردن سؤال‌های در دسترس…"
              : available === 0
                ? source === "MISTAKES"
                  ? "در این انتخاب سؤال اشتباه‌زده‌ای نداری."
                  : "برای این انتخاب سؤالی در دسترس نیست."
                : `${toPersianDigits(available)} سؤال برای این انتخاب در دسترس است.`}
          </p>

          <label className="ds-checkbox-row pr-check">
            <input type="checkbox" checked={customTime} onChange={(event) => setCustomTime(event.target.checked)} />
            زمان را خودم تعیین می‌کنم
          </label>
          {customTime ? (
            <label className="ds-field pr-minutes">
              <span className="ds-label">زمان (دقیقه)</span>
              <input
                className="ds-input"
                inputMode="numeric"
                value={toPersianDigits(minutes)}
                placeholder={toPersianDigits(defaultMinutes || 15)}
                onChange={(event) => setMinutes(toEnglishDigits(event.target.value).replace(/\D/g, "").slice(0, 3))}
              />
            </label>
          ) : (
            <p className="ds-hint">
              زمان پیشنهادی: {toPersianDigits(defaultMinutes || 0)} دقیقه (یک و نیم دقیقه برای هر تست، نزدیک به زمان کنکور).
            </p>
          )}
        </fieldset>

        {subject && !subject.hasBankAccess && subject.total > subject.available && (
          <div className="pr-upsell">
            <p>
              الان فقط تست‌های نمونهٔ «{subject.title}» در آزمون‌ساز می‌آیند. با بانک سؤال این درس، هر{" "}
              {toPersianDigits(subject.total)} تست باز می‌شود.
            </p>
            {bankProduct && bankProduct.prices[0] ? (
              <div className="pr-upsell-buy">
                <span>{bankProduct.title} · {formatRial(bankProduct.prices[0].amountRial)}</span>
                <BuyButton productId={bankProduct.id} label="خرید بانک سؤال" />
              </div>
            ) : (
              <Link href="/courses">دوره‌هایی که بانک سؤال همراه دارند</Link>
            )}
          </div>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="pr-submit">
          <Button type="submit" variant="primary" loading={building} disabled={!subjectCode || available === 0}>
            ساختن و شروع آزمون
          </Button>
        </div>
      </form>

      <aside className="pr-mine" aria-labelledby="pr-mine-title">
        <h2 id="pr-mine-title">آزمون‌های تمرینی من</h2>
        {mine.length === 0 ? (
          <p className="ds-hint">هنوز آزمونی نساخته‌ای. آزمون‌هایی که می‌سازی اینجا می‌مانند تا دوباره بدهی.</p>
        ) : (
          <ul>
            {mine.slice(0, 12).map((exam) => {
              const attempt = exam.latestAttempt;
              return (
                <li key={exam.id}>
                  <div className="pr-mine-main">
                    <b>{exam.title}</b>
                    <small>{exam.description}</small>
                    <small>
                      {dateFormat.format(new Date(exam.createdAt))} · {toPersianDigits(exam.durationMinutes)} دقیقه
                      {exam.attemptCount > 1 ? ` · ${toPersianDigits(exam.attemptCount)} بار` : ""}
                    </small>
                  </div>
                  <div className="pr-mine-side">
                    {attempt?.score ? (
                      <Badge tone={attempt.score.percentCorrect >= 60 ? "success" : attempt.score.percentCorrect >= 30 ? "warning" : "danger"}>
                        {toPersianDigits(attempt.score.correctCount)} از {toPersianDigits(exam.questionCount ?? 0)} درست
                      </Badge>
                    ) : attempt?.status === "IN_PROGRESS" ? (
                      <Badge tone="info">در جریان</Badge>
                    ) : null}
                    <div className="pr-mine-actions">
                      {attempt?.status === "IN_PROGRESS" ? (
                        <Link className="ds-btn ds-btn-primary ds-btn-sm" href={`/attempts/${attempt.id}`}>ادامه</Link>
                      ) : (
                        <>
                          {attempt && (
                            <Link className="ds-btn ds-btn-ghost ds-btn-sm" href={`/attempts/${attempt.id}/report`}>کارنامه</Link>
                          )}
                          <Button size="sm" loading={retaking === exam.id} onClick={() => retake(exam.id)}>
                            دوباره
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
