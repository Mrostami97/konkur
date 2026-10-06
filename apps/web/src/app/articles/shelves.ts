import type { GlyphName } from "../../components/SubjectIcon";

/**
 * The shelves of the article library, by what a candidate came for. An
 * article sits on every shelf one of its tags (or, for the older articles,
 * its category) belongs to; its own colour and icon come from the most
 * specific one, in the order below.
 */
export interface Shelf {
  key: string;
  label: string;
  icon: GlyphName;
  tone: "teal" | "blue" | "violet" | "rose" | "amber";
  tags: string[];
}

export const SHELVES: Shelf[] = [
  {
    key: "lessons",
    label: "درس‌ها و درس‌نامه",
    icon: "book",
    tone: "teal",
    tags: ["درس‌نامه", "ریاضی", "زبان", "سیستم عامل", "نظریه زبان‌ها و ماشین‌ها", "تحلیل الگوریتم", "زبان منظم", "تست‌زنی"],
  },
  {
    key: "plan",
    label: "برنامه‌ریزی و شروع",
    icon: "calendar",
    tone: "blue",
    tags: ["برنامه‌ریزی", "شروع از صفر", "راهنمای جامع", "روش مطالعه", "منابع", "منابع رایگان", "تغییر رشته"],
  },
  {
    key: "exam",
    label: "کنکور ۱۴۰۶ و قوانین",
    icon: "flag",
    tone: "violet",
    tags: ["دکتری ۱۴۰۶", "مواد امتحانی", "رشته‌های مجاز", "ضرایب ۱۴۰۶", "کد ضریب", "ضرایب و بودجه‌بندی", "دروس و ضرایب", "تحلیل کنکور", "تحلیل آزمون", "خبر و تحلیل", "ثبت‌نام و اخبار رسمی"],
  },
  {
    key: "universities",
    label: "دانشگاه و انتخاب رشته",
    icon: "building",
    tone: "rose",
    tags: ["دانشگاه‌ها", "انتخاب رشته", "گرایش‌ها", "شبانه", "پردیس", "سهمیه"],
  },
  {
    key: "ranks",
    label: "کارنامه و رتبه",
    icon: "trophy",
    tone: "amber",
    tags: ["کارنامه و رتبه", "رتبهٔ قبولی", "تحلیل داده"],
  },
];

/** The shelves an article sits on, most specific first. */
export function shelvesOf(tags: string[], subjectCodes: string[] = []): string[] {
  const keys = SHELVES.filter((shelf) => tags.some((tag) => shelf.tags.includes(tag))).map((shelf) => shelf.key);
  if (subjectCodes.length > 0 && !keys.includes("lessons")) keys.unshift("lessons");
  return keys.length > 0 ? keys : ["plan"];
}
