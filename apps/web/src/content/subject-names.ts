/**
 * The site's subjects by code and Persian name, for browser-side pages that
 * need to show a name instead of a code. The full `subjects` list lives in
 * editorial.ts, which is too large to ship to the browser; this copy is
 * checked against it by test/subject-names.mjs, so it cannot drift.
 */
export const SUBJECT_NAMES: readonly { code: string; title: string }[] = [
  { code: "english", title: "زبان عمومی و تخصصی انگلیسی" },
  { code: "discrete-math", title: "ریاضیات گسسته" },
  { code: "statistics", title: "آمار و احتمال مهندسی" },
  { code: "linear-algebra", title: "جبر خطی" },
  { code: "programming-fundamentals", title: "مبانی کامپیوتر و برنامه‌سازی" },
  { code: "digital-logic", title: "مدارهای منطقی" },
  { code: "computer-architecture", title: "معماری کامپیوتر" },
  { code: "data-structures-algorithms", title: "داده‌ساختارها و الگوریتم‌ها" },
  { code: "data-structures", title: "ساختمان داده‌ها" },
  { code: "algorithms", title: "طراحی الگوریتم‌ها" },
  { code: "automata", title: "نظریه زبان‌ها و ماشین‌ها" },
  { code: "operating-systems", title: "سیستم‌های عامل" },
  { code: "artificial-intelligence", title: "هوش مصنوعی" },
  { code: "computer-networks", title: "شبکه‌های کامپیوتری" },
  { code: "databases", title: "طراحی پایگاه داده‌ها" },
  { code: "software-engineering", title: "مهندسی نرم‌افزار" },
  { code: "it-management", title: "اصول و خدمات فناوری اطلاعات" },
];

const names = new Map(SUBJECT_NAMES.map((subject) => [subject.code, subject.title]));

/** The Persian name for a subject code, or the code itself when unknown. */
export function subjectName(code: string): string {
  return names.get(code) ?? code;
}
