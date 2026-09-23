/**
 * Exam dates the countdowns count toward.
 *
 * Taken from the schedule the organisation for the national exams (سازمان
 * سنجش) announced, as recorded with its source in the Phase 12 guide corpus
 * (`registration-calendar-1406`): the master's exam on 16-17
 * Ordibehesht 1406 and the PhD exam on 16 Bahman 1405. Stored as Gregorian
 * dates at Tehran midnight so the countdown is computed, not typed.
 *
 * If Sanjesh moves a date, this file is the one place to change -- and the
 * countdown says where the date came from, so a stale one is visible.
 */
export const EXAM_DATES = {
  master1406: {
    label: "کنکور ارشد ۱۴۰۶",
    dateLabel: "۱۶ و ۱۷ اردیبهشت ۱۴۰۶",
    iso: "2027-05-06T00:00:00+03:30",
  },
  phd1406: {
    label: "کنکور دکتری ۱۴۰۶",
    dateLabel: "۱۶ بهمن ۱۴۰۵",
    iso: "2027-02-05T00:00:00+03:30",
  },
} as const;

export const EXAM_DATES_SOURCE = {
  label: "طبق برنامهٔ زمانی اعلام‌شدهٔ سازمان سنجش",
  href: "/guides/registration-calendar-1406",
};

/** Whole days from now until the exam; 0 on the day, and never negative. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const diff = new Date(iso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
