"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { EmptyState, PageHeader } from "../../components/ui";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (field) params.set("field", field);
      if (degree) params.set("degree", degree);
      setPrograms(await apiFetch<Program[]>(`/programs?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت برنامه‌ها ناموفق بود");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
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
    <main className="page-container">
      <PageHeader eyebrow="انتخاب‌رشته ۳۶۰" title="دانشگاه‌ها و گرایش‌ها" description="برنامه‌های واقعی را بر اساس مقطع و گرایش جست‌وجو کن و گزینه‌های مناسب را به فهرستت اضافه کن." />
      <form className="surface-card program-filters" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <label className="field-group"><span>گرایش یا کلیدواژه</span><input className="field-input" placeholder="مثلاً هوش مصنوعی" value={field} onChange={(e) => setField(e.target.value)} /></label>
        <label className="field-group"><span>مقطع</span><select className="field-input" value={degree} onChange={(e) => setDegree(e.target.value)}>
          <option value="">همه مقاطع</option>
          <option value="master">ارشد</option>
          <option value="phd">دکتری</option>
        </select></label>
        <button className="button button-primary" type="submit" disabled={loading}>{loading ? "در حال جست‌وجو..." : "جست‌وجو"}</button>
      </form>
      {message && <p className="success-message" role="status">{message}</p>}
      {error ? <EmptyState title="نتیجه‌ای دریافت نشد" description={error} action={<button className="button button-secondary" onClick={search}>تلاش دوباره</button>} /> : programs.length === 0 ? <EmptyState title="برنامه‌ای برای نمایش نیست" description="فیلترها را تغییر بده یا بعداً دوباره جست‌وجو کن." /> : <div className="program-grid">
        {programs.map((p) => (
          <article className="catalog-card program-card" key={p.id}><div><div className="catalog-card-meta"><span>{p.degree}</span><span>{p.university.city}</span></div><h3>{p.title}</h3><p>{p.university.title}</p><p className="muted-copy">{p.tuitionType}{p.hasDormitory ? " · خوابگاه دارد" : ""}</p></div><button className="button button-secondary" onClick={() => addToChoices(p.id)}>افزودن به انتخاب‌ها</button></article>
        ))}
      </div>}
    </main>
  );
}
