"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { EmptyState, PageHeader, ProgressBar, StatCard } from "../../components/ui";

interface Goal {
  degree: "MASTER" | "PHD";
  field: string;
  weeklyHours: number;
}

interface Task {
  id: string;
  title: string;
  subjectCode: string;
  topicCode: string | null;
  estimatedMinutes: number;
  status: string;
}

function GoalForm({ onSaved, initialDegree }: { onSaved: () => void; initialDegree: "MASTER" | "PHD" }) {
  const [degree, setDegree] = useState<"MASTER" | "PHD">(initialDegree);
  const [field, setField] = useState("computer-engineering");
  const [weeklyHours, setWeeklyHours] = useState("10");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/me/goal", {
      method: "PUT",
      body: { degree, field, weeklyHours: Number(weeklyHours) },
    });
    onSaved();
  }

  return (
    <div className="surface-card goal-form-card">
      <span className="eyebrow">شروع سریع</span>
      <h2>هدف تحصیلی‌ات را ثبت کن</h2>
      <p>با چند اطلاعات ساده، برنامهٔ امروزت را متناسب با زمانت بساز.</p>
      <form className="field-grid" onSubmit={submit}>
        <label className="field-group"><span>مقطع</span><select className="field-input" value={degree} onChange={(e) => setDegree(e.target.value as "MASTER" | "PHD")}>
          <option value="MASTER">ارشد</option>
          <option value="PHD">دکتری</option>
        </select></label>
        <label className="field-group"><span>گرایش</span><input className="field-input" placeholder="مثلاً مهندسی کامپیوتر" value={field} onChange={(e) => setField(e.target.value)} required /></label>
        <label className="field-group"><span>ساعت مطالعه در هفته</span><input className="field-input" inputMode="numeric" placeholder="۱۰" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} required /></label>
        <button className="button button-primary" type="submit">ثبت هدف و ساخت برنامه</button>
      </form>
    </div>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const [queryDegree, setQueryDegree] = useState<"MASTER" | "PHD">("MASTER");
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setQueryDegree(new URLSearchParams(window.location.search).get("degree") === "PHD" ? "PHD" : "MASTER");
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const [goalRes, todayRes] = await Promise.all([
        apiFetch<Goal | null>("/me/goal"),
        apiFetch<{ tasks: Task[] }>("/me/plan/today").catch(() => ({ tasks: [] })),
      ]);
      setGoal(goalRes);
      setTasks(todayRes.tasks);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
      else setLoadError("برای نمایش برنامه، اتصال به حساب کاربری برقرار نشد.");
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
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ساخت برنامه ناموفق بود");
    }
  }

  async function reportFallingBehind() {
    setMessage(null);
    try {
      const res = await apiFetch<{ tasks: Task[] }>("/me/plan/replan", {
        method: "POST",
        body: { reasonCode: "FALLING_BEHIND", note: "دانشجو اعلام عقب‌افتادگی کرد" },
      });
      setTasks(res.tasks.filter((t) => t.status === "PENDING").slice(0, 3));
      setMessage("کارهای عقب‌افتاده به امروز منتقل شد.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "بازبرنامه‌ریزی ناموفق بود");
    }
  }

  async function completeTask(taskId: string) {
    await apiFetch(`/me/plan/tasks/${taskId}/complete`, { method: "POST" });
    setTasks((prev) => (prev ? prev.filter((t) => t.id !== taskId) : prev));
  }

  if (goal === undefined || tasks === null) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری برنامهٔ امروز...</div></main>;

  return (
    <main className="page-container">
      <PageHeader eyebrow="داشبورد داوطلب" title="امروز" description="هر روز با یک قدم مشخص، به هدف ارشد یا دکتری کامپیوتر نزدیک‌تر شو." action={<div className="degree-switcher"><Link className={queryDegree === "MASTER" ? "active" : ""} href="/today?degree=MASTER">ارشد</Link><Link className={queryDegree === "PHD" ? "active" : ""} href="/today?degree=PHD">دکتری</Link></div>} />

      {loadError && <div className="form-error" role="alert">{loadError}</div>}

      {!goal ? (
        <GoalForm initialDegree={queryDegree} onSaved={load} />
      ) : (
        <>
          <section className="content-grid">
            <div className="surface-card">
              <span className="eyebrow">هدف فعلی</span>
              <h2>{goal.degree === "MASTER" ? "کنکور ارشد" : "کنکور دکتری"} کامپیوتر</h2>
              <p className="muted-copy">{goal.field} · {goal.weeklyHours} ساعت مطالعه در هفته</p>
              <ProgressBar value={tasks.length ? 100 : 0} label={tasks.length ? "برنامهٔ امروز آماده است" : "برنامهٔ امروز هنوز ساخته نشده"} />
            </div>
            <div className="stats-grid stats-grid-single">
              <StatCard label="کارهای امروز" value={tasks.length.toLocaleString("fa-IR")} detail="از برنامهٔ فعلی" tone="teal" />
              <StatCard label="زمان پیشنهادی" value={`${tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0).toLocaleString("fa-IR")} دقیقه`} detail="برآورد مطالعه" tone="blue" />
            </div>
          </section>

          {tasks.length === 0 ? (
            <EmptyState title="برای امروز کاری باقی نمانده است" description="اگر برنامه‌ات هنوز ساخته نشده یا می‌خواهی آن را تازه کنی، از دکمهٔ زیر شروع کن." action={<button className="button button-primary" onClick={generatePlan}>ساخت / تازه‌سازی برنامه</button>} />
          ) : (
            <>
              <div className="section-heading today-section-heading"><div><h2>کارهای اولویت‌دار امروز</h2><p>با تکمیل هر کار، مسیرت را به‌روز نگه دار.</p></div><button className="button button-secondary" onClick={reportFallingBehind}>عقب افتاده‌ام</button></div>
              <ul className="task-list">
                {tasks.map((task) => (
                  <li className="task-card" key={task.id}>
                    <div className="task-card-main"><strong>{task.title}</strong><span>{task.subjectCode} · حدود {task.estimatedMinutes} دقیقه</span>{task.topicCode && <Link className="text-link" href={`/questions?subjectCode=${task.subjectCode}`}>مشاهده سؤالات مرتبط ←</Link>}</div>
                    <div className="task-card-action"><span className="task-status">{task.status === "PENDING" ? "در انتظار انجام" : task.status}</span><button className="button button-primary" onClick={() => completeTask(task.id)}>تکمیل شد</button></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {message && <p className="success-message" role="status">{message}</p>}
    </main>
  );
}
