"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader, ProgressBar, StatCard } from "../../components/ui";

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    (async () => {
      try {
        const [meRes, profileRes, enrollmentsRes, entitlementsRes, masteryRes, revisionsRes, learningRes, historyRes] = await Promise.all([
          apiFetch<Me>("/auth/me"),
          apiFetch<Profile>("/me/profile"),
          apiFetch<Enrollment[]>("/me/enrollments"),
          apiFetch<Entitlement[]>("/me/entitlements"),
          apiFetch<Mastery[]>("/me/mastery").catch(() => []),
          apiFetch<PlanRevision[]>("/me/plan/revisions").catch(() => []),
          apiFetch<unknown>("/me/learning-progress").catch(() => ({ courses: [] })),
          apiFetch<unknown>("/me/study-history?limit=10").catch(() => ({ sessions: [], plans: [] })),
        ]);
        setMe(meRes);
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

  if (loading) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری حساب…</div></main>;
  if (!me) return null;

  return (
    <main className="page-container">
      <PageHeader eyebrow="فضای شخصی" title="حساب من" description="پروفایل، دسترسی‌ها، فعالیت مطالعه و شواهد سنجش را بدون آمیختن با یکدیگر ببین." action={<button className="button button-secondary" onClick={logout}>خروج از حساب</button>} />
      <section className="content-grid">
        <div className="surface-card">
          <div className="account-identity"><div className="avatar-placeholder">{me.user.phone.slice(-2)}</div><div><strong>{me.user.phone}</strong><p className="muted-copy">نقش‌ها: {me.user.roles.join(", ")}</p></div></div>
          {me.user.roles.some((role) => ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"].includes(role)) && (
            <Link className="quick-link-highlight" href="/admin">ورود به پنل ادمین ←</Link>
          )}

          <h2>پروفایل</h2>
          {profile && (
            <form className="field-grid" onSubmit={saveProfile}>
              <label className="field-group"><span>نام نمایشی</span><input className="field-input" value={profile.displayName ?? ""} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></label>
              <label className="field-group"><span>مقطع هدف</span><select className="field-input" value={profile.targetDegree ?? ""} onChange={(e) => setProfile({ ...profile, targetDegree: e.target.value })}>
                <option value="">—</option><option value="MASTER">ارشد</option><option value="PHD">دکتری</option>
              </select></label>
              <label className="field-group"><span>رشتهٔ هدف</span><input className="field-input" value={profile.targetField ?? ""} onChange={(e) => setProfile({ ...profile, targetField: e.target.value })} /></label>
              <button className="button button-primary" type="submit">{saveState === "saving" ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
              {saveState === "saved" && <span className="success-message">ذخیره شد</span>}
            </form>
          )}
        </div>
        <div className="stats-grid account-stats">
          <StatCard label="درس‌های تکمیل‌شده" value={toPersianDigits(learningTotals.completed)} detail="فعالیت مطالعه ثبت‌شده" tone="teal" />
          <StatCard label="دسترسی‌ها" value={toPersianDigits(entitlements.length)} detail="محصولات فعال حساب" tone="blue" />
          <StatCard label="موضوعات ارزیابی‌شده" value={toPersianDigits(mastery.length)} detail="دارای شواهد پاسخ" tone="purple" />
        </div>
      </section>

      <section className="content-grid-wide account-sections">
        <div className="surface-card">
          <span className="eyebrow">فعالیت، نه نمره</span>
          <h2>پیشرفت مطالعه</h2>
          <p className="muted-copy">این بخش فقط بازدید و تکمیل درس‌ها را گزارش می‌کند و دربارهٔ میزان یادگیری علمی ادعایی ندارد.</p>
          {learningProgress.length === 0 ? (
            <EmptyState title="هنوز فعالیت درسی ثبت نشده" description="با شروع یک درس، نقطهٔ ادامه و تکمیل‌های واقعی اینجا نمایش داده می‌شوند." action={<Link className="button button-secondary" href="/courses">مشاهدهٔ دوره‌ها</Link>} />
          ) : (
            <ul className="quick-links">
              {learningProgress.map((item, index) => {
                const total = totalLessons(item);
                const completed = completedLessons(item);
                const resume = item.resumeLesson ?? item.nextLesson;
                return (
                  <li key={`${courseSlug(item)}-${index}`}>
                    <strong>{courseTitle(item)}</strong>
                    <p className="muted-copy">{total > 0 ? `${toPersianDigits(completed)} از ${toPersianDigits(total)} درس تکمیل شده` : `${toPersianDigits(item.viewedLessons ?? 0)} درس مشاهده شده`}</p>
                    {total > 0 && <ProgressBar value={progressPercent(item)} label="پیشرفت تکمیل درس" />}
                    {resume?.id ? <Link href={`/lessons/${resume.id}`}>ادامهٔ مطالعهٔ {resume.title ?? "درس"} ←</Link> : courseSlug(item) && <Link href={`/courses/${courseSlug(item)}`}>مشاهدهٔ دوره ←</Link>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="surface-card">
          <span className="eyebrow">سنجش مبتنی بر شواهد</span>
          <h2>تسلط علمی</h2>
          <p className="muted-copy">تسلط فقط از پاسخ‌های ارزیابی‌شده محاسبه می‌شود؛ تکمیل درس یا ساعت مطالعه به‌تنهایی شاهد تسلط نیست.</p>
          {mastery.length === 0 ? (
            <EmptyState title="هنوز شاهد ارزیابی وجود ندارد" description="پس از پاسخ به سؤال‌های ارزیابی‌شده، امتیاز و میزان اطمینان اینجا ثبت می‌شوند." action={<Link className="button button-secondary" href="/exams">رفتن به آزمون‌ها</Link>} />
          ) : (
            <ul className="quick-links">
              {mastery.map((item) => (
                <li key={`${item.subjectCode}-${item.topicCode}`}>
                  <strong>{item.subjectCode} / {item.topicCode}</strong>
                  <p className="muted-copy">امتیاز مبتنی بر پاسخ‌ها: {toPersianDigits((item.masteryScore * 100).toFixed(0))}٪ · اطمینان: {item.confidence}{typeof item.evidenceCount === "number" ? ` · ${toPersianDigits(item.evidenceCount)} شاهد` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card">
          <h2>دوره‌های من</h2>
          {enrollments.length === 0 ? (
            <EmptyState title="دوره‌ای در حساب نیست" description="دوره‌های ثبت‌شده اینجا نمایش داده می‌شوند." action={<Link className="button button-secondary" href="/courses">مشاهدهٔ دوره‌ها</Link>} />
          ) : (
            <ul className="quick-links">{enrollments.map((item) => <li key={item.id}><Link href={`/courses/${item.course.slug}`}>{item.course.title}</Link></li>)}</ul>
          )}
        </div>

        <div className="surface-card">
          <h2>دسترسی‌های من</h2>
          {entitlements.length === 0 ? (
            <EmptyState title="دسترسی فعالی نیست" description="دسترسی‌های خریداری یا اعطاشده اینجا قرار می‌گیرند." />
          ) : (
            <ul className="quick-links">{entitlements.map((item) => <li key={item.id}><strong>{item.product.title}</strong><p className="muted-copy">نحوهٔ دسترسی: {item.grantedVia}</p></li>)}</ul>
          )}
        </div>

        <div className="surface-card">
          <h2>جلسه‌های مطالعه</h2>
          {studySessions.length === 0 ? (
            <EmptyState title="هنوز جلسه‌ای ثبت نشده" description="زمان واقعی‌ای که هنگام تکمیل وارد می‌کنی و ثبت‌های دستی، بدون وابستگی به سال آزمون در سابقه می‌مانند." />
          ) : (
            <>
              <ul className="quick-links">{studySessions.map((session) => <li key={session.id}><strong>{session.subjectCode}{session.topicCode ? ` / ${session.topicCode}` : ""}</strong><p className="muted-copy">{toPersianDigits(session.minutes)} دقیقه · {dateLabel(session.loggedAt)} · {session.source === "TASK_ACTUAL" ? "زمان واقعی ثبت‌شده برای کار" : session.source === "MANUAL" ? "ثبت دستی" : "نوع ثبت در نسخهٔ قدیمی مشخص نیست"}</p></li>)}</ul>
              {sessionNextCursor && <button className="button button-secondary" type="button" onClick={() => void loadMoreHistory("sessions")} disabled={historyBusy !== null}>{historyBusy === "sessions" ? "در حال بارگذاری…" : "نمایش جلسه‌های قدیمی‌تر"}</button>}
              {historyError.sessions && <p className="muted-copy" role="alert">{historyError.sessions}</p>}
            </>
          )}
        </div>

        <div className="surface-card">
          <h2>نسخه‌های برنامه</h2>
          {planHistory.length === 0 ? (
            <EmptyState title="هنوز برنامه‌ای در تاریخچه نیست" description="نسخه‌های قبلی برنامه با مشخصات هدف همان زمان نگهداری می‌شوند." />
          ) : (
            <>
            <ul className="quick-links">{planHistory.map((plan) => {
              const snapshot = plan.goalSnapshot;
              const degree = snapshot?.degree ?? plan.goalDegree;
              const field = snapshot?.field ?? plan.goalField;
              const weeklyHours = snapshot?.weeklyHours ?? plan.goalWeeklyHours;
              const level = snapshot?.selfReportedLevel ?? plan.goalSelfReportedLevel;
              return <li key={plan.id}><strong>برنامهٔ {degreeLabel(degree)}{plan.version ? ` · نسخهٔ ${toPersianDigits(plan.version)}` : ""}</strong><p className="muted-copy">{field ?? "رشته ثبت نشده"}{typeof weeklyHours === "number" ? ` · ${toPersianDigits(weeklyHours)} ساعت در هفته` : ""} · {levelLabel(level)} · {dateLabel(plan.createdAt)}</p></li>;
            })}</ul>
            {planNextCursor && <button className="button button-secondary" type="button" onClick={() => void loadMoreHistory("plans")} disabled={historyBusy !== null}>{historyBusy === "plans" ? "در حال بارگذاری…" : "نمایش نسخه‌های قدیمی‌تر"}</button>}
            {historyError.plans && <p className="muted-copy" role="alert">{historyError.plans}</p>}
            </>
          )}
        </div>
      </section>

      <section className="surface-card revision-section">
        <h2>تاریخچهٔ تغییر برنامه</h2>
        {revisions.length === 0 ? (
          <EmptyState title="هنوز تغییری ثبت نشده" description="دلیل ساخت و بازبرنامه‌ریزی‌های آینده اینجا ثبت می‌شود." />
        ) : (
          <ul>{revisions.map((revision) => <li key={revision.id}>[{revision.reasonCode}] {revision.summary} — {dateLabel(revision.createdAt)}</li>)}</ul>
        )}
      </section>
    </main>
  );
}
