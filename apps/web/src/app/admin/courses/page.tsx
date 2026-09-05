"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Course {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
}

function ModuleForm({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/courses/${courseId}/modules`, {
      method: "POST",
      body: { title, order: 1 },
    });
    setTitle("");
    onAdded();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
      <input
        placeholder="عنوان سرفصل جدید"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <button type="submit">افزودن سرفصل</button>
    </form>
  );
}

function LessonForm({ moduleId, onAdded }: { moduleId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      body: { title, order: 1, contentBlocks: [{ type: "text", text }] },
    });
    setTitle("");
    setText("");
    onAdded();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
      <input placeholder="عنوان درس" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input placeholder="متن درس" value={text} onChange={(e) => setText(e.target.value)} required />
      <button type="submit">افزودن درس</button>
    </form>
  );
}

function CoursesAdmin() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setCourses(await apiFetch<Course[]>("/admin/courses"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createCourse(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/courses", { method: "POST", body: { slug, title, description } });
    setSlug("");
    setTitle("");
    setDescription("");
    await load();
  }

  async function publish(id: string) {
    await apiFetch(`/admin/courses/${id}/publish`, { method: "POST" });
    await load();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>مدیریت دوره‌ها</h1>

      <h2>دوره جدید</h2>
      <form onSubmit={createCourse}>
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <textarea placeholder="توضیحات" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">ایجاد دوره</button>
      </form>

      <h2>همه دوره‌ها</h2>
      {courses.map((c) => (
        <div key={c.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.8rem" }}>
          <strong>{c.title}</strong> — {c.isPublished ? "منتشرشده" : "پیش‌نویس"}
          {!c.isPublished && <button onClick={() => publish(c.id)} style={{ marginInlineStart: "0.5rem" }}>انتشار</button>}
          <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} style={{ marginInlineStart: "0.5rem" }}>
            {expanded === c.id ? "بستن" : "مدیریت سرفصل‌ها"}
          </button>
          {expanded === c.id && <CourseModulesEditor courseId={c.id} />}
        </div>
      ))}
    </main>
  );
}

interface ModuleWithLessons {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
}

function CourseModulesEditor({ courseId }: { courseId: string }) {
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);

  const reload = useCallback(async () => {
    const list = await apiFetch<{ id: string; modules: ModuleWithLessons[] }[]>("/admin/courses");
    setModules(list.find((c) => c.id === courseId)?.modules ?? []);
  }, [courseId]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  return (
    <div style={{ marginTop: "0.6rem", paddingInlineStart: "1rem" }}>
      {modules.map((mod) => (
        <div key={mod.id} style={{ marginBottom: "0.6rem" }}>
          <strong>{mod.title}</strong>
          <ul>
            {mod.lessons.map((lesson) => (
              <li key={lesson.id}>{lesson.title}</li>
            ))}
          </ul>
          <LessonForm moduleId={mod.id} onAdded={reload} />
        </div>
      ))}
      <ModuleForm courseId={courseId} onAdded={reload} />
    </div>
  );
}

export default function CoursesAdminPage() {
  return (
    <AdminGuard>
      <CoursesAdmin />
    </AdminGuard>
  );
}
