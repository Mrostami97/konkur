"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { GENDER_LABEL, MAX_CHOICES, isKeyNote, noteItems, periodLabel, type ProgramGender } from "../../lib/admissions";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { EmptyState, PageHeader } from "../../components/ui";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import "../programs/admissions.css";

interface ChoiceItem {
  programId: string;
  priority: number;
  program: {
    id: string;
    code: string;
    title: string;
    orientation: string | null;
    period: string | null;
    city: string | null;
    location: string | null;
    gender: ProgramGender;
    university: { title: string; code: string };
    capacities: { examYear: number; capacity: number; selectionCode: string | null; notes: string | null }[];
  };
}

/** The latest year's booklet facts of a program. */
function latest(item: ChoiceItem) {
  const years = item.program.capacities.map((c) => c.examYear);
  const year = years.length ? Math.max(...years) : null;
  const rows = item.program.capacities.filter((c) => c.examYear === year);
  return {
    year,
    capacity: rows.reduce((sum, c) => sum + c.capacity, 0),
    selectionCode: rows.find((c) => c.selectionCode)?.selectionCode ?? null,
    notes: rows.find((c) => c.notes)?.notes ?? "",
  };
}

export default function ChoicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ChoiceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await apiFetch<ChoiceItem[]>("/me/choices"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login?next=/choices");
      else {
        setError("فهرست انتخاب‌ها در دسترس نیست؛ صفحه را دوباره باز کن.");
        setItems([]);
      }
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reorder(next: ChoiceItem[]) {
    const previous = items;
    setItems(next);
    setSaving(true);
    try {
      await apiFetch("/me/choices/reorder", { method: "POST", body: { orderedProgramIds: next.map((item) => item.programId) } });
    } catch {
      setItems(previous);
      setError("ترتیب ذخیره نشد؛ دوباره تلاش کن.");
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, target: number) {
    if (!items || target < 0 || target >= items.length || target === index) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void reorder(next);
  }

  async function remove(programId: string) {
    if (!items) return;
    const previous = items;
    setItems(items.filter((item) => item.programId !== programId));
    try {
      await apiFetch(`/me/choices/${programId}`, { method: "DELETE" });
    } catch {
      setItems(previous);
      setError("حذف انجام نشد؛ دوباره تلاش کن.");
    }
  }

  const codes = (items ?? []).map((item) => latest(item).selectionCode).filter(Boolean) as string[];

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("کپی ممکن نشد؛ کدها را از فهرست پایین صفحه بردار.");
    }
  }

  if (!items) return <main className="page-container"><div className="surface-card loading-state">در حال بارگذاری فهرست انتخاب‌ها…</div></main>;

  const years = [...new Set(items.map((item) => latest(item).year).filter(Boolean))] as number[];
  const genders = new Set(items.map((item) => item.program.gender));
  const missing = items.filter((item) => !latest(item).selectionCode);

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="انتخاب رشتهٔ ارشد"
        title="فهرست انتخاب‌های من"
        description="کدهای رشته‌محل را به ترتیب علاقه و شانس قبولی بچین. ترتیب همین فهرست، ترتیب فرم انتخاب رشته است."
      />
      {error && <div className="form-error" role="alert">{error}</div>}
      {items.length === 0 ? (
        <EmptyState
          title="هنوز کدی انتخاب نکرده‌ای"
          description="در ابزار انتخاب رشته، کدهای رشته‌محل را پیدا کن و به این فهرست اضافه کن."
          action={<Link className="button button-primary" href="/programs">رفتن به ابزار انتخاب رشته</Link>}
        />
      ) : (
        <div className="ac-stack">
          <div className="ac-tools">
            <p className="ac-count"><b>{toPersianDigits(items.length)}</b> از {toPersianDigits(MAX_CHOICES)} کد {saving && "· در حال ذخیره…"}</p>
            <Link href="/programs">افزودن کد</Link>
            <button type="button" onClick={() => window.print()}>چاپ فهرست</button>
            <button type="button" className="ac-primary" onClick={copyCodes} disabled={!codes.length}>{copied ? "کپی شد ✓" : "کپی کدها به ترتیب"}</button>
          </div>
          {years.length > 0 && (
            <p className="ac-warn">
              کدها از دفترچهٔ {toPersianDigits(years.sort().join("، "))} است. سازمان سنجش هر سال کدها را از نو شماره‌گذاری می‌کند؛ پیش از ثبت فرم، هر کد را با دفترچهٔ همان سال تطبیق بده.
            </p>
          )}
          {genders.has("FEMALE") && genders.has("MALE") && (
            <p className="ac-warn">در فهرستت هم کد «فقط زن» هست و هم کد «فقط مرد»؛ کدهایی را که برای تو نیستند حذف کن.</p>
          )}
          {missing.length > 0 && (
            <p className="ac-warn">{toPersianDigits(missing.length)} انتخاب، کد رشته‌محل ندارد؛ آن را از دفترچه پیدا کن یا حذفش کن.</p>
          )}
          <ol className="ac-list">
            {items.map((item, index) => {
              const facts = latest(item);
              const notes = noteItems(facts.notes).filter(isKeyNote).filter((note) => note !== GENDER_LABEL[item.program.gender]);
              return (
                <li className="ac-row" key={item.programId}>
                  <span className="ac-rank" aria-label={`اولویت ${index + 1}`}>{toPersianDigits(index + 1)}</span>
                  <div className="af-row-main">
                    <div className="af-row-head">
                      {facts.selectionCode && <span className="af-code">{toPersianDigits(facts.selectionCode)}</span>}
                      <Link className="af-uni" href={`/programs/${encodeURIComponent(item.program.code)}`}>{item.program.university.title}</Link>
                    </div>
                    <div className="af-tags">
                      <span className="af-tag af-tag-orientation">{item.program.orientation ?? item.program.title}</span>
                      {item.program.period && <span className="af-tag" data-period={item.program.period}>{periodLabel(item.program.period)}</span>}
                      {item.program.city && <span className="af-tag af-tag-muted">{item.program.city}{item.program.location && item.program.location !== item.program.city ? ` · ${item.program.location}` : ""}</span>}
                      {item.program.gender !== "ANY" && <span className="af-tag af-tag-key">{GENDER_LABEL[item.program.gender]}</span>}
                      {facts.capacity > 0 && <span className="af-tag af-tag-muted">ظرفیت {formatPersianNumber(facts.capacity)}</span>}
                    </div>
                    {notes.length > 0 && <p className="af-notes">{notes.map((note) => <span key={note} data-key>{note}</span>)}</p>}
                  </div>
                  <div className="ac-actions">
                    <button type="button" aria-label="انتقال به اول فهرست" title="اول فهرست" onClick={() => move(index, 0)} disabled={index === 0 || saving}>⤒</button>
                    <button type="button" aria-label="یک اولویت بالاتر" onClick={() => move(index, index - 1)} disabled={index === 0 || saving}>↑</button>
                    <button type="button" aria-label="یک اولویت پایین‌تر" onClick={() => move(index, index + 1)} disabled={index === items.length - 1 || saving}>↓</button>
                    <button type="button" className="ac-remove" aria-label="حذف از فهرست" onClick={() => remove(item.programId)} disabled={saving}>✕</button>
                  </div>
                </li>
              );
            })}
          </ol>
          {codes.length > 0 && (
            <section aria-labelledby="codes-title">
              <h2 id="codes-title" className="ac-codes-title">کدها به ترتیب، برای فرم انتخاب رشته</h2>
              <pre className="ac-codes">{codes.map((code, i) => `${String(i + 1).padStart(3, " ")}.  ${code}`).join("\n")}</pre>
            </section>
          )}
        </div>
      )}
      <AdmissionsJourney current="choices" />
    </main>
  );
}
