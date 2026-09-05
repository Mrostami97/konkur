"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

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

function GoalForm({ onSaved }: { onSaved: () => void }) {
  const [degree, setDegree] = useState<"MASTER" | "PHD">("MASTER");
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
    <div style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "1rem" }}>
      <p>برای دریافت برنامه مطالعه، ابتدا هدف خود را ثبت کنید.</p>
      <form onSubmit={submit}>
        <select value={degree} onChange={(e) => setDegree(e.target.value as "MASTER" | "PHD")} style={{ marginBottom: "0.4rem" }}>
          <option value="MASTER">ارشد</option>
          <option value="PHD">دکتری</option>
        </select>
        <input placeholder="گرایش" value={field} onChange={(e) => setField(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="ساعت مطالعه در هفته" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">ثبت هدف و ساخت برنامه</button>
      </form>
    </div>
  );
}

export default function TodayPage() {
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [goalRes, todayRes] = await Promise.all([
        apiFetch<Goal | null>("/me/goal"),
        apiFetch<{ tasks: Task[] }>("/me/plan/today").catch(() => ({ tasks: [] })),
      ]);
      setGoal(goalRes);
      setTasks(todayRes.tasks);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
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

  if (goal === undefined || tasks === null) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>امروز</h1>

      {!goal ? (
        <GoalForm onSaved={load} />
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "#486581" }}>
            هدف: {goal.degree === "MASTER" ? "ارشد" : "دکتری"} — {goal.field} — {goal.weeklyHours} ساعت در هفته
          </p>

          {tasks.length === 0 ? (
            <div>
              <p>برنامه‌ای فعال ندارید یا کار امروزی باقی نمانده است.</p>
              <button onClick={generatePlan}>ساخت / تازه‌سازی برنامه</button>
            </div>
          ) : (
            <>
              <h2>سه کار اولویت‌دار امروز</h2>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {tasks.map((task) => (
                  <li key={task.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.6rem" }}>
                    <strong>{task.title}</strong>
                    <p style={{ fontSize: "0.85rem", color: "#486581" }}>
                      {task.subjectCode} — حدود {task.estimatedMinutes} دقیقه
                    </p>
                    {task.topicCode && (
                      <Link href={`/questions?subjectCode=${task.subjectCode}`}>مشاهده سؤالات مرتبط</Link>
                    )}
                    <div>
                      <button onClick={() => completeTask(task.id)}>تکمیل شد</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button onClick={reportFallingBehind}>عقب افتاده‌ام — بازبرنامه‌ریزی کن</button>
            </>
          )}
        </>
      )}
      {message && <p style={{ color: "green" }}>{message}</p>}
    </main>
  );
}
