"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { Glyph } from "../../components/SubjectIcon";

/** Where the student was in the bank last time (this browser only). */
export const LAST_PLACE_KEY = "qb:last-place";

export interface TodayState {
  goal: number;
  answeredToday: number;
  streak: number;
  review: number;
  total: number;
}

/**
 * The top of the bank: for a signed-in student, today's goal as a ring, the
 * streak, «۱۰ تست امروز» and the way back to where they were; for a visitor,
 * the free samples and why signing in is worth it. Every number is real:
 * today's answers and the streak come from the student's own practice, the
 * week's additions and the samples from the bank.
 */
export function PracticeDesk({
  today,
  signedIn,
  samples,
  addedThisWeek,
  onToday,
  onSamples,
}: {
  today: TodayState | null;
  signedIn: boolean | null;
  samples: number | null;
  addedThisWeek: number | null;
  onToday: () => void;
  onSamples: () => void;
}) {
  const [lastPlace, setLastPlace] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_PLACE_KEY);
      if (saved && saved !== window.location.search) setLastPlace(saved);
    } catch {
      setLastPlace(null);
    }
  }, []);

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <section className="pd" aria-label="شروع تمرین">
        <div className="pd-main">
          <p className="pd-title">
            {samples ? <>{formatPersianNumber(samples)} تست رایگان با حل تشریحی، از همهٔ فصل‌ها</> : "تست‌های رایگان با حل تشریحی"}
          </p>
          <p className="pd-sub">وارد شو تا هر روز ۱۰ تست برایت چیده شود: غلط‌های قبلی‌ات برای مرور، و تست‌های تازه از درس‌هایی که می‌خوانی.</p>
        </div>
        <div className="pd-actions">
          <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" onClick={onSamples}>
            تست‌های رایگان
          </button>
          <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/login?next=/questions">ورود به حساب</Link>
        </div>
      </section>
    );
  }

  const done = today ? Math.min(today.answeredToday, today.goal) : 0;
  const goal = today?.goal ?? 10;
  const ratio = done / goal;
  return (
    <section className="pd" aria-label="تمرین امروز">
      <div className="pd-ring" role="img" aria-label={`امروز ${toPersianDigits(done)} از ${toPersianDigits(goal)} تست`}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="19" className="pd-ring-track" />
          <circle cx="22" cy="22" r="19" className="pd-ring-fill" style={{ strokeDasharray: `${ratio * 119.4} 119.4` }} />
        </svg>
        <span className="tnum">
          <b>{toPersianDigits(done)}</b>
          <small>از {toPersianDigits(goal)}</small>
        </span>
      </div>
      <div className="pd-main">
        <p className="pd-title">
          {today && today.answeredToday >= goal
            ? "هدف امروز کامل شد."
            : today && today.answeredToday > 0
              ? `امروز ${toPersianDigits(today.answeredToday)} تست زده‌ای؛ ${toPersianDigits(goal - done)} تست تا هدف امروز.`
              : "هدف امروز: ۱۰ تست."}
        </p>
        <p className="pd-sub">
          {today && today.streak > 1 ? <span className="pd-streak">{toPersianDigits(today.streak)} روز پشت سر هم تمرین کرده‌ای</span> : null}
          {today && today.review > 0 ? <span>{toPersianDigits(today.review)} تست غلط قبلی برای مرور</span> : null}
          {addedThisWeek ? <span>{formatPersianNumber(addedThisWeek)} تست این هفته به بانک اضافه شد</span> : null}
        </p>
      </div>
      <div className="pd-actions">
        {today && today.total > 0 && (
          <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" onClick={onToday}>
            <Glyph name="bolt" />
            {toPersianDigits(today.total)} تست امروز
          </button>
        )}
        {lastPlace && (
          <a className="ds-btn ds-btn-secondary ds-btn-sm" href={`/questions${lastPlace}`}>
            ادامه از جای قبلی
          </a>
        )}
      </div>
    </section>
  );
}
