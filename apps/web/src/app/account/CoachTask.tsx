"use client";

import Link from "next/link";
import { useState } from "react";
import { Glyph } from "../../components/SubjectIcon";
import { apiFetch } from "../../lib/api";
import { COACH_KINDS, type CoachItem } from "../../lib/coach";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";

/**
 * One task from the consultant's plan. Ticking it asks, optionally, how long
 * it really took and for a note to the consultant -- the two things a
 * consultant needs to adjust next week's plan.
 */
export function CoachTask({ item, onChange }: { item: CoachItem; onChange: (item: CoachItem) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(item.targetMinutes ? String(item.targetMinutes) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const kind = COACH_KINDS[item.kind];
  const done = Boolean(item.completedAt);

  async function complete() {
    setBusy(true);
    setFailed(false);
    const parsed = Number(toEnglishDigits(minutes.trim()));
    try {
      const updated = await apiFetch<CoachItem>(`/me/coach-plans/items/${item.id}/complete`, {
        method: "POST",
        body: {
          ...(minutes.trim() && Number.isInteger(parsed) && parsed >= 0 && parsed <= 1440 ? { actualMinutes: parsed } : {}),
          ...(note.trim() ? { studentNote: note.trim() } : {}),
        },
      });
      onChange(updated);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setFailed(false);
    try {
      onChange(await apiFetch<CoachItem>(`/me/coach-plans/items/${item.id}/reopen`, { method: "POST" }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const targets = [
    item.targetMinutes ? `${toPersianDigits(item.targetMinutes)} دقیقه` : null,
    item.targetCount ? `${toPersianDigits(item.targetCount)} ${item.kind === "TEST" ? "تست" : "مورد"}` : null,
  ].filter(Boolean);

  return (
    <li className={`st-ctask st-ctask-${kind.tone}${done ? " st-ctask-done" : ""}`}>
      <button
        type="button"
        className="st-ctask-check"
        aria-label={done ? "برگرداندن به انجام‌نشده" : "علامت انجام شد"}
        aria-pressed={done}
        disabled={busy}
        onClick={() => (done ? void reopen() : setOpen((value) => !value))}
      >
        {done && <svg viewBox="0 0 24 24" aria-hidden><path d="M20 6 9.5 16.5 4 11" /></svg>}
      </button>
      <div className="st-ctask-body">
        <div className="st-ctask-top">
          <span className="st-ctask-kind"><Glyph name={kind.icon} />{kind.label}</span>
          {targets.length > 0 && <span className="st-ctask-target">{targets.join(" · ")}</span>}
        </div>
        {item.href ? (
          <Link href={item.href} className="st-ctask-title">{item.title} ←</Link>
        ) : (
          <strong className="st-ctask-title">{item.title}</strong>
        )}
        {item.note && <p className="st-ctask-note">{item.note}</p>}
        {done && (
          <p className="st-ctask-report">
            انجام شد{item.actualMinutes !== null ? ` در ${toPersianDigits(item.actualMinutes)} دقیقه` : ""}
            {item.studentNote ? ` · «${item.studentNote}»` : ""}
          </p>
        )}
        {open && !done && (
          <div className="st-ctask-form">
            <label>
              <span>چند دقیقه طول کشید؟</span>
              <input className="st-input" inputMode="numeric" dir="ltr" value={minutes} onChange={(e) => setMinutes(e.target.value)} maxLength={4} />
            </label>
            <label>
              <span>یادداشت برای مشاور (اختیاری)</span>
              <input className="st-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثلاً: تست‌های سخت را علامت زدم" />
            </label>
            <div className="st-row">
              <button type="button" className="st-btn st-btn-primary st-btn-sm" onClick={() => void complete()} disabled={busy}>
                {busy ? "در حال ثبت…" : "ثبت انجام"}
              </button>
              <button type="button" className="st-btn st-btn-ghost st-btn-sm" onClick={() => setOpen(false)} disabled={busy}>
                انصراف
              </button>
            </div>
          </div>
        )}
        {failed && <p className="st-field-error">ثبت نشد؛ دوباره امتحان کن.</p>}
      </div>
    </li>
  );
}
