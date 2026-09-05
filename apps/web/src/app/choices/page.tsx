"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { EmptyState, PageHeader } from "../../components/ui";

interface ChoiceComparison {
  priority: number;
  program: { id: string; title: string; university: { title: string } };
  chance: number | null;
  sampleSize: number;
}

export default function ChoicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ChoiceComparison[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await apiFetch<ChoiceComparison[]>("/me/choices/compare"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
      else setError("فهرست انتخاب‌ها در دسترس نیست.");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await apiFetch("/me/choices/reorder", {
      method: "POST",
      body: { orderedProgramIds: reordered.map((i) => i.program.id) },
    });
    await load();
  }

  async function remove(programId: string) {
    await apiFetch(`/me/choices/${programId}`, { method: "DELETE" });
    await load();
  }

  if (!items) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری انتخاب‌ها...</div></main>;

  return (
    <main className="page-container">
      <PageHeader eyebrow="انتخاب‌رشته ۳۶۰" title="مقایسه و اولویت انتخاب‌رشته" description="اولویت‌هایت را مرتب کن و دادهٔ مقایسه‌ای هر گزینه را با احتیاط بخوان." />
      {error && <div className="form-error" role="alert">{error}</div>}
      {items.length === 0 ? (
        <EmptyState title="هنوز انتخابی ثبت نشده است" description="از فهرست دانشگاه‌ها، گزینه‌های مناسب را به این صفحه اضافه کن." action={<Link className="button button-primary" href="/programs">جست‌وجوی دانشگاه‌ها</Link>} />
      ) : (
        <ol className="choice-list">
          {items.map((item, index) => (
            <li className="surface-card choice-card" key={item.program.id}>
              <div><span className="choice-rank">اولویت {index + 1}</span><h2>{item.program.title}</h2><p className="muted-copy">{item.program.university.title}</p></div>
              <p className="choice-chance">
                {item.chance === null
                  ? `شانس قبولی: داده کافی نیست (نمونه: ${item.sampleSize})`
                  : `شانس قبولی تجربی: ${(item.chance * 100).toFixed(0)}٪ (بر اساس ${item.sampleSize} کارنامه مشابه)`}
              </p>
              <div className="choice-actions"><button className="button button-secondary" aria-label="انتقال به بالا" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </button><button className="button button-secondary" aria-label="انتقال به پایین" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                ↓
              </button><button className="button button-danger" onClick={() => remove(item.program.id)}>حذف</button></div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
