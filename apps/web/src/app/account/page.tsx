"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Glyph, type GlyphName } from "../../components/SubjectIcon";
import { apiFetch } from "../../lib/api";
import { isoDay, type CoachItem, type CoachPlan } from "../../lib/coach";
import { EXAM_DATES, daysUntil } from "../../lib/exam-dates";
import { formatRial, toPersianDigits } from "../../lib/format";
import { ProgressRing } from "./charts";
import { CoachTask } from "./CoachTask";
import {
  faDate,
  minutesLabel,
  RESOURCE_KIND_LABEL,
  type CourseRecommendation,
  type LearningProgress,
  type Library,
  type MyAttempt,
  type TodayPlan,
} from "./data";
import { fieldLabel } from "./profile-options";
import { useStudent } from "./student-context";

type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ready"; data: T };

function useLoad<T>(path: string): [Loaded<T>, (data: T) => void] {
  const [value, setValue] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let cancelled = false;
    apiFetch<T>(path)
      .then((data) => !cancelled && setValue({ state: "ready", data }))
      .catch(() => !cancelled && setValue({ state: "error" }));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return [value, (data: T) => setValue({ state: "ready", data })];
}

function greeting(now: Date = new Date()) {
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" }));
  if (hour < 5) return "شب بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "ظهر بخیر";
  if (hour < 20) return "عصر بخیر";
  return "شب بخیر";
}

function Panel({ title, icon, action, children }: { title: string; icon: GlyphName; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="st-card">
      <header className="st-card-head">
        <h2>
          <span className="st-card-icon"><Glyph name={icon} /></span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div aria-busy="true">
      <div className="st-skel st-skel-line" />
      <div className="st-skel st-skel-line" />
    </div>
  );
}

function Failed() {
  return <p className="st-card-note">این بخش الان بارگذاری نشد؛ صفحه را دوباره باز کن.</p>;
}

function Empty({ icon, title, text, action }: { icon: GlyphName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="st-empty">
      <span className="st-empty-icon"><Glyph name={icon} /></span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

/**
 * The student's home: what to do today, where they stand, what they own, and
 * what would help next. Five blocks, in that order -- the numbers and charts
 * live on their own pages, so this one stays readable at a glance.
 */
export default function DashboardPage() {
  const { profile } = useStudent();
  const [coach, setCoach] = useLoad<{ today: string; plans: CoachPlan[] }>("/me/coach-plans");
  const [today] = useLoad<TodayPlan>("/me/plan/today");
  const [attempts] = useLoad<MyAttempt[]>("/me/attempts");
  const [progress] = useLoad<LearningProgress>("/me/learning-progress");
  const [library] = useLoad<Library>("/me/library");
  const [recommended] = useLoad<CourseRecommendation[]>("/me/recommendations/courses");

  const examDate = profile.targetDegree === "PHD" ? EXAM_DATES.phd1406 : EXAM_DATES.master1406;
  const days = daysUntil(examDate.iso);
  const firstName = profile.firstName ?? profile.displayName ?? "";

  const currentPlan = coach.state === "ready" ? coach.data.plans.find((plan) => plan.isCurrent) : undefined;
  const coachToday =
    coach.state === "ready" && currentPlan
      ? currentPlan.items.filter((item) => isoDay(item.day) === coach.data.today)
      : [];
  const courses = progress.state === "ready" ? progress.data.courses : [];
  const resume = courses.find((course) => course.resumeLesson);
  const latest = attempts.state === "ready" ? attempts.data.find((attempt) => attempt.score) : undefined;

  function replaceCoachItem(updated: CoachItem) {
    if (coach.state !== "ready") return;
    setCoach({
      ...coach.data,
      plans: coach.data.plans.map((plan) => {
        const items = plan.items.map((item) => (item.id === updated.id ? updated : item));
        const done = items.filter((item) => item.completedAt).length;
        return { ...plan, items, progress: { total: items.length, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 } };
      }),
    });
  }

  return (
    <div className="st-page">
      <section className="st-hero st-hero-slim">
        <div className="st-hero-text">
          <p className="st-hero-kicker">{greeting()}{firstName ? `، ${firstName}` : ""}</p>
          <h1>امروز یک قدم به کنکور نزدیک‌تر شو</h1>
          <p className="st-hero-sub">
            <span className="st-hero-pill" suppressHydrationWarning>
              <b>{toPersianDigits(days)}</b> روز تا {examDate.label}
            </span>
            <span className="st-hero-pill">{fieldLabel(profile.targetField)}</span>
          </p>
        </div>
        <div className="st-hero-actions">
          {resume?.resumeLesson ? (
            <Link href={`/lessons/${resume.resumeLesson.id}`} className="st-btn st-btn-light st-btn-lg">
              <Glyph name="play" />
              ادامهٔ درس
            </Link>
          ) : (
            <Link href="/courses" className="st-btn st-btn-light st-btn-lg">
              <Glyph name="play" />
              دوره‌ها
            </Link>
          )}
          <Link href={currentPlan ? "/account/plan" : "/today"} className="st-btn st-btn-glass">
            <Glyph name="calendar" />
            برنامهٔ هفته
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------ today */}
      <section className="st-card st-today">
        <header className="st-card-head">
          <h2>
            <span className="st-card-icon"><Glyph name="calendar" /></span>
            کارهای امروز
          </h2>
          {currentPlan ? (
            <span className="st-today-coach">
              برنامهٔ {currentPlan.coach?.displayName ?? "مشاور"} ·{" "}
              {toPersianDigits(currentPlan.progress.done)} از {toPersianDigits(currentPlan.progress.total)} کار هفته
            </span>
          ) : (
            <Link href="/today" className="st-link">برنامهٔ امروز ←</Link>
          )}
        </header>
        {coach.state === "loading" || (!currentPlan && today.state === "loading") ? (
          <Loading />
        ) : currentPlan ? (
          coachToday.length > 0 ? (
            <>
              <ul className="st-ctasks">
                {coachToday.map((item) => <CoachTask key={item.id} item={item} onChange={replaceCoachItem} />)}
              </ul>
              <Link href="/account/plan" className="st-link st-more-link">کل برنامهٔ هفته ←</Link>
            </>
          ) : (
            <Empty
              icon="calendar"
              title="امروز در برنامهٔ مشاورت کاری نیست"
              text="اگر از روزهای قبل عقب مانده‌ای، از برنامهٔ هفته جبرانش کن."
              action={<Link href="/account/plan" className="st-btn st-btn-soft st-btn-sm">برنامهٔ هفته</Link>}
            />
          )
        ) : today.state === "ready" && today.data.tasks.length > 0 ? (
          <ul className="st-tasks">
            {today.data.tasks.map((task) => (
              <li key={task.id}>
                <span className="st-task-dot" aria-hidden />
                <div>
                  {task.href ? <Link href={task.href}>{task.title}</Link> : <span>{task.title}</span>}
                  <small>{minutesLabel(task.estimatedMinutes)} · {task.reason}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            icon="calendar"
            title="هنوز برنامه‌ای برای امروز نداری"
            text="برنامهٔ خودکار را از روی هدف و آزمون‌هایت بساز، یا با مشاوره، برنامهٔ هفتگی شخصی بگیر."
            action={
              <div className="st-row">
                <Link href="/today" className="st-btn st-btn-primary st-btn-sm">ساخت برنامه</Link>
                <Link href="/consultations" className="st-btn st-btn-soft st-btn-sm">مشاوره با مدرس</Link>
              </div>
            }
          />
        )}
      </section>

      <div className="st-dash">
        <div className="st-dash-main">
          {/* ------------------------------------------------ exam standing */}
          <Panel title="آخرین آزمون" icon="trophy" action={<Link href="/account/exams" className="st-link">همهٔ آزمون‌ها ←</Link>}>
            {attempts.state === "loading" ? (
              <Loading />
            ) : attempts.state === "error" ? (
              <Failed />
            ) : !latest || !latest.standing ? (
              <Empty
                icon="target"
                title="هنوز آزمونی نداده‌ای"
                text="در آزمون‌های آزمایشی شرکت کن تا رتبه، تراز و درصدت را بین همهٔ شرکت‌کننده‌ها ببینی."
                action={<Link href="/exams" className="st-btn st-btn-primary st-btn-sm">آزمون‌ها</Link>}
              />
            ) : (
              <div className="st-standing">
                <div className="st-standing-rank">
                  {latest.standing.rank !== null ? (
                    <>
                      <small>رتبهٔ تو</small>
                      <b>{toPersianDigits(latest.standing.rank)}</b>
                      <small>از {toPersianDigits(latest.standing.participants)} نفر</small>
                    </>
                  ) : (
                    <>
                      <small>شرکت‌کننده‌ها</small>
                      <b>{toPersianDigits(latest.standing.participants)}</b>
                      <small>رتبه از ۵ نفر به بالا</small>
                    </>
                  )}
                </div>
                <div className="st-standing-info">
                  <strong>{latest.exam.title}</strong>
                  <small>{faDate(latest.submittedAt)}</small>
                  <div className="st-standing-stats">
                    <span>درصد: <b>{toPersianDigits(Math.round(latest.standing.konkurPercent))}٪</b></span>
                    {latest.standing.percentile !== null && (
                      <span>بهتر از <b>{toPersianDigits(latest.standing.percentile)}٪</b> شرکت‌کننده‌ها</span>
                    )}
                  </div>
                  <Link href={`/attempts/${latest.id}/report`} className="st-btn st-btn-soft st-btn-sm">کارنامه و تحلیل</Link>
                </div>
              </div>
            )}
          </Panel>

          {/* ------------------------------------------- continue learning */}
          <Panel title="ادامهٔ یادگیری" icon="play" action={<Link href="/account/courses" className="st-link">دوره‌های من ←</Link>}>
            {progress.state === "loading" ? (
              <Loading />
            ) : progress.state === "error" ? (
              <Failed />
            ) : courses.length === 0 ? (
              <Empty
                icon="book"
                title="هنوز درسی را شروع نکرده‌ای"
                text="با یک دورهٔ کامل یا ویدیوی رایگان همان درس شروع کن."
                action={
                  <div className="st-row">
                    <Link href="/courses" className="st-btn st-btn-primary st-btn-sm">دوره‌ها</Link>
                    <Link href="/free-videos" className="st-btn st-btn-soft st-btn-sm">ویدیوی رایگان</Link>
                  </div>
                }
              />
            ) : (
              <ul className="st-courses">
                {courses.slice(0, 3).map((course) => (
                  <li key={course.course.slug} className="st-course-row">
                    <ProgressRing percent={course.progressPercent} size={52} stroke={6} />
                    <div className="st-course-info">
                      <Link href={`/courses/${course.course.slug}`}><strong>{course.course.title}</strong></Link>
                      <small>
                        {toPersianDigits(course.completedLessons)} از {toPersianDigits(course.totalLessons)} درس
                        {course.resumeLesson ? ` · بعدی: ${course.resumeLesson.title}` : ""}
                      </small>
                    </div>
                    {course.resumeLesson && (
                      <Link href={`/lessons/${course.resumeLesson.id}`} className="st-btn st-btn-soft st-btn-sm">ادامه</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="st-dash-side">
          {/* ----------------------------------------------------- library */}
          <Panel title="جزوه‌های من" icon="book" action={<Link href="/account/library" className="st-link">همه ←</Link>}>
            {library.state === "loading" ? (
              <Loading />
            ) : library.state === "error" ? (
              <Failed />
            ) : library.data.resources.length === 0 ? (
              <p className="st-card-note">جزوه‌ها و منابعی که بخری، بعد از تأیید پرداخت همین‌جا می‌آیند.</p>
            ) : (
              <ul className="st-docs-mini">
                {library.data.resources.slice(0, 3).map((resource) => (
                  <li key={resource.id}>
                    <Link href={`/resources/${resource.slug}`}>
                      <span className="st-doc-icon st-doc-icon-sm"><Glyph name="book" /></span>
                      <span>
                        <strong>{resource.title}</strong>
                        <small>{RESOURCE_KIND_LABEL[resource.kind] ?? "منبع"}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* --------------------------------------------- recommendations */}
          {recommended.state === "ready" && recommended.data.length > 0 && (
            <Panel title="پیشنهاد برای تو" icon="spark">
              <ul className="st-recs">
                {recommended.data.slice(0, 2).map((item) => (
                  <li key={item.course.slug}>
                    <Link href={`/courses/${item.course.slug}`} className="st-rec">
                      <strong>{item.course.title}</strong>
                      {item.reasons[0] && <small className="st-rec-reason">{item.reasons[0]}</small>}
                      <span className="st-rec-foot">
                        <b>{formatRial(item.price.amountRial)}</b>
                        <span>مشاهدهٔ دوره ←</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
