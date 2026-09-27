import { toPersianDigits } from "./format";

/** One week of a consultation student, as the API returns it. */
export interface WeeklyReport {
  id: string;
  weekStart: string;
  testsSolved: number;
  energy: number | null;
  wentWell: string | null;
  obstacles: string | null;
  questions: string | null;
  submittedAt: string | null;
  coachNote: string | null;
  reviewedAt: string | null;
  reviewedBy: { displayName: string } | null;
}

export interface WeekSummary {
  studyMinutes: number;
  studyBySubject: { subjectCode: string; minutes: number }[];
  exams: { title: string; submittedAt: string | null; percentCorrect: number | null }[];
  planTasks: number;
  planTasksDone: number;
}

export interface ReportWeek {
  weekStart: string;
  report: WeeklyReport | null;
  summary: WeekSummary;
}

export const ENERGY_LABEL: Record<number, string> = {
  1: "خیلی کم",
  2: "کم",
  3: "معمولی",
  4: "خوب",
  5: "عالی",
};

const dayMonth = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", timeZone: "UTC" });

/** «۵ مهر تا ۱۱ مهر» for the week that starts on `weekStart` (a Saturday). */
export function weekLabel(weekStart: string) {
  const start = new Date(weekStart);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return `${dayMonth.format(start)} تا ${dayMonth.format(end)}`;
}

/** «۳ ساعت و ۲۰ دقیقه» from minutes. */
export function hoursLabel(minutes: number) {
  if (minutes <= 0) return "ثبت نشده";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${toPersianDigits(rest)} دقیقه`;
  return rest === 0 ? `${toPersianDigits(hours)} ساعت` : `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`;
}
