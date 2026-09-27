"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { ENERGY_LABEL, hoursLabel, weekLabel, type ReportWeek, type WeeklyReport } from "../../../lib/weekly";
import { CoachNote, ReportText, WeekFacts } from "../../../components/WeeklyReportParts";
import { AccountShell } from "../AccountShell";
import { faDate } from "../data";

interface Mine {
  currentWeekStart: string;
  weeks: ReportWeek[];
}

interface Draft {
  testsSolved: string;
  energy: number | null;
  wentWell: string;
  obstacles: string;
  questions: string;
}

function draftOf(report: WeeklyReport | null): Draft {
  return {
    testsSolved: report ? String(report.testsSolved) : "",
    energy: report?.energy ?? null,
    wentWell: report?.wentWell ?? "",
    obstacles: report?.obstacles ?? "",
    questions: report?.questions ?? "",
  };
}

/**
 * The weekly report of a consultation student: written before each weekly
 * session so the consultant comes in knowing how the week went. Study time,
 * exams and plan tasks are filled in by the site from what was logged.
 */
export default function WeeklyReportPage() {
  const [data, setData] = useState<Mine | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftOf(null));
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    apiFetch<Mine>("/me/weekly-reports")
      .then((mine) => {
        setData(mine);
        setDraft(draftOf(mine.weeks[0]?.report ?? null));
      })
      .catch(() => setFailed(true));
    apiFetch<{ code: string; title: string }[]>("/subjects")
      .then((subjects) => setNames(new Map(subjects.map((item) => [item.code, item.title]))))
      .catch(() => undefined);
  }, []);

  const current = data?.weeks[0] ?? null;
  const past = useMemo(() => (data?.weeks.slice(1) ?? []).filter((week) => week.report || week.summary.studyMinutes > 0), [data]);

  async function save(event: FormEvent | null, submit: boolean) {
    event?.preventDefault();
    setBusy(submit ? "submit" : "save");
    setError(null);
    setNotice(null);
    try {
      const report = await apiFetch<WeeklyReport>("/me/weekly-reports/current", {
        method: "PUT",
        body: {
          testsSolved: Number(draft.testsSolved || 0),
          energy: draft.energy ?? undefined,
          wentWell: draft.wentWell,
          obstacles: draft.obstacles,
          questions: draft.questions,
          submit,
        },
      });
      setData((currentData) =>
        currentData ? { ...currentData, weeks: [{ ...currentData.weeks[0], report }, ...currentData.weeks.slice(1)] } : currentData,
      );
      setNotice(submit ? "گزارش این هفته برای مشاورت فرستاده شد." : "پیش‌نویس ذخیره شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیرهٔ گزارش انجام نشد.");
    } finally {
      setBusy(null);
    }
  }

  const report = current?.report ?? null;

  return (
    <AccountShell
      title="گزارش هفتگی"
      subtitle="پیش از جلسهٔ هفتگی مشاوره بنویس که هفته‌ات چطور گذشت. ساعت مطالعه، آزمون‌ها و کارهای برنامه‌ات را سایت خودش از آنچه ثبت کرده‌ای می‌آورد."
      action={
        <Link href="/account/study" className="st-btn st-btn-soft">
          <Glyph name="pace" />
          ثبت مطالعه
        </Link>
      }
    >
      {failed ? (
        <p className="st-alert st-alert-danger">گزارش هفتگی الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : !data || !current ? (
        <div className="st-skel st-skel-card-lg" aria-busy="true" />
      ) : (
        <>
          <section className="st-card wr-week">
            <header className="st-card-head">
              <h2>
                <span className="st-card-icon"><Glyph name="calendar" /></span>
                این هفته · {weekLabel(current.weekStart)}
              </h2>
              {report?.reviewedAt ? (
                <span className="st-badge st-badge-success">مشاور دید و پاسخ داد</span>
              ) : report?.submittedAt ? (
                <span className="st-badge st-badge-info">فرستاده شد · {faDate(report.submittedAt)}</span>
              ) : (
                <span className="st-badge st-badge-neutral">هنوز فرستاده نشده</span>
              )}
            </header>
            <WeekFacts week={current} names={names} />
          </section>

          {report?.coachNote && <CoachNote report={report} />}

          <form className="st-card st-form-card wr-form" onSubmit={(event) => void save(event, true)}>
            <header className="st-card-head">
              <h2>
                <span className="st-card-icon"><Glyph name="list" /></span>
                گزارش تو
              </h2>
            </header>

            <div className="wr-row">
              <label className="st-field">
                <span className="st-label">تعداد تستی که این هفته زدی</span>
                <input
                  className="st-input"
                  inputMode="numeric"
                  value={toPersianDigits(draft.testsSolved)}
                  onChange={(event) => setDraft({ ...draft, testsSolved: event.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "").slice(0, 4) })}
                  placeholder="مثلاً ۱۲۰"
                />
                <span className="st-field-hint">همهٔ تست‌ها، چه در سایت چه در کتاب و جزوه.</span>
              </label>
              <fieldset className="st-field">
                <legend className="st-label">حال و انرژی این هفته</legend>
                <div className="wr-energy" role="radiogroup" aria-label="حال و انرژی این هفته">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      role="radio"
                      aria-checked={draft.energy === value}
                      className="wr-energy-option"
                      data-on={draft.energy === value || undefined}
                      onClick={() => setDraft({ ...draft, energy: value })}
                    >
                      <strong>{toPersianDigits(value)}</strong>
                      <small>{ENERGY_LABEL[value]}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <TextField label="چه چیزی خوب پیش رفت؟" hint="مبحثی که تمام شد، آزمونی که بهتر از قبل شد، عادتی که حفظ شد." value={draft.wentWell} onChange={(wentWell) => setDraft({ ...draft, wentWell })} />
            <TextField label="کجا گیر کردی یا عقب ماندی؟" hint="مبحث سخت، روزهایی که نشد بخوانی و دلیلش، کارهای برنامه که ماند." value={draft.obstacles} onChange={(obstacles) => setDraft({ ...draft, obstacles })} />
            <TextField label="سؤال‌هایت برای جلسهٔ این هفته" hint="هر چه می‌خواهی در جلسه با مشاورت درباره‌اش حرف بزنی." value={draft.questions} onChange={(questions) => setDraft({ ...draft, questions })} />

            {error && <p className="st-alert st-alert-danger">{error}</p>}
            {notice && <p className="st-alert st-alert-success">{notice}</p>}

            <div className="st-form-actions">
              <button type="button" className="st-btn st-btn-soft" disabled={busy !== null} onClick={() => void save(null, false)}>
                {busy === "save" ? "در حال ذخیره…" : "ذخیرهٔ پیش‌نویس"}
              </button>
              <button type="submit" className="st-btn st-btn-primary" disabled={busy !== null}>
                {busy === "submit" ? "در حال ارسال…" : report?.submittedAt ? "ارسال دوبارهٔ گزارش" : "ارسال برای مشاور"}
              </button>
            </div>
          </form>

          {past.length > 0 && (
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="book" /></span>
                  هفته‌های قبل
                </h2>
              </header>
              <ul className="wr-history">
                {past.map((week) => (
                  <li key={week.weekStart}>
                    <details>
                      <summary>
                        <strong>{weekLabel(week.weekStart)}</strong>
                        <span>{hoursLabel(week.summary.studyMinutes)}</span>
                        {week.report?.testsSolved ? <span>{toPersianDigits(week.report.testsSolved)} تست</span> : null}
                        {week.report?.reviewedAt ? (
                          <span className="st-badge st-badge-success">پاسخ مشاور</span>
                        ) : week.report?.submittedAt ? (
                          <span className="st-badge st-badge-info">فرستاده شد</span>
                        ) : (
                          <span className="st-badge st-badge-neutral">بدون گزارش</span>
                        )}
                      </summary>
                      <div className="wr-history-body">
                        <WeekFacts week={week} names={names} />
                        {week.report && <ReportText report={week.report} />}
                        {week.report?.coachNote && <CoachNote report={week.report} />}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AccountShell>
  );
}

function TextField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="st-field">
      <span className="st-label">{label}</span>
      <textarea className="st-input wr-textarea" value={value} maxLength={3000} onChange={(event) => onChange(event.target.value)} />
      <span className="st-field-hint">{hint}</span>
    </label>
  );
}
