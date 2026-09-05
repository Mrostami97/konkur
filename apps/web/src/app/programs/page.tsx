"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

interface Program {
  id: string;
  code: string;
  title: string;
  degree: string;
  field: string;
  tuitionType: string;
  hasDormitory: boolean;
  university: { title: string; city: string };
}

export default function ProgramsPage() {
  const [field, setField] = useState("");
  const [degree, setDegree] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    const params = new URLSearchParams();
    if (field) params.set("field", field);
    if (degree) params.set("degree", degree);
    setPrograms(await apiFetch<Program[]>(`/programs?${params.toString()}`));
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addToChoices(programId: string) {
    setMessage(null);
    try {
      await apiFetch("/me/choices", { method: "POST", body: { programId } });
      setMessage("به فهرست انتخاب‌ها افزوده شد.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMessage("ابتدا وارد شوید.");
      else setMessage("افزودن ناموفق بود.");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>دانشگاه‌ها و گرایش‌ها</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input placeholder="گرایش" value={field} onChange={(e) => setField(e.target.value)} />
        <select value={degree} onChange={(e) => setDegree(e.target.value)}>
          <option value="">همه مقاطع</option>
          <option value="master">ارشد</option>
          <option value="phd">دکتری</option>
        </select>
        <button onClick={search}>جست‌وجو</button>
      </div>
      {message && <p style={{ color: "green" }}>{message}</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {programs.map((p) => (
          <li key={p.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.6rem" }}>
            <strong>{p.title}</strong> — {p.university.title} ({p.university.city})
            <p style={{ fontSize: "0.85rem", color: "#486581" }}>
              {p.degree} — {p.tuitionType} {p.hasDormitory ? "— خوابگاه دارد" : ""}
            </p>
            <button onClick={() => addToChoices(p.id)}>افزودن به انتخاب‌ها</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
