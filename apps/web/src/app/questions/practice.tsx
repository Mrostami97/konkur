import { apiFetch } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";

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

/** Why a wrong answer went wrong (practice.service.ts `PracticeErrorReason`). */
export const REASONS = [
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

/** The student's history on these questions (comma separated ids); null when signed out. */
export async function loadHistories(ids: string[]): Promise<Record<string, History> | null> {
  try {
    return await apiFetch<Record<string, History>>(`/questions/history?ids=${encodeURIComponent(ids.join(","))}`);
  } catch {
    return null;
  }
}
