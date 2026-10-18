"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";

export type Confidence = "SURE" | "TWO_WAY" | "GUESS";
export type Outcome = "CORRECT" | "WRONG" | "VOID";

export interface History {
  seen: number;
  outcomes: Outcome[];
  lastAt: string | null;
  starred: boolean;
  note: string | null;
}

export const CONFIDENCE: { value: Confidence; label: string }[] = [
  { value: "SURE", label: "مطمئنم" },
  { value: "TWO_WAY", label: "بین دوتا" },
  { value: "GUESS", label: "حدس" },
];

const REASONS = [
  { value: "DID_NOT_KNOW", label: "بلد نبودم" },
  { value: "CARELESS", label: "بی‌دقتی" },
  { value: "CALCULATION", label: "اشتباه محاسبه" },
  { value: "OUT_OF_TIME", label: "وقت کم آمد" },
  { value: "TRAP_OPTION", label: "در دام گزینه افتادم" },
] as const;

/** «۳ بار دیده‌ای؛ دو بار آخر غلط» -- what the history says about this question, in words. */
export function historySentence(history: History): string {
  if (history.seen === 0) return "اولین بار است که این تست را می‌بینی.";
  const graded = history.outcomes.filter((outcome) => outcome !== "VOID");
  const lastTwo = graded.slice(-2);
  const tail =
    graded.length === 0
      ? ""
      : lastTwo.length === 2 && lastTwo.every((outcome) => outcome === "WRONG")
        ? "؛ دو بار آخر غلط"
        : graded.every((outcome) => outcome === "WRONG")
          ? "؛ هنوز یک بار هم درست نزده‌ای"
          : graded[graded.length - 1] === "CORRECT"
            ? "؛ بار آخر درست"
            : "؛ بار آخر غلط";
  return `${toPersianDigits(history.seen)} بار دیده‌ای${tail}.`;
}

/** The line of past outcomes, oldest first: ✓ right, ✗ wrong, – deleted. */
export function HistoryMarks({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <span className="qp-marks" aria-hidden="true">
      {outcomes.map((outcome, index) => (
        <span key={index} data-outcome={outcome}>
          {outcome === "CORRECT" ? "✓" : outcome === "WRONG" ? "✗" : "–"}
        </span>
      ))}
    </span>
  );
}

/**
 * The student's own layer on a question: its history line, a star and a
 * note, and -- after a wrong answer -- why it went wrong. Signed-out visitors
 * see nothing here; their answers are not kept.
 */
export function PracticePanel({
  questionId,
  history,
  onHistory,
  wrongAnswerId,
}: {
  questionId: string;
  history: History | null;
  onHistory: (history: History) => void;
  /** The answer just given, when it was wrong: its reason can be recorded. */
  wrongAnswerId: string | null;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(history?.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReason(null);
  }, [wrongAnswerId]);
  useEffect(() => {
    setNote(history?.note ?? "");
  }, [history?.note]);

  if (!history) return null;

  async function mark(body: { starred?: boolean; note?: string | null }) {
    setSaving(true);
    try {
      const saved = await apiFetch<{ starred: boolean; note: string | null }>(`/questions/${questionId}/mark`, { method: "PUT", body });
      onHistory({ ...history!, ...saved });
      setNoteOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function pickReason(value: string) {
    if (!wrongAnswerId) return;
    const next = reason === value ? null : value;
    setReason(next);
    await apiFetch(`/questions/practice-answers/${wrongAnswerId}`, { method: "PATCH", body: { errorReason: next } }).catch(() => setReason(reason));
  }

  return (
    <section className="qp" aria-label="سابقهٔ تو روی این تست">
      <p className="qp-history">
        <HistoryMarks outcomes={history.outcomes} />
        <span>{historySentence(history)}</span>
      </p>

      {wrongAnswerId && (
        <div className="qp-reasons">
          <span>چرا غلط زدی؟</span>
          {REASONS.map((item) => (
            <button type="button" key={item.value} aria-pressed={reason === item.value} onClick={() => void pickReason(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="qp-tools">
        <button type="button" className="qp-star" aria-pressed={history.starred} disabled={saving} onClick={() => void mark({ starred: !history.starred })}>
          {history.starred ? "★ ستاره‌دار" : "☆ ستاره بزن"}
        </button>
        <button type="button" className="qp-note-toggle" onClick={() => setNoteOpen((open) => !open)}>
          {history.note ? "یادداشت من" : "یادداشت بگذار"}
        </button>
      </div>
      {history.note && !noteOpen && <p className="qp-note">{history.note}</p>}
      {noteOpen && (
        <form
          className="qp-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            void mark({ note: note.trim() || null });
          }}
        >
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} placeholder="نکته‌ای که نمی‌خواهی دوباره فراموش کنی" />
          <div>
            <button type="submit" className="ds-btn ds-btn-primary ds-btn-sm" disabled={saving}>ذخیره</button>
            <button type="button" className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setNoteOpen(false)}>انصراف</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** The student's history on one question, or null when signed out. */
export async function loadHistory(questionId: string): Promise<History | null> {
  try {
    const all = await apiFetch<Record<string, History>>(`/questions/history?ids=${encodeURIComponent(questionId)}`);
    return all[questionId] ?? null;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
    return null;
  }
}
