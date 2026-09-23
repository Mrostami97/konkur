/** Choices and labels for the student profile, shared by the onboarding
 * wizard and the profile page so both always offer the same answers. */

export type EducationStatus =
  | "BACHELOR_STUDENT"
  | "BACHELOR_GRADUATE"
  | "MASTER_STUDENT"
  | "MASTER_GRADUATE"
  | "OTHER";

export const EDUCATION_OPTIONS: { value: EducationStatus; label: string; hint: string }[] = [
  { value: "BACHELOR_STUDENT", label: "دانشجوی کارشناسی", hint: "هنوز در حال تحصیل" },
  { value: "BACHELOR_GRADUATE", label: "فارغ‌التحصیل کارشناسی", hint: "مدرک کارشناسی دارم" },
  { value: "MASTER_STUDENT", label: "دانشجوی ارشد", hint: "برای دکتری آماده می‌شوم" },
  { value: "MASTER_GRADUATE", label: "فارغ‌التحصیل ارشد", hint: "مدرک ارشد دارم" },
  { value: "OTHER", label: "سایر", hint: "وضعیت دیگری دارم" },
];

export const TARGET_DEGREES = [
  { value: "MASTER", label: "کنکور ارشد", hint: "کارشناسی ارشد" },
  { value: "PHD", label: "کنکور دکتری", hint: "آزمون کتبی دکتری" },
] as const;

/** The same field codes the study planner and the guides use. */
export const TARGET_FIELDS = [
  { value: "computer-engineering", label: "مهندسی کامپیوتر", code: "مجموعهٔ ۱۲۷۷" },
  { value: "information-technology", label: "فناوری اطلاعات (IT)", code: "مجموعهٔ ۱۲۷۶" },
  { value: "computer-science", label: "علوم کامپیوتر", code: "مجموعهٔ ۱۲۰۹" },
] as const;

export const LEVELS = [
  { value: "BEGINNER", label: "از پایه شروع می‌کنم", hint: "بیشتر درس‌ها برایم تازه است" },
  { value: "INTERMEDIATE", label: "متوسط", hint: "پایه دارم، تمرین کم دارم" },
  { value: "ADVANCED", label: "پیشرفته", hint: "دنبال تست و جمع‌بندی‌ام" },
] as const;

/** Suggestions only: any university can be typed. */
export const UNIVERSITY_SUGGESTIONS = [
  "دانشگاه صنعتی شریف",
  "دانشگاه تهران",
  "دانشگاه صنعتی امیرکبیر",
  "دانشگاه علم و صنعت ایران",
  "دانشگاه صنعتی اصفهان",
  "دانشگاه شهید بهشتی",
  "دانشگاه صنعتی خواجه نصیرالدین طوسی",
  "دانشگاه فردوسی مشهد",
  "دانشگاه شیراز",
  "دانشگاه تبریز",
  "دانشگاه اصفهان",
  "دانشگاه صنعتی شاهرود",
  "دانشگاه آزاد اسلامی",
  "دانشگاه پیام نور",
  "دانشگاه جامع علمی-کاربردی",
];

export const FIELD_SUGGESTIONS = [
  "مهندسی کامپیوتر",
  "علوم کامپیوتر",
  "فناوری اطلاعات",
  "مهندسی برق",
  "ریاضیات و کاربردها",
  "آمار",
  "مهندسی صنایع",
  "فیزیک",
];

/** Solar years a student could have entered university in, newest first. */
export const ENTRY_YEARS = Array.from({ length: 22 }, (_, index) => 1405 - index);
/** Includes a few years ahead, for students giving an expected date. */
export const GRADUATION_YEARS = Array.from({ length: 26 }, (_, index) => 1409 - index);
export const TARGET_EXAM_YEARS = [1406, 1407, 1408];

export function educationLabel(value?: string | null) {
  return EDUCATION_OPTIONS.find((option) => option.value === value)?.label ?? "ثبت نشده";
}

export function degreeLabel(value?: string | null) {
  return value === "PHD" ? "دکتری" : value === "MASTER" ? "ارشد" : "ثبت نشده";
}

export function fieldLabel(value?: string | null) {
  return TARGET_FIELDS.find((option) => option.value === value)?.label ?? value ?? "ثبت نشده";
}

export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  firstName: "نام",
  lastName: "نام خانوادگی",
  educationStatus: "وضعیت تحصیلی",
  universityName: "دانشگاه",
  fieldOfStudy: "رشتهٔ تحصیلی",
  targetDegree: "مقطع هدف",
  targetField: "رشتهٔ هدف",
};
