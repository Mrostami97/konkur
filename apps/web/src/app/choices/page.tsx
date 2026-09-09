"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader } from "../../components/ui";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";

interface ChanceInterval {
  low: number;
  high: number;
  level: number;
  method?: "WILSON_SCORE";
}

interface ChoiceComparison {
  priority: number;
  program: { id: string; code?: string; title: string; university: { title: string } };
  chance: number | null;
  sampleSize: number;
  minimumSampleSize?: number;
  dataYears?: number[];
  interval?: ChanceInterval | null;
  methodology?: string;
  limitations?: string[];
  reason?: string | null;
  error?: string;
}

function percent(value: number): string {
  return toPersianDigits(Math.round(value * 100));
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
      else {
        setError("فهرست انتخاب‌ها در دسترس نیست.");
        setItems([]);
      }
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
              <div>
                <span className="choice-rank">اولویت {toPersianDigits(index + 1)}</span>
                <h2>{item.program.title}</h2>
                <p className="muted-copy">{item.program.university.title}</p>
                {item.program.code && <Link className="text-link" href={`/programs/${item.program.code}`}>جزئیات برنامه و منبع رسمی ←</Link>}
              </div>
              <div className="choice-chance">
                {item.chance === null ? (
                  <>
                    <strong>برای برآورد، دادهٔ کافی نیست.</strong>
                    <p>
                      نمونهٔ فعلی: {toPersianDigits(item.sampleSize)} کارنامه؛ حداقل لازم: {toPersianDigits(item.minimumSampleSize ?? 5)} کارنامه.
                    </p>
                    <p className="muted-copy">
                      {item.error
                        ? "ابتدا یک تخمین رتبهٔ سازگار با رشته و مقطع این برنامه ثبت کن."
                        : item.reason ?? "تا رسیدن نمونه به حداقل لازم، درصد قبولی نمایش داده نمی‌شود."}
                    </p>
                    {item.error && <Link className="text-link" href="/rank-estimate">ساخت تخمین رتبه ←</Link>}
                  </>
                ) : (
                  <>
                    <strong>نرخ قبولی ثبت‌شده در نمونه: {percent(item.chance)}٪</strong>
                    <p>بر اساس {toPersianDigits(item.sampleSize)} کارنامهٔ قابل مقایسه</p>
                    {item.interval && (
                      <p>
                        بازهٔ ویلسون {percent(item.interval.level)}٪ برای نرخ نمونه: {percent(item.interval.low)}٪ تا {percent(item.interval.high)}٪
                      </p>
                    )}
                  </>
                )}
                <p>
                  سال‌های داده: {item.dataYears && item.dataYears.length > 0
                    ? toPersianDigits([...item.dataYears].sort((a, b) => a - b).join("، "))
                    : "دادهٔ سالانه در دسترس نیست"}
                </p>
                {item.limitations?.map((limitation) => <p className="muted-copy" key={limitation}>{limitation}</p>)}
              </div>
              <div className="choice-actions"><button className="button button-secondary" aria-label="انتقال به بالا" onClick={() => move(index, -1)} disabled={index === 0}>
                ↑
              </button><button className="button button-secondary" aria-label="انتقال به پایین" onClick={() => move(index, 1)} disabled={index === items.length - 1}>
                ↓
              </button><button className="button button-danger" onClick={() => remove(item.program.id)}>حذف</button></div>
            </li>
          ))}
        </ol>
      )}
      <div className="surface-card surface-card-muted analysis-note">
        <p><strong>شیوهٔ خواندن این درصدها:</strong> نرخ نمایش‌داده‌شده فقط نتیجهٔ کارنامه‌های تاریخیِ قابل مقایسه است.</p>
        <p>بازهٔ آماری، عدم‌قطعیت نمونه را نشان می‌دهد و پیش‌بینی قطعی یا تضمین قبولی نیست.</p>
      </div>
      <AdmissionsJourney current="choices" />
    </main>
  );
}
