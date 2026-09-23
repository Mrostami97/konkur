"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph } from "../../../components/SubjectIcon";
import { apiFetch } from "../../../lib/api";
import { daysBetween, dayLabel, isoDay, shortDay, type CoachItem, type CoachPlan } from "../../../lib/coach";
import { toPersianDigits } from "../../../lib/format";
import { AccountShell } from "../AccountShell";
import { ProgressRing } from "../charts";
import { CoachTask } from "../CoachTask";

export default function CoachPlanPage() {
  const [data, setData] = useState<{ today: string; plans: CoachPlan[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ today: string; plans: CoachPlan[] }>("/me/coach-plans")
      .then((response) => {
        setData(response);
        const current = response.plans.find((plan) => plan.isCurrent) ?? response.plans[0];
        setPlanId(current?.id ?? null);
      })
      .catch(() => setFailed(true));
  }, []);

  const plan = data?.plans.find((item) => item.id === planId) ?? null;
  const days = useMemo(() => (plan ? daysBetween(isoDay(plan.startsOn), isoDay(plan.endsOn)) : []), [plan]);
  const activeDay = day && days.includes(day) ? day : data && days.includes(data.today) ? data.today : days[0];

  function replaceItem(updated: CoachItem) {
    setData((current) =>
      current
        ? {
            ...current,
            plans: current.plans.map((item) => {
              if (item.id !== planId) return item;
              const items = item.items.map((task) => (task.id === updated.id ? updated : task));
              const done = items.filter((task) => task.completedAt).length;
              return { ...item, items, progress: { total: items.length, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 } };
            }),
          }
        : current,
    );
  }

  return (
    <AccountShell
      title="برنامهٔ مشاور"
      subtitle="برنامه‌ای که مشاورت برایت چیده؛ هر کار را که انجام دادی تیک بزن تا مشاور ببیند و برنامهٔ بعدی را تنظیم کند."
      action={
        <Link href="/today" className="st-btn st-btn-soft">
          <Glyph name="calendar" />
          برنامهٔ خودکار امروز
        </Link>
      }
    >
      {failed ? (
        <p className="st-alert st-alert-danger">برنامه الان بارگذاری نشد. صفحه را دوباره باز کن.</p>
      ) : !data ? (
        <div className="st-skel st-skel-card-lg" aria-busy="true" />
      ) : !plan ? (
        <div className="st-card">
          <div className="st-empty st-empty-lg">
            <span className="st-empty-icon"><Glyph name="chat" /></span>
            <strong>هنوز برنامه‌ای از مشاور نداری</strong>
            <p>
              وقتی مشاوره بگیری، مشاورت برنامهٔ هفتگی‌ات را همین‌جا می‌فرستد؛ تا آن موقع، برنامهٔ خودکار امروز بر پایهٔ
              آزمون‌ها و هدفت ساخته می‌شود.
            </p>
            <div className="st-row">
              <Link href="/consultations" className="st-btn st-btn-primary">مشاوره با مدرس</Link>
              <Link href="/today" className="st-btn st-btn-soft">برنامهٔ خودکار امروز</Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {data.plans.length > 1 && (
            <nav className="st-segments" aria-label="برنامه‌ها">
              {data.plans.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="st-segment"
                  aria-pressed={item.id === planId}
                  onClick={() => {
                    setPlanId(item.id);
                    setDay(null);
                  }}
                >
                  {item.title}
                  {item.isCurrent && <em>جاری</em>}
                </button>
              ))}
            </nav>
          )}

          <section className="st-plan-head">
            <div className="st-plan-coach">
              <span className="st-avatar">{plan.coach?.displayName.trim().slice(0, 1) ?? "م"}</span>
              <div>
                <small>از طرف {plan.coach?.displayName ?? "مشاورت"}</small>
                <h2>{plan.title}</h2>
                <p>
                  {dayLabel(isoDay(plan.startsOn), { day: "numeric", month: "long" })} تا{" "}
                  {dayLabel(isoDay(plan.endsOn), { day: "numeric", month: "long" })}
                </p>
              </div>
            </div>
            {plan.note && (
              <blockquote className="st-plan-note">
                <Glyph name="chat" />
                {plan.note}
              </blockquote>
            )}
            <div className="st-plan-ring">
              <ProgressRing percent={plan.progress.percent} size={96} stroke={9} label="انجام‌شده" />
              <small>{toPersianDigits(plan.progress.done)} از {toPersianDigits(plan.progress.total)} کار</small>
            </div>
          </section>

          <nav className="st-days" aria-label="روزهای برنامه">
            {days.map((item) => {
              const tasks = plan.items.filter((task) => isoDay(task.day) === item);
              const done = tasks.filter((task) => task.completedAt).length;
              return (
                <button
                  key={item}
                  type="button"
                  className={`st-day${item === data.today ? " st-day-today" : ""}`}
                  aria-pressed={item === activeDay}
                  onClick={() => setDay(item)}
                >
                  <span className="st-day-name">{item === data.today ? "امروز" : shortDay(item)}</span>
                  <span className="st-day-date">{dayLabel(item, { day: "numeric" })}</span>
                  <span className="st-day-bar" aria-hidden>
                    <span style={{ width: tasks.length ? `${(done / tasks.length) * 100}%` : "0%" }} />
                  </span>
                  <span className="st-day-count">{tasks.length ? `${toPersianDigits(done)}/${toPersianDigits(tasks.length)}` : "—"}</span>
                </button>
              );
            })}
          </nav>

          <section className="st-card">
            <header className="st-card-head">
              <h2>
                <span className="st-card-icon"><Glyph name="calendar" /></span>
                {activeDay ? dayLabel(activeDay) : ""}
              </h2>
            </header>
            {(() => {
              const tasks = plan.items.filter((task) => isoDay(task.day) === activeDay);
              return tasks.length === 0 ? (
                <p className="st-card-note">برای این روز کاری تعیین نشده؛ استراحت یا جبران عقب‌ماندگی.</p>
              ) : (
                <ul className="st-ctasks">
                  {tasks.map((task) => <CoachTask key={task.id} item={task} onChange={replaceItem} />)}
                </ul>
              );
            })()}
          </section>
        </>
      )}
    </AccountShell>
  );
}
