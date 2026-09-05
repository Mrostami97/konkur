"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Exam {
  id: string;
  slug: string;
  title: string;
  mode: "STATIC" | "DYNAMIC";
  isPublished: boolean;
  forms: { _count: { items: number } }[];
}

function ExamItemForm({ examId, onAdded }: { examId: string; onAdded: () => void }) {
  const [questionId, setQuestionId] = useState("");
  const [order, setOrder] = useState("0");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/exams/${examId}/items`, {
      method: "POST",
      body: { questionId, order: Number(order) },
    });
    setQuestionId("");
    onAdded();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
      <input placeholder="questionId" value={questionId} onChange={(e) => setQuestionId(e.target.value)} required />
      <input placeholder="ترتیب" value={order} onChange={(e) => setOrder(e.target.value)} style={{ width: "4rem" }} />
      <button type="submit">افزودن سؤال</button>
    </form>
  );
}

function Psychometrics({ examId }: { examId: string }) {
  const [data, setData] = useState<any>(null);

  async function load() {
    setData(await apiFetch(`/admin/exams/${examId}/psychometrics`));
  }

  return (
    <details style={{ marginTop: "0.4rem" }}>
      <summary onClick={load}>روان‌سنجی</summary>
      {data && (
        <div style={{ fontSize: "0.85rem" }}>
          <p>تعداد آزمون‌های ثبت‌شده: {data.attemptCount}</p>
          <ul>
            {data.items.map((item: any) => (
              <li key={item.questionId}>
                {item.questionId.slice(0, 8)}… — دشواری: {item.difficulty.toFixed(2)} — تمایز: {item.discrimination.toFixed(2)} (n={item.sampleSize})
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

function ExamsAdmin() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"STATIC" | "DYNAMIC">("STATIC");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [subjectCode, setSubjectCode] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setExams(await apiFetch<Exam[]>("/admin/exams"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createExam(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/exams", {
      method: "POST",
      body: {
        slug,
        title,
        description,
        mode,
        durationMinutes: Number(durationMinutes),
        ...(mode === "DYNAMIC" ? { subjectCode, questionCount: Number(questionCount) } : {}),
      },
    });
    setSlug("");
    setTitle("");
    setDescription("");
    await load();
  }

  async function publish(id: string) {
    await apiFetch(`/admin/exams/${id}/publish`, { method: "POST" });
    await load();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>مدیریت آزمون‌ها</h1>

      <h2>آزمون جدید</h2>
      <form onSubmit={createExam}>
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <textarea placeholder="توضیحات" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <select value={mode} onChange={(e) => setMode(e.target.value as "STATIC" | "DYNAMIC")} style={{ display: "block", marginBottom: "0.4rem" }}>
          <option value="STATIC">ثابت (سؤالات دستی)</option>
          <option value="DYNAMIC">پویا (تصادفی از یک درس)</option>
        </select>
        <input placeholder="مدت (دقیقه)" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        {mode === "DYNAMIC" && (
          <>
            <input placeholder="subject_code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
            <input placeholder="تعداد سؤال" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
          </>
        )}
        <button type="submit">ایجاد آزمون</button>
      </form>

      <h2>همه آزمون‌ها</h2>
      {exams.map((exam) => (
        <div key={exam.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.8rem" }}>
          <strong>{exam.title}</strong> — {exam.mode} — {exam.isPublished ? "منتشرشده" : "پیش‌نویس"}
          {!exam.isPublished && <button onClick={() => publish(exam.id)} style={{ marginInlineStart: "0.5rem" }}>انتشار</button>}
          <button onClick={() => setExpanded(expanded === exam.id ? null : exam.id)} style={{ marginInlineStart: "0.5rem" }}>
            {expanded === exam.id ? "بستن" : "مدیریت"}
          </button>
          {expanded === exam.id && (
            <div>
              {exam.mode === "STATIC" && <ExamItemForm examId={exam.id} onAdded={load} />}
              <Psychometrics examId={exam.id} />
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

export default function ExamsAdminPage() {
  return (
    <AdminGuard>
      <ExamsAdmin />
    </AdminGuard>
  );
}
