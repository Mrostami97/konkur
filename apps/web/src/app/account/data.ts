/** Response shapes of the student endpoints the panel reads, written from the
 * API services rather than guessed, and small helpers over them. */

export interface Enrollment {
  id: string;
  enrolledAt: string;
  course: { id: string; slug: string; title: string; description: string };
}

export interface CourseProgress {
  course: { slug: string; title: string };
  completedLessons: number;
  viewedLessons: number;
  totalLessons: number;
  progressPercent: number;
  resumeLesson: { id: string; title: string } | null;
  lastViewedAt: string | null;
}

export interface LearningProgress {
  disclaimer: string;
  courses: CourseProgress[];
}

export interface Entitlement {
  id: string;
  grantedVia: string;
  startAt: string;
  endAt: string | null;
  revokedAt: string | null;
  product: { title: string };
}

export interface TodayTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  href: string | null;
  reason: string;
  actionType: "LESSON" | "RESOURCE" | "TOPIC" | "SUBJECT";
}

export interface TodayPlan {
  tasks: TodayTask[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    plannedMinutes: number;
    completedMinutes: number;
    progressPercent: number;
    message?: string;
  };
}

export interface MyAttempt {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  exam: { id: string; slug: string; title: string; durationMinutes: number };
  score: {
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    rawScore: number;
    percentCorrect: number;
  } | null;
  /** Rank among the exam's participants, by the konkur percentage (wrong
   * answers cost a third). rank is null below the minimum participants. */
  standing: {
    konkurPercent: number;
    rank: number | null;
    participants: number;
    percentile: number | null;
    isOfficial: boolean;
  } | null;
}

export interface Standing {
  participants: number;
  minimumForRank: number;
  isOfficial: boolean;
  konkurPercent: number;
  rank: number | null;
  percentile: number | null;
  taraz: number | null;
  average: number | null;
  best: number | null;
  distribution: { from: number; to: number; count: number }[];
}

export interface CourseRecommendation {
  course: { slug: string; title: string; description: string };
  price: { amountRial: number; productSlug: string };
  reasons: string[];
  basis: "WEAK_TOPICS" | "WEAK_SUBJECT" | "TARGET" | "POPULAR";
  students: number;
}

export interface LibraryResource {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  kind: string;
  hostingMode: string;
  subjectCodes: string[];
  publishedAt: string | null;
  acquiredAt: string | null;
  /** Set when the handout came with a course rather than on its own. */
  course?: { slug: string; title: string };
}

/** Handouts that are files kept by the site; they are read in the panel, never downloaded. */
export const READABLE_HOSTING = new Set(["USER_UPLOAD", "MIRRORED_WITH_PERMISSION"]);

export interface Library {
  /** The annual consultation plan opens everything. */
  allAccess?: boolean;
  courses: { id: string; slug: string; title: string }[];
  resources: LibraryResource[];
  questionBankSubjects: string[];
}

export const RESOURCE_KIND_LABEL: Record<string, string> = {
  PDF: "جزوه (PDF)",
  NOTE: "یادداشت",
  VIDEO: "ویدیو",
  EXTERNAL_LINK: "پیوند",
  QUESTION_BOOKLET: "دفترچهٔ سؤال",
  ANSWER_KEY: "کلید پاسخ",
};

export interface Mastery {
  id: string;
  subjectCode: string;
  topicCode: string;
  masteryScore: number;
  confidence: string;
  evidenceCount: number;
}

export interface StudySession {
  id: string;
  subjectCode: string;
  topicCode: string | null;
  minutes: number;
  loggedAt: string;
  source: "UNCLASSIFIED_LEGACY" | "MANUAL" | "TASK_ACTUAL";
}

export interface PlanHistoryItem {
  id: string;
  status: string;
  version: number;
  createdAt: string;
  goalSnapshot: {
    degree: string | null;
    field: string | null;
    weeklyHours: number | null;
    selfReportedLevel: string | null;
  };
  _count?: { tasks: number; revisions: number };
}

export interface StudyHistory {
  sessions: StudySession[];
  plans: PlanHistoryItem[];
  pagination: { sessions: { nextCursor: string | null }; plans: { nextCursor: string | null } };
}

export interface PlanRevision {
  id: string;
  reasonCode: string;
  summary: string;
  createdAt: string;
}

function tehranDay(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
}

const WEEKDAY = new Intl.DateTimeFormat("fa-IR", { weekday: "narrow", timeZone: "Asia/Tehran" });

/** Minutes per day for the last seven days in Tehran time, today last. */
export function lastSevenDays(sessions: StudySession[], now: Date = new Date()) {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const key = tehranDay(new Date(session.loggedAt));
    totals.set(key, (totals.get(key) ?? 0) + session.minutes);
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86_400_000);
    return {
      label: index === 6 ? "امروز" : WEEKDAY.format(date),
      minutes: totals.get(tehranDay(date)) ?? 0,
      today: index === 6,
    };
  });
}

export function faDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("fa-IR", options);
}

export function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours.toLocaleString("fa-IR")} ساعت و ${rest.toLocaleString("fa-IR")} دقیقه` : `${hours.toLocaleString("fa-IR")} ساعت`;
}

export const ATTEMPT_STATUS: Record<MyAttempt["status"], { label: string; tone: "info" | "success" | "neutral" }> = {
  IN_PROGRESS: { label: "در حال برگزاری", tone: "info" },
  SUBMITTED: { label: "تصحیح‌شده", tone: "success" },
  EXPIRED: { label: "پایان زمان", tone: "neutral" },
};
