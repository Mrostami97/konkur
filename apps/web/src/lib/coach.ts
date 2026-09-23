import type { GlyphName } from "../components/SubjectIcon";

/** Shared by the student panel and the instructor's plan builder, so a task
 * reads the same on both sides. */

export type CoachTaskKind = "STUDY" | "TEST" | "REVIEW" | "VIDEO" | "EXAM" | "OTHER";

export const COACH_KINDS: Record<CoachTaskKind, { label: string; icon: GlyphName; tone: string }> = {
  STUDY: { label: "مطالعه", icon: "book", tone: "blue" },
  TEST: { label: "تست‌زنی", icon: "target", tone: "violet" },
  REVIEW: { label: "مرور", icon: "flow", tone: "teal" },
  VIDEO: { label: "ویدیو", icon: "play", tone: "rose" },
  EXAM: { label: "آزمون", icon: "trophy", tone: "amber" },
  OTHER: { label: "سایر", icon: "spark", tone: "neutral" },
};

export interface CoachItem {
  id: string;
  day: string;
  kind: CoachTaskKind;
  title: string;
  subjectSlug: string | null;
  targetMinutes: number | null;
  targetCount: number | null;
  href: string | null;
  note: string | null;
  order: number;
  completedAt: string | null;
  actualMinutes: number | null;
  studentNote: string | null;
}

export interface CoachPlan {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  note: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  updatedAt: string;
  items: CoachItem[];
  progress: { total: number; done: number; percent: number };
  isCurrent?: boolean;
  coach?: { displayName: string; slug: string; avatarUrl: string | null };
}

/** The API sends DATE columns as midnight-UTC ISO strings; plans work in
 * plain YYYY-MM-DD days. */
export function isoDay(value: string) {
  return value.slice(0, 10);
}

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 32; day = addDays(day, 1)) days.push(day);
  return days;
}

export function tehranToday(now: Date = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}

/** The Saturday that starts the Iranian week containing `day`. */
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay(); // Sunday = 0 … Saturday = 6
  return addDays(day, -((weekday + 1) % 7));
}

export function dayLabel(day: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  return new Date(`${day}T12:00:00.000Z`).toLocaleDateString("fa-IR", { ...options, timeZone: "UTC" });
}

export function shortDay(day: string) {
  return dayLabel(day, { weekday: "short" });
}
