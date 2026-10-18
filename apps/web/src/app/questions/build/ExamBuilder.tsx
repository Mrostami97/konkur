"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { SYLLABUS } from "../../../lib/syllabus";
import { savePracticeSet } from "../practice-set";

interface SubjectOption { code: string; title: string }
interface Counts { subjects: Record<string, number>; topics: Record<string, number> }

const YEARS = Array.from({ length: 26 }, (_, index) => 1405 - index);
const TRACKS = [
  { value: "computer-engineering", label: "مهندسی کامپیوتر" },
  { value: "information-technology", label: "فناوری اطلاعات" },
  { value: "computer-science", label: "علوم کامپیوتر" },
];
const COLLECTIONS = [
  { value: "", label: "همهٔ تست‌ها" },
  { value: "unseen", label: "تست‌هایی که هنوز ندیده‌ام" },
  { value: "wrong", label: "تست‌هایی که غلط زده‌ام" },
  { value: "never_right", label: "تست‌هایی که هنوز درست نزده‌ام" },
  { value: "last_two_wrong", label: "دو بار آخر غلط" },
  { value: "sure_but_wrong", label: "مطمئن بودم ولی غلط شد" },
  { value: "starred", label: "ستاره‌دارها" },
];
const COUNTS = [5, 10, 20, 30];
/** Roughly the pace of the real exam. */
const MINUTES_PER_QUESTION = 1.5;

type Mode = "exam" | "feedback";

/**
 * The student's own practice: a subject, the syllabus topics they read, the
 * years and track, one of their collections, and how many questions. Run it
 * as a timed exam (scored with a report card like any exam) or one question
 * at a time with the answer right after each.
 */
export function ExamBuilder({ catalog, initialSubject }: { catalog: SubjectOption[]; initialSubject?: string }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [subjectCode, setSubjectCode] = useState(initialSubject ?? catalog[0]?.code ?? "");
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Counts | null>(null);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [examMajor, setExamMajor] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [collection, setCollection] = useState("");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<Mode>("exam");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/questions/history?ids=")
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);

  // Questions per subject: a subject with none is shown but not offered first.
  useEffect(() => {
    apiFetch<Counts>("/questions/counts")
      .then((data) => {
        setTotals(data.subjects);
        setSubjectCode((current) => (data.subjects[current] ? current : catalog.find((subject) => data.subjects[subject.code])?.code ?? current));
      })
      .catch(() => setTotals(null));
  }, [catalog]);

  useEffect(() => {
    setTopics(new Set());
    setCounts(null);
    if (!subjectCode) return;
    apiFetch<Counts>(`/questions/counts?subjectCode=${encodeURIComponent(subjectCode)}`).then(setCounts).catch(() => setCounts(null));
  }, [subjectCode]);

  const tree = useMemo(() => (SYLLABUS[subjectCode] ?? []).filter((chapter) => !chapter.offSyllabus), [subjectCode]);
  const topicCount = (code: string) => counts?.topics[code] ?? 0;
  const duration = minutes ?? Math.max(5, Math.round(count * MINUTES_PER_QUESTION));

  function toggle(codes: string[], on: boolean) {
    setTopics((current) => {
      const next = new Set(current);
      for (const code of codes) {
        if (on) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  async function build(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const from = yearFrom && yearTo && Number(yearFrom) > Number(yearTo) ? yearTo : yearFrom;
    const to = yearFrom && yearTo && Number(yearFrom) > Number(yearTo) ? yearFrom : yearTo;
    const selection = {
      subjectCode,
      ...(topics.size ? { topicCodes: [...topics] } : {}),
      ...(collection ? { collection } : {}),
      ...(examMajor ? { examMajor } : {}),
      ...(from ? { yearFrom: Number(from) } : {}),
      ...(to ? { yearTo: Number(to) } : {}),
      count,
    };
    try {
      if (mode === "feedback") {
        const set = await apiFetch<{ ids: string[]; available: number }>("/questions/practice-set", { method: "POST", body: selection });
        if (set.ids.length === 0) {
          setMessage("با این انتخاب تستی پیدا نشد. مبحث یا سال‌های بیشتری انتخاب کن.");
          return;
        }
        savePracticeSet(set.ids);
        router.push(`/questions/${set.ids[0]}`);
        return;
      }
      const title = catalog.find((subject) => subject.code === subjectCode)?.title ?? "آزمون";
      const exam = await apiFetch<{ examId: string }>("/questions/practice-exams", {
        method: "POST",
        body: { ...selection, title: `آزمون مبحثی ${title}`, durationMinutes: duration },
      });
      const attempt = await apiFetch<{ id: string }>(`/exams/${exam.examId}/start`, { method: "POST" });
      router.push(`/attempts/${attempt.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login?next=/questions/build");
      else if (err instanceof ApiError && err.code === "PROFILE_INCOMPLETE") router.push(`/account/profile?next=${encodeURIComponent("/questions/build")}`);
      else if (err instanceof ApiError && err.status === 400) setMessage("با این انتخاب تستی پیدا نشد. مبحث یا سال‌های بیشتری انتخاب کن.");
      else setMessage("ساختن آزمون ممکن نشد. چند لحظهٔ دیگر دوباره امتحان کن.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker"><Link href="/questions">بانک سؤال</Link></p>
          <h1>آزمون‌ساز مبحثی</h1>
          <p>
            مبحثی را که خوانده‌ای انتخاب کن تا از تست‌های کنکور همان مبحث آزمون بگیری: زمان‌دار با کارنامه، یا تست‌به‌تست با
            پاسخ بلافاصله بعد از هر تست.
          </p>
        </div>
      </header>

      <div className="qb-wrap xb">
        {signedIn === false ? (
          <section className="xb-card xb-signin">
            <h2>برای ساختن آزمون وارد حسابت شو</h2>
            <p>آزمون‌ها و سابقهٔ هر تست در حساب خودت می‌ماند تا بعداً تست‌های غلط و ندیده‌ات را دوباره بگیری.</p>
            <Link className="ds-btn ds-btn-primary" href="/login?next=/questions/build">ورود با شمارهٔ موبایل</Link>
          </section>
        ) : (
          <form className="xb-form" onSubmit={build}>
            <section className="xb-card">
              <h2>درس</h2>
              <div className="xb-chips" role="radiogroup" aria-label="درس">
                {catalog.map((subject) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={subjectCode === subject.code}
                    key={subject.code}
                    data-empty={totals !== null && !totals[subject.code] ? true : undefined}
                    onClick={() => setSubjectCode(subject.code)}
                  >
                    {subject.title}
                    {totals !== null && <small className="tnum">{toPersianDigits(totals[subject.code] ?? 0)}</small>}
                  </button>
                ))}
              </div>
            </section>

            <section className="xb-card">
              <div className="xb-head">
                <h2>مبحث‌ها</h2>
                <span>{topics.size ? `${toPersianDigits(topics.size)} مبحث انتخاب شده` : "هیچ‌کدام = همهٔ مبحث‌های درس"}</span>
              </div>
              {tree.map((chapter) => {
                const codes = chapter.topics.map((topic) => topic.code);
                const all = codes.length > 0 && codes.every((code) => topics.has(code));
                const total = codes.reduce((sum, code) => sum + topicCount(code), 0);
                return (
                  <fieldset className="xb-chapter" key={chapter.code}>
                    <legend>
                      <label>
                        <input type="checkbox" checked={all} onChange={(event) => toggle(codes, event.target.checked)} />
                        <span>{chapter.title}</span>
                        <small className="tnum">{toPersianDigits(total)} تست</small>
                      </label>
                    </legend>
                    <div className="xb-topics">
                      {chapter.topics.map((topic) => (
                        <label key={topic.code} data-empty={topicCount(topic.code) === 0 || undefined}>
                          <input type="checkbox" checked={topics.has(topic.code)} onChange={(event) => toggle([topic.code], event.target.checked)} />
                          <span>{topic.title}</span>
                          <small className="tnum">{toPersianDigits(topicCount(topic.code))}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </section>

            <section className="xb-card xb-grid">
              <label className="qb-field">
                <span>رشته</span>
                <select value={examMajor} onChange={(event) => setExamMajor(event.target.value)}>
                  <option value="">همهٔ رشته‌ها</option>
                  {TRACKS.map((track) => <option key={track.value} value={track.value}>{track.label}</option>)}
                </select>
              </label>
              <label className="qb-field">
                <span>از سال</span>
                <select value={yearFrom} onChange={(event) => setYearFrom(event.target.value)}>
                  <option value="">قدیمی‌ترین</option>
                  {YEARS.map((year) => <option key={year} value={year}>{toPersianDigits(year)}</option>)}
                </select>
              </label>
              <label className="qb-field">
                <span>تا سال</span>
                <select value={yearTo} onChange={(event) => setYearTo(event.target.value)}>
                  <option value="">جدیدترین</option>
                  {YEARS.map((year) => <option key={year} value={year}>{toPersianDigits(year)}</option>)}
                </select>
              </label>
              <label className="qb-field">
                <span>کدام تست‌ها</span>
                <select value={collection} onChange={(event) => setCollection(event.target.value)}>
                  {COLLECTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </section>

            <section className="xb-card">
              <h2>چند تست و چطور</h2>
              <div className="xb-chips" role="radiogroup" aria-label="تعداد تست">
                {COUNTS.map((value) => (
                  <button type="button" role="radio" aria-checked={count === value} key={value} onClick={() => setCount(value)}>
                    {toPersianDigits(value)} تست
                  </button>
                ))}
              </div>
              <div className="xb-modes" role="radiogroup" aria-label="شیوهٔ آزمون">
                <button type="button" role="radio" aria-checked={mode === "exam"} onClick={() => setMode("exam")}>
                  <strong>آزمون زمان‌دار</strong>
                  <span>مثل جلسهٔ کنکور: پاسخ‌ها آخر کار، با کارنامه و نمرهٔ منفی.</span>
                </button>
                <button type="button" role="radio" aria-checked={mode === "feedback"} onClick={() => setMode("feedback")}>
                  <strong>تست‌به‌تست با پاسخ</strong>
                  <span>بعد از هر تست کلید و راه‌حل را می‌بینی؛ برای وقتی که تازه مبحث را خوانده‌ای.</span>
                </button>
              </div>
              {mode === "exam" && (
                <label className="qb-field xb-minutes">
                  <span>زمان (دقیقه)</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={duration}
                    onChange={(event) => setMinutes(Math.min(300, Math.max(1, Number(event.target.value) || 1)))}
                  />
                </label>
              )}
            </section>

            {message && <p className="xb-message" role="alert">{message}</p>}
            <div className="xb-submit">
              <button type="submit" className="ds-btn ds-btn-primary" disabled={busy || !subjectCode || signedIn === null}>
                {busy ? "در حال ساختن…" : mode === "exam" ? "شروع آزمون" : "شروع تمرین"}
              </button>
              <p>تست‌ها از سؤال‌های همین درس که به آن‌ها دسترسی داری انتخاب می‌شوند؛ بدون بانک درس، فقط از نمونه‌های رایگان.</p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
