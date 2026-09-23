"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { WeekBars } from "../charts";
import {
  faDate,
  lastSevenDays,
  minutesLabel,
  type PlanHistoryItem,
  type PlanRevision,
  type StudyHistory,
  type StudySession,
} from "../data";
import { degreeLabel, fieldLabel } from "../profile-options";

const SOURCE_LABEL: Record<StudySession["source"], string> = {
  MANUAL: "ثبت دستی",
  TASK_ACTUAL: "از برنامه",
  UNCLASSIFIED_LEGACY: "سابقهٔ قدیمی",
};

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "از پایه",
  INTERMEDIATE: "متوسط",
  ADVANCED: "پیشرفته",
};

type Section = "sessions" | "plans";

export default function StudyPage() {
  const [sessions, setSessions] = useState<StudySession[] | null>(null);
  const [plans, setPlans] = useState<PlanHistoryItem[]>([]);
  const [cursors, setCursors] = useState<Record<Section, string | null>>({ sessions: null, plans: null });
  const [revisions, setRevisions] = useState<PlanRevision[]>([]);
  const [busy, setBusy] = useState<Section | null>(null);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState<Section | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    Promise.all([
      apiFetch<StudyHistory>("/me/study-history?limit=30"),
      apiFetch<PlanRevision[]>("/me/plan/revisions").catch(() => []),
    ])
      .then(([history, planRevisions]) => {
        setSessions(history.sessions);
        setPlans(history.plans);
        setCursors({
          sessions: history.pagination.sessions.nextCursor,
          plans: history.pagination.plans.nextCursor,
        });
        setRevisions(planRevisions);
      })
      .catch(() => setFailed(true));
    // Sessions store taxonomy codes; titles are for display only, so a failed
    // lookup just leaves the codes showing.
    Promise.all([
      apiFetch<{ code: string; title: string }[]>("/subjects").catch(() => []),
      apiFetch<{ code: string; title: string }[]>("/topics").catch(() => []),
    ]).then(([subjects, topics]) => setNames(new Map([...subjects, ...topics].map((item) => [item.code, item.title]))));
  }, []);

  async function loadMore(section: Section) {
    const cursor = cursors[section];
    if (!cursor || busy) return;
    setBusy(section);
    setMoreFailed(null);
    const params = new URLSearchParams({ limit: "30", section });
    params.set(section === "sessions" ? "sessionsCursor" : "plansCursor", cursor);
    try {
      const page = await apiFetch<StudyHistory>(`/me/study-history?${params.toString()}`);
      if (section === "sessions") {
        setSessions((current) => [...(current ?? []), ...page.sessions.filter((item) => !current?.some((old) => old.id === item.id))]);
      } else {
        setPlans((current) => [...current, ...page.plans.filter((item) => !current.some((old) => old.id === item.id))]);
      }
      setCursors((current) => ({ ...current, [section]: page.pagination[section].nextCursor }));
    } catch {
      setMoreFailed(section);
    } finally {
      setBusy(null);
    }
  }

  const week = useMemo(() => lastSevenDays(sessions ?? []), [sessions]);
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0);
  const totalMinutes = (sessions ?? []).reduce((sum, session) => sum + session.minutes, 0);

  return (
    <AccountShell
      title="برنامه و سابقهٔ مطالعه"
      subtitle="هر جلسهٔ مطالعه‌ای که ثبت کرده‌ای و نسخه‌های برنامه‌ات. تسلط از آزمون‌ها می‌آید، نه از ساعت مطالعه."
      action={
        <Link href="/today" className="st-btn st-btn-primary">
          <Glyph name="calendar" />
          برنامهٔ امروز
        </Link>
      }
    >
      {failed ? (
        <p className="st-alert st-alert-danger">سابقهٔ مطالعه الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : sessions === null ? (
        <div className="st-skel st-skel-card-lg" aria-busy="true" />
      ) : (
        <>
          <div className="st-study-top">
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="pace" /></span>
                  هفت روز اخیر
                </h2>
                <span className="st-card-caption">{minutesLabel(weekMinutes)}</span>
              </header>
              <WeekBars days={week} />
            </section>
            <div className="st-mini-stats st-mini-stats-col">
              <div><span>جلسه‌های ثبت‌شده (فهرست زیر)</span><b>{toPersianDigits(sessions.length)}</b></div>
              <div><span>مجموع زمان همین جلسه‌ها</span><b className="st-kpi-value-sm">{minutesLabel(totalMinutes)}</b></div>
              <div><span>نسخه‌های برنامه</span><b>{toPersianDigits(plans.length)}</b></div>
            </div>
          </div>

          <section className="st-card">
            <header className="st-card-head">
              <h2>
                <span className="st-card-icon"><Glyph name="list" /></span>
                جلسه‌های مطالعه
              </h2>
            </header>
            {sessions.length === 0 ? (
              <p className="st-card-note">هنوز جلسه‌ای ثبت نشده. در «برنامهٔ امروز» بعد از هر جلسه، زمانش را ثبت کن.</p>
            ) : (
              <div className="st-table-wrap">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>درس</th>
                      <th>مبحث</th>
                      <th>زمان</th>
                      <th>منبع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{faDate(session.loggedAt, { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td>{names.get(session.subjectCode) ?? <span dir="ltr" className="st-code">{session.subjectCode}</span>}</td>
                        <td>
                          {session.topicCode
                            ? names.get(session.topicCode) ?? <span dir="ltr" className="st-code">{session.topicCode}</span>
                            : "—"}
                        </td>
                        <td>{minutesLabel(session.minutes)}</td>
                        <td><span className="st-badge st-badge-neutral">{SOURCE_LABEL[session.source]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cursors.sessions && (
              <button type="button" className="st-btn st-btn-ghost st-more" onClick={() => void loadMore("sessions")} disabled={busy !== null}>
                {busy === "sessions" ? "در حال بارگذاری…" : "جلسه‌های قدیمی‌تر"}
              </button>
            )}
            {moreFailed === "sessions" && <p className="st-field-error">بارگذاری انجام نشد؛ دوباره امتحان کن.</p>}
          </section>

          <div className="st-grid-2 st-grid-top">
            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="layers" /></span>
                  نسخه‌های برنامه
                </h2>
              </header>
              {plans.length === 0 ? (
                <p className="st-card-note">هنوز برنامه‌ای ساخته نشده. از «برنامهٔ امروز» اولین برنامه‌ات را بساز.</p>
              ) : (
                <ul className="st-timeline">
                  {plans.map((plan) => (
                    <li key={plan.id}>
                      <span className={`st-timeline-dot${plan.status === "ACTIVE" ? " st-timeline-dot-on" : ""}`} />
                      <div>
                        <strong>
                          نسخهٔ {toPersianDigits(plan.version)}
                          {plan.status === "ACTIVE" && <span className="st-badge st-badge-success">فعال</span>}
                        </strong>
                        <small>
                          {faDate(plan.createdAt)} · {degreeLabel(plan.goalSnapshot.degree)} {fieldLabel(plan.goalSnapshot.field)}
                          {plan.goalSnapshot.weeklyHours ? ` · ${toPersianDigits(plan.goalSnapshot.weeklyHours)} ساعت در هفته` : ""}
                          {plan.goalSnapshot.selfReportedLevel && LEVEL_LABEL[plan.goalSnapshot.selfReportedLevel]
                            ? ` · ${LEVEL_LABEL[plan.goalSnapshot.selfReportedLevel]}`
                            : ""}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {cursors.plans && (
                <button type="button" className="st-btn st-btn-ghost st-more" onClick={() => void loadMore("plans")} disabled={busy !== null}>
                  {busy === "plans" ? "در حال بارگذاری…" : "نسخه‌های قدیمی‌تر"}
                </button>
              )}
              {moreFailed === "plans" && <p className="st-field-error">بارگذاری انجام نشد؛ دوباره امتحان کن.</p>}
            </section>

            <section className="st-card">
              <header className="st-card-head">
                <h2>
                  <span className="st-card-icon"><Glyph name="flow" /></span>
                  تغییرات برنامهٔ فعلی
                </h2>
              </header>
              {revisions.length === 0 ? (
                <p className="st-card-note">تغییری ثبت نشده است.</p>
              ) : (
                <ul className="st-timeline">
                  {revisions.slice(0, 12).map((revision) => (
                    <li key={revision.id}>
                      <span className="st-timeline-dot" />
                      <div>
                        <strong>{revision.summary}</strong>
                        <small>{faDate(revision.createdAt, { dateStyle: "medium", timeStyle: "short" })}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AccountShell>
  );
}
