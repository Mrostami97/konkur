import type { CoachPlan } from "../../../lib/coach";

/** Shapes of the consultant endpoints under /me/instructor/students. */

export interface CoachStudent {
  id: string;
  phone: string;
  profile: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    educationStatus: string | null;
    universityName: string | null;
    fieldOfStudy: string | null;
    targetDegree: "MASTER" | "PHD" | null;
    targetField: string | null;
    targetExamYear: number | null;
  } | null;
}

export interface CoachStudentSummary {
  student: CoachStudent;
  sessions: number;
  nextSessionAt: string | null;
  latestPlan: {
    id: string;
    title: string;
    status: CoachPlan["status"];
    startsOn: string;
    endsOn: string;
    total: number;
    done: number;
    percent: number;
  } | null;
}

export interface CoachStudentDetail {
  student: CoachStudent;
  attempts: {
    id: string;
    submittedAt: string | null;
    exam: { title: string };
    score: { percentCorrect: number; correctCount: number; wrongCount: number; unansweredCount: number } | null;
  }[];
  plans: CoachPlan[];
}

const EDUCATION: Record<string, string> = {
  BACHELOR_STUDENT: "دانشجوی کارشناسی",
  BACHELOR_GRADUATE: "فارغ‌التحصیل کارشناسی",
  MASTER_STUDENT: "دانشجوی ارشد",
  MASTER_GRADUATE: "فارغ‌التحصیل ارشد",
  OTHER: "سایر",
};

const FIELD: Record<string, string> = {
  "computer-engineering": "مهندسی کامپیوتر",
  "information-technology": "فناوری اطلاعات",
  "computer-science": "علوم کامپیوتر",
};

export function studentDisplayName(student: CoachStudent) {
  const profile = student.profile;
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.displayName || "بدون نام";
}

export function studentBackground(student: CoachStudent) {
  const profile = student.profile;
  if (!profile) return "پروفایل تکمیل نشده";
  const education = [profile.educationStatus ? EDUCATION[profile.educationStatus] : null, profile.fieldOfStudy, profile.universityName]
    .filter(Boolean)
    .join("، ");
  const target = profile.targetDegree
    ? `هدف: ${profile.targetDegree === "PHD" ? "دکتری" : "ارشد"} ${profile.targetField ? FIELD[profile.targetField] ?? profile.targetField : ""}${
        profile.targetExamYear ? ` ${profile.targetExamYear.toLocaleString("fa-IR", { useGrouping: false })}` : ""
      }`
    : null;
  return [education, target].filter(Boolean).join(" · ") || "پروفایل تکمیل نشده";
}
