"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";

interface ChoiceComparison {
  priority: number;
  program: { id: string; title: string; university: { title: string } };
  chance: number | null;
  sampleSize: number;
}

export default function ChoicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ChoiceComparison[] | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await apiFetch<ChoiceComparison[]>("/me/choices/compare"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
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

  if (!items) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>مقایسه و اولویت انتخاب‌رشته</h1>
      {items.length === 0 ? (
        <p>هنوز رشته‌ای به فهرست انتخاب‌ها اضافه نکرده‌اید.</p>
      ) : (
        <ol>
          {items.map((item, index) => (
            <li key={item.program.id} style={{ border: "1px solid #D7E2EA", borderRadius: 6, padding: "0.8rem", marginBottom: "0.6rem" }}>
              <strong>{item.program.title}</strong> — {item.program.university.title}
              <p>
                {item.chance === null
                  ? `شانس قبولی: داده کافی نیست (نمونه: ${item.sampleSize})`
                  : `شانس قبولی تجربی: ${(item.chance * 100).toFixed(0)}٪ (بر اساس ${item.sampleSize} کارنامه مشابه)`}
              </p>
              <button onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </button>
              <button onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                ↓
              </button>
              <button onClick={() => remove(item.program.id)}>حذف</button>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
