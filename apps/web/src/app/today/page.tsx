"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader, ProgressBar, StatCard } from "../../components/ui";

type SelfReportedLevel = "UNKNOWN" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

interface Goal {
  degree: "MASTER" | "PHD";
  field: string;
  weeklyHours: number;
  selfReportedLevel?: SelfReportedLevel;
}

interface Task {
  id: string;
  title: string;
  subjectCode: string;
  topicCode: string | null;
  estimatedMinutes: number;
  status: string;
  reason?: string | null;
  href?: string | null;
  actionType?: string | null;
  lessonId?: string | null;
  resource?: { slug?: string } | null;
  resourceSlug?: string | null;
}

interface TodaySummary {
  totalTasks?: number;
  completedTasks?: number;
  plannedMinutes?: number;
  completedMinutes?: number;
  progressPercent?: number;
  message?: string;
}

function levelLabel(level?: SelfReportedLevel) {
  return ({ BEGINNER: "شروع از پایه", INTERMEDIATE: "متوسط", ADVANCED: "پیشرفته" } as Record<string, string>)[level ?? ""] ?? "ثبت نشده";
}

function canonicalField(value?: string) {
  const aliases: Record<string, string> = {
    "مهندسی کامپیوتر": "computer-engineering",
    "مهندسی و علم کامپیوتر": "computer-engineering",
    "فناوری اطلاعات": "information-technology",
    "مهندسی فناوری اطلاعات": "information-technology",
    "علوم کامپیوتر": "computer-science",
  };
  const normalized = value?.trim() ?? "";
  return ["computer-engineering", "information-technology", "computer-science"].includes(normalized)
    ? normalized
    : aliases[normalized] ?? "computer-engineering";
}

function fieldLabel(value: string) {
  return ({
    "computer-engineering": "مهندسی کامپیوتر",
    "information-technology": "فناوری اطلاعات",
    "computer-science": "علوم کامپیوتر",
  } as Record<string, string>)[value] ?? value;
}

function normalizeToday(value: unknown): { tasks: Task[]; summary: TodaySummary } {
  if (Array.isArray(value)) return { tasks: (value as Task[]).slice(0, 3), summary: {} };
  if (!value || typeof value !== "object") return { tasks: [], summary: {} };
  const record = value as { tasks?: unknown; summary?: unknown };
  return {
    tasks: Array.isArray(record.tasks) ? (record.tasks as Task[]).slice(0, 3) : [],
    summary: record.summary && typeof record.summary === "object" ? record.summary as TodaySummary : {},
  };
}

function taskHref(task: Task) {
  if (task.href?.startsWith("/")) return task.href;
  if (task.lessonId) return `/lessons/${task.lessonId}`;
  const resourceSlug = task.resource?.slug ?? task.resourceSlug;
  if (resourceSlug) return `/resources/${resourceSlug}`;
  return task.subjectCode ? `/subjects/${task.subjectCode}` : null;
}

function GoalForm({ onSaved, initialDegree, initialGoal }: { onSaved: () => void; initialDegree: "MASTER" | "PHD"; initialGoal?: Goal | null }) {
  const [degree, setDegree] = useState<"MASTER" | "PHD">(initialGoal?.degree ?? initialDegree);
  const [field, setField] = useState(canonicalField(initialGoal?.field));
  const [weeklyHours, setWeeklyHours] = useState(toPersianDigits(initialGoal?.weeklyHours ?? 10));
  const [selfReportedLevel, setSelfReportedLevel] = useState<SelfReportedLevel>(initialGoal?.selfReportedLevel ?? "UNKNOWN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/me/goal", {
        method: "PUT",
        body: { degree, field, weeklyHours: Number(toEnglishDigits(weeklyHours)), selfReportedLevel },
      });
      await apiFetch("/me/plan/replan", { method: "POST", body: { reasonCode: "GOAL_CHANGED" } });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ثبت هدف انجام نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-card goal-form-card">
      <span className="eyebrow">شروع سریع</span>
      <h2>{initialGoal ? "هدف تحصیلی‌ات را ویرایش کن" : "هدف تحصیلی‌ات را ثبت کن"}</h2>
      <p>مقطع، مسیر، زمان آزاد و سطح فعلی کمک می‌کنند پیشنهادهای شروع واقع‌بینانه باشند.</p>
      <form className="field-grid" onSubmit={submit}>
        <label className="field-group"><span>مقطع</span><select className="field-input" value={degree} onChange={(e) => setDegree(e.target.value as "MASTER" | "PHD")}>
          <option value="MASTER">ارشد</option>
          <option value="PHD">دکتری</option>
        </select></label>
        <label className="field-group"><span>رشتهٔ هدف</span><select className="field-input" value={field} onChange={(e) => setField(e.target.value)} required>
          <option value="computer-engineering">مهندسی کامپیوتر</option>
          <option value="information-technology">فناوری اطلاعات</option>
          <option value="computer-science">علوم کامپیوتر</option>
        </select></label>
        <label className="field-group"><span>ساعت مطالعه در هفته</span><input className="field-input" inputMode="numeric" placeholder="۱۰" value={weeklyHours} onChange={(e) => setWeeklyHours(toPersianDigits(e.target.value))} required /></label>
        <label className="field-group"><span>سطح فعلی به انتخاب خودت</span><select className="field-input" value={selfReportedLevel} onChange={(e) => setSelfReportedLevel(e.target.value as SelfReportedLevel)}>
          <option value="UNKNOWN" disabled>سطح را انتخاب کن</option>
          <option value="BEGINNER">شروع از پایه</option>
          <option value="INTERMEDIATE">متوسط</option>
          <option value="ADVANCED">پیشرفته</option>
        </select></label>
        <p className="muted-copy">این انتخاب فقط برای نقطهٔ شروع برنامه است و به‌معنای سنجش یا اثبات تسلط علمی نیست.</p>
        <button className="button button-primary" type="submit" disabled={saving || selfReportedLevel === "UNKNOWN"}>{saving ? "در حال ثبت…" : initialGoal ? "ذخیره و بازسازی برنامه" : "ثبت هدف و ساخت برنامه"}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </div>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const [queryDegree, setQueryDegree] = useState<"MASTER" | "PHD">("MASTER");
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [summary, setSummary] = useState<TodaySummary>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [actualMinutes, setActualMinutes] = useState<Record<string, string>>({});
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setQueryDegree(new URLSearchParams(window.location.search).get("degree") === "PHD" ? "PHD" : "MASTER");
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const goalRes = await apiFetch<Goal | null>("/me/goal");
      let today = { tasks: [] as Task[], summary: {} as TodaySummary };
      try {
        today = normalizeToday(await apiFetch<unknown>("/me/plan/today"));
      } catch (error) {
        if (!(error instanceof ApiError) || ![404, 409].includes(error.status)) throw error;
      }
      setGoal(goalRes);
      setTasks(today.tasks);
      setSummary(today.summary);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
      else {
        setGoal(null);
        setTasks([]);
        setLoadError("برای نمایش برنامه، اتصال به حساب کاربری برقرار نشد.");
      }
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function generatePlan() {
    setMessage(null);
    try {
      await apiFetch("/me/plan/replan", { method: "POST", body: {} });
      await load();
      setMessage("برنامه بر پایهٔ اطلاعات و محتوای واقعی حساب به‌روز شد.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ساخت برنامه ناموفق بود");
    }
  }

  async function reportFallingBehind() {
    setMessage(null);
    try {
      await apiFetch<unknown>("/me/plan/replan", {
        method: "POST",
        body: { reasonCode: "FALLING_BEHIND", note: "دانشجو اعلام عقب‌افتادگی کرد" },
      });
      await load();
      setMessage("کارهای قابل‌انجام دوباره با زمان امروز هماهنگ شدند.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "بازبرنامه‌ریزی ناموفق بود");
    }
  }

  async function completeTask(taskId: string) {
    setMessage(null);
    const rawMinutes = actualMinutes[taskId]?.trim();
    const parsedMinutes = rawMinutes ? Number(toEnglishDigits(rawMinutes)) : undefined;
    if (parsedMinutes !== undefined && (!Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 600)) {
      setMessage("زمان واقعی مطالعه باید یک عدد صحیح بین ۱ تا ۶۰۰ دقیقه باشد.");
      return;
    }
    setCompletingTaskId(taskId);
    try {
      await apiFetch(`/me/plan/tasks/${taskId}/complete`, {
        method: "POST",
        body: parsedMinutes === undefined ? {} : { actualMinutes: parsedMinutes },
      });
      setTasks((previous) => previous ? previous.filter((task) => task.id !== taskId) : previous);
      setSummary((previous) => {
        const completedTasks = (previous.completedTasks ?? 0) + 1;
        const totalTasks = Math.max(previous.totalTasks ?? 0, completedTasks);
        return {
          ...previous,
          completedTasks,
          totalTasks,
          completedMinutes: (previous.completedMinutes ?? 0) + (parsedMinutes ?? 0),
          progressPercent: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0,
        };
      });
      setMessage(parsedMinutes === undefined
        ? "انجام کار ثبت شد؛ چون زمان واقعی وارد نشده بود، دقیقه‌ای به سابقهٔ مطالعه اضافه نشد."
        : "انجام کار و زمان واقعی مطالعه ثبت شد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ثبت تکمیل کار انجام نشد.");
    } finally {
      setCompletingTaskId(null);
    }
  }

  const progress = useMemo(() => {
    const pending = tasks?.length ?? 0;
    const completed = Math.max(0, summary.completedTasks ?? 0);
    const total = Math.max(completed + pending, summary.totalTasks ?? 0);
    const explicit = summary.progressPercent;
    const value = Number.isFinite(explicit)
      ? Math.min(100, Math.max(0, Number(explicit)))
      : total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, value };
  }, [summary.completedTasks, summary.progressPercent, summary.totalTasks, tasks]);

  if (goal === undefined || tasks === null) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری برنامهٔ امروز…</div></main>;

  return (
    <main className="page-container">
      <PageHeader eyebrow="داشبورد داوطلب" title="امروز" description="سه اقدام قابل‌انجام، با دلیل پیشنهاد و زمان تقریبی؛ متناسب با مسیر واقعی تو." action={<div className="degree-switcher"><Link className={queryDegree === "MASTER" ? "active" : ""} href="/today?degree=MASTER">ارشد</Link><Link className={queryDegree === "PHD" ? "active" : ""} href="/today?degree=PHD">دکتری</Link></div>} />

      {loadError && <div className="form-error" role="alert">{loadError}</div>}

      {!goal ? (
        <GoalForm key={queryDegree} initialDegree={queryDegree} onSaved={load} />
      ) : (
        <>
          <section className="content-grid">
            <div className="surface-card">
              <span className="eyebrow">هدف فعلی</span>
              <h2>{goal.degree === "MASTER" ? "کنکور ارشد" : "کنکور دکتری"} کامپیوتر</h2>
              <p className="muted-copy">{fieldLabel(goal.field)} · {toPersianDigits(goal.weeklyHours)} ساعت در هفته · {levelLabel(goal.selfReportedLevel)}</p>
              <ProgressBar value={progress.value} label={progress.total > 0 ? `${toPersianDigits(progress.completed)} کار از ${toPersianDigits(progress.total)} کار ثبت‌شدهٔ امروز` : "هنوز پیشرفتی برای امروز ثبت نشده"} />
              <p className="muted-copy">پیشرفت بالا فقط از کارهای تکمیل‌شده محاسبه می‌شود؛ این عدد معیار تسلط علمی نیست.</p>
              <button className="button button-secondary" type="button" onClick={() => setEditingGoal((current) => !current)}>{editingGoal ? "بستن ویرایش" : "ویرایش هدف و سطح شروع"}</button>
            </div>
            <div className="stats-grid stats-grid-single">
              <StatCard label="اقدام‌های باقی‌مانده" value={toPersianDigits(tasks.length)} detail="حداکثر سه اولویت امروز" tone="teal" />
              <StatCard label="زمان پیشنهادی باقی‌مانده" value={`${toPersianDigits(tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0))} دقیقه`} detail="برآورد، نه زمان اجباری" tone="blue" />
            </div>
          </section>

          {editingGoal && <GoalForm initialDegree={goal.degree} initialGoal={goal} onSaved={() => { setEditingGoal(false); void load(); }} />}

          {tasks.length === 0 ? (
            <EmptyState title={progress.completed > 0 ? "اقدام‌های امروز انجام شده‌اند" : "اقدام قابل‌اتکایی برای امروز پیدا نشد"} description={summary.message ?? (progress.completed > 0 ? "فعالیت‌های انجام‌شده در سابقهٔ مطالعه می‌مانند." : "برای ساخت پیشنهاد، باید هدف و محتوای منتشرشدهٔ متناسب در دسترس باشد؛ دادهٔ ساختگی نمایش داده نمی‌شود.")} action={<button className="button button-primary" onClick={generatePlan}>ساخت / تازه‌سازی برنامه</button>} />
          ) : (
            <>
              <div className="section-heading today-section-heading"><div><h2>سه اقدام اولویت‌دار امروز</h2><p>برای هر مورد، دلیل پیشنهاد و مقصد بعدی را می‌بینی.</p></div><button className="button button-secondary" onClick={reportFallingBehind}>عقب افتاده‌ام</button></div>
              <ul className="task-list">
                {tasks.map((task) => {
                  const href = taskHref(task);
                  return (
                    <li className="task-card" key={task.id}>
                      <div className="task-card-main">
                        <strong>{task.title}</strong>
                        <span>{task.subjectCode} · حدود {toPersianDigits(task.estimatedMinutes)} دقیقه</span>
                        {task.reason && <p className="muted-copy">دلیل پیشنهاد: {task.reason}</p>}
                        {href && <Link className="text-link" href={href}>شروع این اقدام ←</Link>}
                      </div>
                      <div className="task-card-action">
                        <span className="task-status">در انتظار انجام</span>
                        <label className="field-group"><span>زمان واقعی (اختیاری)</span><input className="field-input" inputMode="numeric" placeholder="دقیقه" value={actualMinutes[task.id] ?? ""} disabled={completingTaskId === task.id} onChange={(event) => setActualMinutes((current) => ({ ...current, [task.id]: toPersianDigits(event.target.value) }))} /></label>
                        <button className="button button-primary" disabled={completingTaskId !== null} onClick={() => completeTask(task.id)}>{completingTaskId === task.id ? "در حال ثبت…" : "تکمیل شد"}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      {message && <p className="success-message" role="status">{message}</p>}
    </main>
  );
}
