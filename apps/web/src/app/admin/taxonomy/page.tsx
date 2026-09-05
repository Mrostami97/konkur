"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Subject {
  code: string;
  title: string;
}

interface Topic {
  code: string;
  title: string;
  subject: Subject;
}

function TaxonomyAdmin() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectTitle, setSubjectTitle] = useState("");
  const [topicCode, setTopicCode] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [topicSubjectCode, setTopicSubjectCode] = useState("");

  async function load() {
    setSubjects(await apiFetch<Subject[]>("/subjects"));
    setTopics(await apiFetch<Topic[]>("/topics"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createSubject(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/subjects", { method: "POST", body: { code: subjectCode, title: subjectTitle } });
    setSubjectCode("");
    setSubjectTitle("");
    await load();
  }

  async function createTopic(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/topics", {
      method: "POST",
      body: { code: topicCode, title: topicTitle, subjectCode: topicSubjectCode },
    });
    setTopicCode("");
    setTopicTitle("");
    await load();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>طبقه‌بندی موضوعی (Taxonomy)</h1>

      <h2>درس جدید</h2>
      <form onSubmit={createSubject} style={{ display: "flex", gap: "0.5rem" }}>
        <input placeholder="code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} required />
        <input placeholder="عنوان" value={subjectTitle} onChange={(e) => setSubjectTitle(e.target.value)} required />
        <button type="submit">ایجاد</button>
      </form>
      <ul>
        {subjects.map((s) => (
          <li key={s.code}>
            {s.title} ({s.code})
          </li>
        ))}
      </ul>

      <h2>مبحث جدید</h2>
      <form onSubmit={createTopic} style={{ display: "flex", gap: "0.5rem" }}>
        <input placeholder="code" value={topicCode} onChange={(e) => setTopicCode(e.target.value)} required />
        <input placeholder="عنوان" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} required />
        <select value={topicSubjectCode} onChange={(e) => setTopicSubjectCode(e.target.value)} required>
          <option value="">درس را انتخاب کنید</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.title}
            </option>
          ))}
        </select>
        <button type="submit">ایجاد</button>
      </form>
      <ul>
        {topics.map((t) => (
          <li key={t.code}>
            {t.title} ({t.code}) — {t.subject.title}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function TaxonomyAdminPage() {
  return (
    <AdminGuard>
      <TaxonomyAdmin />
    </AdminGuard>
  );
}
