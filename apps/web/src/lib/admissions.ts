// Labels and helpers for field-selection data imported from Sanjesh's
// booklet (see apps/api admissions import). Kept free of React so the
// catalog, the choice list and the program pages read the same words.

export type StudyPeriod =
  | "DAILY"
  | "EVENING"
  | "SELF_FUNDED_CAMPUS"
  | "VIRTUAL"
  | "NON_PROFIT"
  | "VIRTUAL_NON_PROFIT"
  | "PAYAM_NOOR"
  | "VIRTUAL_PAYAM_NOOR";

export type ProgramGender = "ANY" | "FEMALE" | "MALE";

/** The booklet's «دورهٔ تحصیلی», in its order. */
export const PERIODS: { id: StudyPeriod; label: string }[] = [
  { id: "DAILY", label: "روزانه" },
  { id: "EVENING", label: "نوبت دوم" },
  { id: "SELF_FUNDED_CAMPUS", label: "پردیس خودگردان" },
  { id: "VIRTUAL", label: "مجازی" },
  { id: "NON_PROFIT", label: "غیرانتفاعی" },
  { id: "VIRTUAL_NON_PROFIT", label: "مجازی غیرانتفاعی" },
  { id: "PAYAM_NOOR", label: "پیام نور" },
  { id: "VIRTUAL_PAYAM_NOOR", label: "مجازی پیام نور" },
];

export function periodLabel(period?: string | null) {
  return PERIODS.find((item) => item.id === period)?.label ?? "";
}

/** The exam sets (مجموعهٔ امتحانی) the site has booklets for, and their coefficient codes. */
export const EXAM_SETS: { code: string; title: string; groups: Record<number, string> }[] = [
  { code: "1277", title: "مهندسی کامپیوتر", groups: { 1: "شبکه و رایانش امن", 2: "هوش مصنوعی", 3: "معماری سیستم‌های کامپیوتری", 4: "نرم‌افزار و علم داده" } },
  { code: "1276", title: "فناوری اطلاعات (IT)", groups: { 1: "فناوری اطلاعات", 2: "مهندسی اطلاعات پزشکی" } },
  { code: "1209", title: "علوم کامپیوتر", groups: { 1: "نظریه، محاسبات و هوش مصنوعی", 2: "داده‌کاوی، علم داده و بیوانفورماتیک" } },
];

export function examSetTitle(code?: string | null) {
  return EXAM_SETS.find((set) => set.code === code)?.title ?? "";
}

export function groupLabel(examSetCode: string | null | undefined, group: number | null | undefined) {
  if (!group) return "";
  const name = EXAM_SETS.find((set) => set.code === examSetCode)?.groups[group];
  return name ? `کد ضریب ${group}: ${name}` : `کد ضریب ${group}`;
}

export const GENDER_LABEL: Record<ProgramGender, string> = { ANY: "", FEMALE: "فقط زن", MALE: "فقط مرد" };

/** The booklet's «توضیحات», one item per «-»-separated note. */
export function noteItems(notes?: string | null) {
  return (notes ?? "").split(" - ").map((note) => note.trim()).filter(Boolean);
}

/** Notes a candidate must not miss: shown highlighted. */
export function isKeyNote(note: string) {
  return /^(فقط زن|فقط مرد|مصاحبه دارد|شرایط در پیوست|بورس |ویژه )/.test(note);
}

/** Sanjesh's master's field-selection form takes at most this many codes. */
export const MAX_CHOICES = 100;
