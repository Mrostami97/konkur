"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { ProgressBar } from "../../components/ui";
import {
  Alert,
  Badge,
  Button,
  Card,
  DsEmptyState,
  Field,
  FieldRow,
  Input,
  Kpi,
  KpiGrid,
  Select,
  SkeletonRows,
} from "../../components/ds";
import { PanelIcon } from "../../components/PanelIcons";
import { AccountShell } from "./AccountShell";

interface Me {
  user: { id: string; phone: string; roles: string[] };
}

interface Profile {
  displayName: string | null;
  targetDegree: string | null;
  targetField: string | null;
}

interface Enrollment {
  id: string;
  course: { slug: string; title: string };
}

interface Entitlement {
  id: string;
  product: { title: string };
  grantedVia: string;
  startAt: string;
}

interface Mastery {
  topicCode: string;
  subjectCode: string;
  masteryScore: number;
  confidence: string;
  evidenceCount?: number;
  basis?: string;
}

interface LearningProgressCourse {
  course?: { slug?: string; title?: string };
  courseSlug?: string;
  courseTitle?: string;
  slug?: string;
  title?: string;
  completedLessons?: number;
  completedCount?: number;
  viewedLessons?: number;
  totalLessons?: number;
  lessonCount?: number;
  progressPercent?: number;
  percent?: number;
  resumeLesson?: { id: string; title?: string } | null;
  nextLesson?: { id: string; title?: string } | null;
}

interface StudySession {
  id: string;
  subjectCode: string;
  topicCode?: string | null;
  minutes: number;
  loggedAt: string;
  source?: "UNCLASSIFIED_LEGACY" | "MANUAL" | "TASK_ACTUAL";
}

interface PlanHistoryItem {
  id: string;
  status: string;
  version?: number;
  createdAt: string;
  goalDegree?: string | null;
  goalField?: string | null;
  goalWeeklyHours?: number | null;
  goalSelfReportedLevel?: string | null;
  goalSnapshot?: {
    degree?: string;
    field?: string;
    weeklyHours?: number;
    selfReportedLevel?: string;
  } | null;
}

interface PlanRevision {
  id: string;
  reasonCode: string;
  summary: string;
  createdAt: string;
}

interface HistoryCollection<T> {
  items: T[];
  nextCursor: string | null;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function cursorFrom(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function historyCollection<T>(value: unknown, kind: "sessions" | "plans"): HistoryCollection<T> {
  const response = recordFrom(value);
  if (!response) return { items: [], nextCursor: null };

  const legacyKey = kind === "sessions" ? "studySessions" : "planHistory";
  const collectionValue = response[kind] ?? response[legacyKey];
  const collection = recordFrom(collectionValue);
  const items = Array.isArray(collectionValue)
    ? collectionValue as T[]
    : Array.isArray(collection?.items)
      ? collection.items as T[]
      : Array.isArray(response.items)
        ? response.items as T[]
        : [];

  const pagination = recordFrom(response.pagination);
  const pagedCollection = recordFrom(pagination?.[kind]);
  const singular = kind === "sessions" ? "session" : "plan";
  const nextCursor = cursorFrom(
    pagedCollection?.nextCursor
      ?? collection?.nextCursor
      ?? response[`${kind}NextCursor`]
      ?? response[`${singular}NextCursor`]
      ?? response[`next${singular[0].toUpperCase()}${singular.slice(1)}Cursor`]
      ?? response.nextCursor,
  );

  return { items, nextCursor };
}

function appendUniqueById<T extends { id: string }>(current: T[], incoming: T[]) {
  const ids = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !ids.has(item.id))];
}

function arrayFrom(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return [];
}

function courseSlug(item: LearningProgressCourse) {
  return item.course?.slug ?? item.courseSlug ?? item.slug ?? "";
}

function courseTitle(item: LearningProgressCourse) {
  return item.course?.title ?? item.courseTitle ?? item.title ?? courseSlug(item);
}

function completedLessons(item: LearningProgressCourse) {
  return Math.max(0, item.completedLessons ?? item.completedCount ?? 0);
}

function totalLessons(item: LearningProgressCourse) {
  return Math.max(0, item.totalLessons ?? item.lessonCount ?? 0);
}

function progressPercent(item: LearningProgressCourse) {
  const explicit = item.progressPercent ?? item.percent;
  if (Number.isFinite(explicit)) return Math.min(100, Math.max(0, Number(explicit)));
  const total = totalLessons(item);
  return total > 0 ? Math.round((completedLessons(item) / total) * 100) : 0;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? toPersianDigits(value) : date.toLocaleDateString("fa-IR");
}

function levelLabel(value?: string | null) {
  return ({ BEGINNER: "شروع از پایه", INTERMEDIATE: "متوسط", ADVANCED: "پیشرفته" } as Record<string, string>)[value ?? ""] ?? "ثبت نشده";
}

function degreeLabel(value?: string | null) {
  return ({ MASTER: "ارشد", PHD: "دکتری" } as Record<string, string>)[value ?? ""] ?? value ?? "مقطع نامشخص";
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [mastery, setMastery] = useState<Mastery[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgressCourse[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [sessionNextCursor, setSessionNextCursor] = useState<string | null>(null);
  const [planNextCursor, setPlanNextCursor] = useState<string | null>(null);
  const [historyBusy, setHistoryBusy] = useState<"sessions" | "plans" | null>(null);
  const [historyError, setHistoryError] = useState<{ sessions: string | null; plans: string | null }>({ sessions: null, plans: null });
  const [revisions, setRevisions] = useState<PlanRevision[]>([]);
  const [loading, setLoading] = useState(true);
  // An instructor is an account linked to a contributor profile, which only
  // the API knows -- it is not a role on the session.
  const [isInstructor, setIsInstructor] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    (async () => {
      try {
        const [meRes, profileRes, enrollmentsRes, entitlementsRes, masteryRes, revisionsRes, learningRes, historyRes, instructorRes] = await Promise.all([
          apiFetch<Me>("/auth/me"),
          apiFetch<Profile>("/me/profile"),
          apiFetch<Enrollment[]>("/me/enrollments"),
          apiFetch<Entitlement[]>("/me/entitlements"),
          apiFetch<Mastery[]>("/me/mastery").catch(() => []),
          apiFetch<PlanRevision[]>("/me/plan/revisions").catch(() => []),
          apiFetch<unknown>("/me/learning-progress").catch(() => ({ courses: [] })),
          apiFetch<unknown>("/me/study-history?limit=10").catch(() => ({ sessions: [], plans: [] })),
          // 403 here just means "not an instructor", which is the common case.
          apiFetch<unknown>("/me/instructor").then(() => true).catch(() => false),
        ]);
        setMe(meRes);
        setIsInstructor(instructorRes === true);
        setProfile(profileRes);
        setEnrollments(enrollmentsRes);
        setEntitlements(entitlementsRes);
        setMastery(Array.isArray(masteryRes) ? masteryRes : []);
        setRevisions(Array.isArray(revisionsRes) ? revisionsRes : []);
        setLearningProgress(arrayFrom(learningRes, ["courses", "items"]) as LearningProgressCourse[]);
        const sessionPage = historyCollection<StudySession>(historyRes, "sessions");
        const planPage = historyCollection<PlanHistoryItem>(historyRes, "plans");
        setStudySessions(sessionPage.items);
        setPlanHistory(planPage.items);
        setSessionNextCursor(sessionPage.nextCursor);
        setPlanNextCursor(planPage.nextCursor);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const learningTotals = useMemo(() => learningProgress.reduce((result, item) => ({
    completed: result.completed + completedLessons(item),
    viewed: result.viewed + Math.max(0, item.viewedLessons ?? 0),
  }), { completed: 0, viewed: 0 }), [learningProgress]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaveState("saving");
    const updated = await apiFetch<Profile>("/me/profile", {
      method: "PATCH",
      body: {
        displayName: profile.displayName || undefined,
        targetDegree: profile.targetDegree || undefined,
        targetField: profile.targetField || undefined,
      },
    });
    setProfile(updated);
    setSaveState("saved");
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function loadMoreHistory(kind: "sessions" | "plans") {
    const cursor = kind === "sessions" ? sessionNextCursor : planNextCursor;
    if (!cursor || historyBusy) return;

    setHistoryBusy(kind);
    setHistoryError((current) => ({ ...current, [kind]: null }));
    const params = new URLSearchParams({ limit: "10", section: kind });
    params.set(kind === "sessions" ? "sessionsCursor" : "plansCursor", cursor);

    try {
      const response = await apiFetch<unknown>(`/me/study-history?${params.toString()}`);
      if (kind === "sessions") {
        const page = historyCollection<StudySession>(response, kind);
        setStudySessions((current) => appendUniqueById(current, page.items));
        setSessionNextCursor(page.nextCursor === cursor ? null : page.nextCursor);
      } else {
        const page = historyCollection<PlanHistoryItem>(response, kind);
        setPlanHistory((current) => appendUniqueById(current, page.items));
        setPlanNextCursor(page.nextCursor === cursor ? null : page.nextCursor);
      }
    } catch {
      setHistoryError((current) => ({
        ...current,
        [kind]: "بارگذاری موارد قدیمی‌تر انجام نشد. دوباره تلاش کن.",
      }));
    } finally {
      setHistoryBusy(null);
    }
  }

  if (loading) {
    return (
      <AccountShell title="حساب من">
        <SkeletonRows rows={4} height="6rem" />
      </AccountShell>
    );
  }
  if (!me) return null;

  const greetingName = profile?.displayName?.trim() || "خوش آمدی";
  const staff = me.user.roles.some((role) => ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"].includes(role));
  const studyMinutes = studySessions.reduce((sum, session) => sum + (session.minutes ?? 0), 0);
  // The most useful thing on a student dashboard is where to pick up, so the
  // first course with a resume point is lifted out of the progress list.
  const resumeCourse = learningProgress.find((item) => (item.resumeLesson ?? item.nextLesson)?.id);
  // A brand-new account has nothing in any section. Rendering six identical
  // "nothing here yet" cards is a wall that tells the student they have
  // failed at something; one card that says what to do next is the same
  // information and a better first minute.
  const isNewAccount =
    enrollments.length === 0 &&
    entitlements.length === 0 &&
    mastery.length === 0 &&
    studySessions.length === 0 &&
    learningProgress.length === 0 &&
    planHistory.length === 0 &&
    revisions.length === 0;
  const resumeLesson = resumeCourse ? (resumeCourse.resumeLesson ?? resumeCourse.nextLesson) : null;

  return (
    <AccountShell
      title={greetingName}
      subtitle="پیشرفت مطالعه، دسترسی‌ها و شواهد سنجش‌ات، بدون آمیختن با هم."
      chips={
        <>
          <span className="acc-chip">{me.user.phone}</span>
          {profile?.targetDegree && <span className="acc-chip">هدف: {degreeLabel(profile.targetDegree)}</span>}
          {profile?.targetField && <span className="acc-chip">{profile.targetField}</span>}
          {staff && <span className="acc-chip">{me.user.roles.join("، ")}</span>}
        </>
      }
      action={
        <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
          {staff && (
            <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/admin">
              پنل مدیریت
            </Link>
          )}
          {isInstructor && (
            <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/instructor">
              پنل مدرس
            </Link>
          )}
          <Button size="sm" onClick={logout}>
            خروج از حساب
          </Button>
        </div>
      }
    >
      <div className="ds-stack-lg">
        <KpiGrid>
          <Kpi
            label="دوره‌های من"
            value={toPersianDigits(enrollments.length)}
            hint="دوره‌های ثبت‌نام‌شده"
            icon={<PanelIcon name="course" />}
            tone="info"
          />
          <Kpi
            label="درس‌های تکمیل‌شده"
            value={toPersianDigits(learningTotals.completed)}
            hint="فعالیت مطالعه، نه نمره"
            icon={<PanelIcon name="check" />}
          />
          <Kpi
            label="زمان مطالعهٔ ثبت‌شده"
            value={`${toPersianDigits(Math.round(studyMinutes / 60))} ساعت`}
            hint={`${toPersianDigits(studySessions.length)} جلسهٔ ثبت‌شده`}
            icon={<PanelIcon name="clock" />}
            tone="warm"
          />
          <Kpi
            label="موضوعات ارزیابی‌شده"
            value={toPersianDigits(mastery.length)}
            hint="دارای شواهد پاسخ"
            icon={<PanelIcon name="chart" />}
            tone="success"
          />
        </KpiGrid>

        {resumeLesson?.id && (
          <div className="acc-resume">
            <div>
              <strong>ادامهٔ {courseTitle(resumeCourse!)}</strong>
              <p>
                درس بعدی: {resumeLesson.title ?? "درس"}
                {totalLessons(resumeCourse!) > 0 &&
                  ` · ${toPersianDigits(completedLessons(resumeCourse!))} از ${toPersianDigits(totalLessons(resumeCourse!))} درس تکمیل شده`}
              </p>
            </div>
            <Link className="ds-btn ds-btn-primary" href={`/lessons/${resumeLesson.id}`}>
              ادامه بده
            </Link>
          </div>
        )}

        {isNewAccount ? (
          <Card>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              از کجا شروع کنیم؟
            </h2>
            <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
              حساب شما تازه است و هنوز فعالیتی ثبت نشده. هر کدام از این سه مسیر را که شروع کنید، پیشرفت و
              شواهد سنجش‌تان از همان لحظه همین‌جا جمع می‌شود.
            </p>
            <div className="pg-grid pg-grid-wide">
              <Link className="pg-card" href="/courses">
                <h3>یک دوره را شروع کن</h3>
                <p>از ابتدای یک درس شروع کن؛ نقطهٔ ادامه‌ات همیشه بالای همین صفحه می‌آید.</p>
              </Link>
              <Link className="pg-card" href="/questions">
                <h3>در بانک سؤال تمرین کن</h3>
                <p>نمونه‌سؤال‌های عمومی برای همه باز است و برای دیدن کل بانک هر درس، دسترسی لازم می‌شود.</p>
              </Link>
              <Link className="pg-card" href="/consultations">
                <h3>مشاوره رزرو کن</h3>
                <p>یک جلسه برای تعیین مسیر، یا بستهٔ سالیانه‌ای که تا روز کنکور همراهت باشد.</p>
              </Link>
            </div>
          </Card>
        ) : (
        <div className="pg-grid pg-grid-wide">
          <Card>
            <span className="ds-eyebrow">فعالیت، نه نمره</span>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--sp-2)" }}>
              پیشرفت مطالعه
            </h2>
            <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
              این بخش فقط بازدید و تکمیل درس‌ها را گزارش می‌کند و دربارهٔ میزان یادگیری علمی ادعایی ندارد.
            </p>
            {learningProgress.length === 0 ? (
              <DsEmptyState
                title="هنوز فعالیت درسی ثبت نشده"
                description="با شروع یک درس، نقطهٔ ادامه و تکمیل‌های واقعی اینجا نمایش داده می‌شوند."
                action={
                  <Link className="ds-btn ds-btn-secondary" href="/courses">
                    مشاهدهٔ دوره‌ها
                  </Link>
                }
              />
            ) : (
              <ul className="quick-links">
                {learningProgress.map((item, index) => {
                  const total = totalLessons(item);
                  const completed = completedLessons(item);
                  const resume = item.resumeLesson ?? item.nextLesson;
                  return (
                    <li key={`${courseSlug(item)}-${index}`}>
                      <strong>{courseTitle(item)}</strong>
                      <p className="muted-copy">
                        {total > 0
                          ? `${toPersianDigits(completed)} از ${toPersianDigits(total)} درس تکمیل شده`
                          : `${toPersianDigits(item.viewedLessons ?? 0)} درس مشاهده شده`}
                      </p>
                      {total > 0 && <ProgressBar value={progressPercent(item)} label="پیشرفت تکمیل درس" />}
                      {resume?.id ? (
                        <Link href={`/lessons/${resume.id}`}>ادامهٔ مطالعهٔ {resume.title ?? "درس"} ←</Link>
                      ) : (
                        courseSlug(item) && <Link href={`/courses/${courseSlug(item)}`}>مشاهدهٔ دوره ←</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <span className="ds-eyebrow">سنجش مبتنی بر شواهد</span>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--sp-2)" }}>
              تسلط علمی
            </h2>
            <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
              تسلط فقط از پاسخ‌های ارزیابی‌شده محاسبه می‌شود؛ تکمیل درس یا ساعت مطالعه به‌تنهایی شاهد تسلط
              نیست.
            </p>
            {mastery.length === 0 ? (
              <DsEmptyState
                title="هنوز شاهد ارزیابی وجود ندارد"
                description="پس از پاسخ به سؤال‌های ارزیابی‌شده، امتیاز و میزان اطمینان اینجا ثبت می‌شوند."
                action={
                  <Link className="ds-btn ds-btn-secondary" href="/exams">
                    رفتن به آزمون‌ها
                  </Link>
                }
              />
            ) : (
              <ul className="quick-links">
                {mastery.map((item) => (
                  <li key={`${item.subjectCode}-${item.topicCode}`}>
                    <strong>
                      {item.subjectCode} / {item.topicCode}
                    </strong>
                    <p className="muted-copy">
                      امتیاز مبتنی بر پاسخ‌ها: {toPersianDigits((item.masteryScore * 100).toFixed(0))}٪ · اطمینان:{" "}
                      {item.confidence}
                      {typeof item.evidenceCount === "number"
                        ? ` · ${toPersianDigits(item.evidenceCount)} شاهد`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              دوره‌های من
            </h2>
            {enrollments.length === 0 ? (
              <DsEmptyState
                title="دوره‌ای در حساب نیست"
                description="دوره‌های ثبت‌شده اینجا نمایش داده می‌شوند."
                action={
                  <Link className="ds-btn ds-btn-secondary" href="/courses">
                    مشاهدهٔ دوره‌ها
                  </Link>
                }
              />
            ) : (
              <ul className="quick-links">
                {enrollments.map((item) => (
                  <li key={item.id}>
                    <Link href={`/courses/${item.course.slug}`}>{item.course.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              دسترسی‌های من
            </h2>
            {entitlements.length === 0 ? (
              <DsEmptyState
                title="دسترسی فعالی نیست"
                description="دسترسی‌های خریداری یا اعطاشده اینجا قرار می‌گیرند."
              />
            ) : (
              <ul className="quick-links">
                {entitlements.map((item) => (
                  <li key={item.id}>
                    <strong>{item.product.title}</strong>
                    <p className="muted-copy">نحوهٔ دسترسی: {item.grantedVia}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              جلسه‌های مطالعه
            </h2>
            {studySessions.length === 0 ? (
              <DsEmptyState
                title="هنوز جلسه‌ای ثبت نشده"
                description="زمان واقعی‌ای که هنگام تکمیل وارد می‌کنی و ثبت‌های دستی، بدون وابستگی به سال آزمون در سابقه می‌مانند."
              />
            ) : (
              <>
                <ul className="quick-links">
                  {studySessions.map((session) => (
                    <li key={session.id}>
                      <strong>
                        {session.subjectCode}
                        {session.topicCode ? ` / ${session.topicCode}` : ""}
                      </strong>
                      <p className="muted-copy">
                        {toPersianDigits(session.minutes)} دقیقه · {dateLabel(session.loggedAt)} ·{" "}
                        {session.source === "TASK_ACTUAL"
                          ? "زمان واقعی ثبت‌شده برای کار"
                          : session.source === "MANUAL"
                            ? "ثبت دستی"
                            : "نوع ثبت در نسخهٔ قدیمی مشخص نیست"}
                      </p>
                    </li>
                  ))}
                </ul>
                {sessionNextCursor && (
                  <Button onClick={() => void loadMoreHistory("sessions")} loading={historyBusy === "sessions"} disabled={historyBusy !== null}>
                    نمایش جلسه‌های قدیمی‌تر
                  </Button>
                )}
                {historyError.sessions && <Alert tone="danger">{historyError.sessions}</Alert>}
              </>
            )}
          </Card>

          <Card>
            <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
              نسخه‌های برنامه
            </h2>
            {planHistory.length === 0 ? (
              <DsEmptyState
                title="هنوز برنامه‌ای در تاریخچه نیست"
                description="نسخه‌های قبلی برنامه با مشخصات هدف همان زمان نگهداری می‌شوند."
              />
            ) : (
              <>
                <ul className="quick-links">
                  {planHistory.map((plan) => {
                    const snapshot = plan.goalSnapshot;
                    const degree = snapshot?.degree ?? plan.goalDegree;
                    const field = snapshot?.field ?? plan.goalField;
                    const weeklyHours = snapshot?.weeklyHours ?? plan.goalWeeklyHours;
                    const level = snapshot?.selfReportedLevel ?? plan.goalSelfReportedLevel;
                    return (
                      <li key={plan.id}>
                        <strong>
                          برنامهٔ {degreeLabel(degree)}
                          {plan.version ? ` · نسخهٔ ${toPersianDigits(plan.version)}` : ""}
                        </strong>
                        <p className="muted-copy">
                          {field ?? "رشته ثبت نشده"}
                          {typeof weeklyHours === "number" ? ` · ${toPersianDigits(weeklyHours)} ساعت در هفته` : ""} ·{" "}
                          {levelLabel(level)} · {dateLabel(plan.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                {planNextCursor && (
                  <Button onClick={() => void loadMoreHistory("plans")} loading={historyBusy === "plans"} disabled={historyBusy !== null}>
                    نمایش نسخه‌های قدیمی‌تر
                  </Button>
                )}
                {historyError.plans && <Alert tone="danger">{historyError.plans}</Alert>}
              </>
            )}
          </Card>
        </div>
        )}

        {!isNewAccount && (
        <Card>
          <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
            تاریخچهٔ تغییر برنامه
          </h2>
          {revisions.length === 0 ? (
            <DsEmptyState
              title="هنوز تغییری ثبت نشده"
              description="دلیل ساخت و بازبرنامه‌ریزی‌های آینده اینجا ثبت می‌شود."
            />
          ) : (
            <ul className="quick-links">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <strong>{revision.summary}</strong>
                  <p className="muted-copy">
                    {revision.reasonCode} · {dateLabel(revision.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        )}

        {/* Settings, not dashboard: a form is what you come here to change,
            not what you come here to see, so it sits after the state. */}
        <Card>
          <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
            پروفایل
          </h2>
          <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-5)" }}>
            نام نمایشی و هدف کنکور شما. برنامهٔ مطالعه و پیشنهادها بر همین پایه ساخته می‌شوند.
          </p>
          {profile && (
            <form className="ds-stack" onSubmit={saveProfile}>
              <FieldRow>
                <Field label="نام نمایشی">
                  {(props) => (
                    <Input
                      {...props}
                      value={profile.displayName ?? ""}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="مقطع هدف">
                  {(props) => (
                    <Select
                      {...props}
                      value={profile.targetDegree ?? ""}
                      onChange={(e) => setProfile({ ...profile, targetDegree: e.target.value })}
                    >
                      <option value="">—</option>
                      <option value="MASTER">ارشد</option>
                      <option value="PHD">دکتری</option>
                    </Select>
                  )}
                </Field>
              </FieldRow>
              <Field label="رشتهٔ هدف">
                {(props) => (
                  <Input
                    {...props}
                    value={profile.targetField ?? ""}
                    onChange={(e) => setProfile({ ...profile, targetField: e.target.value })}
                  />
                )}
              </Field>
              <div className="ds-row">
                <Button type="submit" variant="primary" loading={saveState === "saving"}>
                  ذخیره تغییرات
                </Button>
                {saveState === "saved" && <Badge tone="success">ذخیره شد</Badge>}
              </div>
            </form>
          )}
        </Card>
      </div>
    </AccountShell>
  );
}
