"use client";

import { useMemo, useState } from "react";
import { subjects } from "../../../content/editorial";
import { apiFetch, ApiError } from "../../../lib/api";
import {
  addDays,
  COACH_KINDS,
  dayLabel,
  daysBetween,
  isoDay,
  tehranToday,
  weekStart,
  type CoachPlan,
  type CoachTaskKind,
} from "../../../lib/coach";
import { toEnglishDigits } from "../../../lib/format";
import { Alert, Button, Card, Input, Select, Textarea } from "../../../components/ds";

interface DraftItem {
  key: string;
  id?: string;
  day: string;
  kind: CoachTaskKind;
  title: string;
  subjectSlug: string;
  targetMinutes: string;
  targetCount: string;
  href: string;
  note: string;
}

export interface PlanDraft {
  planId?: string;
  title: string;
  startsOn: string;
  endsOn: string;
  note: string;
  items: DraftItem[];
}

let counter = 0;
const nextKey = () => `k${++counter}`;

/** A blank one-week plan starting next Saturday (or this one, if today is Saturday). */
export function blankDraft(): PlanDraft {
  const today = tehranToday();
  const start = weekStart(today) === today ? today : addDays(weekStart(today), 7);
  return { title: "برنامهٔ هفتگی", startsOn: start, endsOn: addDays(start, 6), note: "", items: [] };
}

/** An existing plan, for editing -- or copied forward by `shiftDays` as next week's draft. */
export function draftFromPlan(plan: CoachPlan, shiftDays = 0): PlanDraft {
  return {
    planId: shiftDays ? undefined : plan.id,
    title: plan.title,
    startsOn: addDays(isoDay(plan.startsOn), shiftDays),
    endsOn: addDays(isoDay(plan.endsOn), shiftDays),
    note: plan.note ?? "",
    items: plan.items.map((item) => ({
      key: nextKey(),
      id: shiftDays ? undefined : item.id,
      day: addDays(isoDay(item.day), shiftDays),
      kind: item.kind,
      title: item.title,
      subjectSlug: item.subjectSlug ?? "",
      targetMinutes: item.targetMinutes ? String(item.targetMinutes) : "",
      targetCount: item.targetCount ? String(item.targetCount) : "",
      href: item.href ?? "",
      note: item.note ?? "",
    })),
  };
}

function wholeNumber(value: string) {
  const parsed = Number(toEnglishDigits(value.trim()));
  return value.trim() && Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * The consultant's weekly plan builder: one section per day, tasks added in
 * place. Saving keeps tasks' ids, so a task the student already ticked stays
 * ticked when the consultant edits its wording or moves it.
 */
export function PlanEditor({
  studentId,
  initial,
  onSaved,
  onCancel,
}: {
  studentId: string;
  initial: PlanDraft;
  onSaved: (plan: CoachPlan) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(initial);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => daysBetween(draft.startsOn, draft.endsOn), [draft.startsOn, draft.endsOn]);

  const update = (patch: Partial<PlanDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft((current) => ({ ...current, items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }));
  const removeItem = (key: string) => setDraft((current) => ({ ...current, items: current.items.filter((item) => item.key !== key) }));
  const addItem = (day: string, kind: CoachTaskKind = "STUDY") =>
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        { key: nextKey(), day, kind, title: "", subjectSlug: "", targetMinutes: "", targetCount: "", href: "", note: "" },
      ],
    }));
  const copyDay = (from: string, to: string) =>
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        ...current.items.filter((item) => item.day === from).map((item) => ({ ...item, key: nextKey(), id: undefined, day: to })),
      ],
    }));

  function moveStart(start: string) {
    const length = Math.max(0, daysBetween(draft.startsOn, draft.endsOn).length - 1);
    const shift = Math.round((new Date(`${start}T00:00:00Z`).getTime() - new Date(`${draft.startsOn}T00:00:00Z`).getTime()) / 86_400_000);
    setDraft((current) => ({
      ...current,
      startsOn: start,
      endsOn: addDays(start, length),
      items: current.items.map((item) => ({ ...item, day: addDays(item.day, shift) })),
    }));
  }

  function validate() {
    if (draft.title.trim().length < 2) return "عنوان برنامه را بنویسید.";
    if (draft.endsOn < draft.startsOn) return "تاریخ پایان نمی‌تواند قبل از شروع باشد.";
    if (days.length > 32) return "یک برنامه حداکثر یک ماه را پوشش می‌دهد.";
    for (const item of draft.items) {
      if (item.title.trim().length < 2) return "همهٔ کارها باید عنوان داشته باشند.";
      if (item.href && (!item.href.startsWith("/") || item.href.startsWith("//"))) {
        return `پیوند «${item.title}» باید مسیری در همین سایت باشد، مثل ‎/lessons/…`;
      }
      const minutes = wholeNumber(item.targetMinutes);
      if (item.targetMinutes && (minutes === undefined || minutes < 1 || minutes > 900)) return `زمان «${item.title}» باید بین ۱ و ۹۰۰ دقیقه باشد.`;
      const count = wholeNumber(item.targetCount);
      if (item.targetCount && (count === undefined || count < 1 || count > 1000)) return `تعداد «${item.title}» معتبر نیست.`;
    }
    return null;
  }

  async function save(publish: boolean) {
    const problem = validate();
    setError(problem);
    if (problem) return;
    setBusy(publish ? "publish" : "save");
    const body = {
      title: draft.title.trim(),
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      items: draft.items
        .filter((item) => days.includes(item.day))
        .sort((left, right) => left.day.localeCompare(right.day))
        .map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          day: item.day,
          kind: item.kind,
          title: item.title.trim(),
          ...(item.subjectSlug ? { subjectSlug: item.subjectSlug } : {}),
          ...(wholeNumber(item.targetMinutes) ? { targetMinutes: wholeNumber(item.targetMinutes) } : {}),
          ...(wholeNumber(item.targetCount) ? { targetCount: wholeNumber(item.targetCount) } : {}),
          ...(item.href.trim() ? { href: item.href.trim() } : {}),
          ...(item.note.trim() ? { note: item.note.trim() } : {}),
        })),
    };
    try {
      let plan = draft.planId
        ? await apiFetch<CoachPlan>(`/me/instructor/plans/${draft.planId}`, { method: "PUT", body })
        : await apiFetch<CoachPlan>(`/me/instructor/students/${studentId}/plans`, { method: "POST", body });
      if (publish && plan.status !== "PUBLISHED") {
        plan = await apiFetch<CoachPlan>(`/me/instructor/plans/${plan.id}/publish`, { method: "POST" });
      }
      onSaved(plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ذخیرهٔ برنامه ممکن نشد.");
    } finally {
      setBusy(null);
    }
  }

  const thisWeek = weekStart(tehranToday());

  return (
    <Card>
      <div className="ds-stack">
        <div className="pb-meta">
          <label className="pb-field pb-field-wide">
            <span>عنوان برنامه</span>
            <Input value={draft.title} onChange={(e) => update({ title: e.target.value })} maxLength={120} />
          </label>
          <label className="pb-field">
            <span>شروع هفته</span>
            <Select value={draft.startsOn} onChange={(e) => moveStart(e.target.value)}>
              {[0, 7, 14, 21].map((offset) => {
                const start = addDays(thisWeek, offset);
                return (
                  <option key={start} value={start}>
                    {offset === 0 ? "این هفته" : offset === 7 ? "هفتهٔ بعد" : `${offset / 7} هفته بعد`} — {dayLabel(start, { day: "numeric", month: "long" })}
                  </option>
                );
              })}
              {![0, 7, 14, 21].some((offset) => addDays(thisWeek, offset) === draft.startsOn) && (
                <option value={draft.startsOn}>{dayLabel(draft.startsOn, { day: "numeric", month: "long", year: "numeric" })}</option>
              )}
            </Select>
          </label>
          <label className="pb-field">
            <span>طول برنامه</span>
            <Select
              value={String(daysBetween(draft.startsOn, draft.endsOn).length)}
              onChange={(e) => update({ endsOn: addDays(draft.startsOn, Number(e.target.value) - 1) })}
            >
              <option value="7">یک هفته</option>
              <option value="14">دو هفته</option>
              <option value="3">سه روز</option>
              {![3, 7, 14].includes(days.length) && (
                <option value={String(days.length)}>{days.length.toLocaleString("fa-IR")} روز</option>
              )}
            </Select>
          </label>
        </div>

        <label className="pb-field">
          <span>پیام شما به دانشجو (اختیاری)</span>
          <Textarea
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
            rows={2}
            maxLength={1000}
            placeholder="مثلاً: این هفته تمرکز روی ساختمان داده؛ تست‌ها را زمان‌دار بزن."
          />
        </label>

        <div className="pb-days">
          {days.map((day, index) => {
            const items = draft.items.filter((item) => item.day === day);
            return (
              <section className="pb-day" key={day}>
                <header className="pb-day-head">
                  <strong>{dayLabel(day)}</strong>
                  <div className="ds-row" style={{ gap: "var(--sp-1)" }}>
                    {index > 0 && draft.items.some((item) => item.day === days[index - 1]) && (
                      <button type="button" className="pb-link" onClick={() => copyDay(days[index - 1], day)}>
                        تکرار روز قبل
                      </button>
                    )}
                    <button type="button" className="pb-link pb-link-add" onClick={() => addItem(day)}>
                      + کار
                    </button>
                  </div>
                </header>
                {items.length === 0 ? (
                  <p className="pb-empty">کاری برای این روز نیست.</p>
                ) : (
                  <ul className="pb-items">
                    {items.map((item) => (
                      <li key={item.key} className={`pb-item pb-tone-${COACH_KINDS[item.kind].tone}`}>
                        <div className="pb-item-row">
                          <Select value={item.kind} onChange={(e) => updateItem(item.key, { kind: e.target.value as CoachTaskKind })} aria-label="نوع کار">
                            {Object.entries(COACH_KINDS).map(([value, kind]) => (
                              <option key={value} value={value}>{kind.label}</option>
                            ))}
                          </Select>
                          <Input
                            value={item.title}
                            onChange={(e) => updateItem(item.key, { title: e.target.value })}
                            placeholder="مثلاً: فصل ۳ درخت‌ها + ۳۰ تست"
                            aria-label="عنوان کار"
                            maxLength={160}
                          />
                          <button type="button" className="pb-remove" onClick={() => removeItem(item.key)} aria-label="حذف کار">×</button>
                        </div>
                        <div className="pb-item-row pb-item-extra">
                          <Select value={item.subjectSlug} onChange={(e) => updateItem(item.key, { subjectSlug: e.target.value })} aria-label="درس">
                            <option value="">درس (اختیاری)</option>
                            {subjects.map((subject) => (
                              <option key={subject.slug} value={subject.slug}>{subject.shortTitle}</option>
                            ))}
                          </Select>
                          <Input
                            value={item.targetMinutes}
                            onChange={(e) => updateItem(item.key, { targetMinutes: e.target.value })}
                            placeholder="دقیقه"
                            inputMode="numeric"
                            aria-label="زمان هدف به دقیقه"
                          />
                          <Input
                            value={item.targetCount}
                            onChange={(e) => updateItem(item.key, { targetCount: e.target.value })}
                            placeholder="تعداد تست"
                            inputMode="numeric"
                            aria-label="تعداد"
                          />
                          <Input
                            value={item.href}
                            onChange={(e) => updateItem(item.key, { href: e.target.value })}
                            placeholder="/lessons/… (اختیاری)"
                            dir="ltr"
                            aria-label="پیوند در همین سایت"
                          />
                        </div>
                        <Input
                          value={item.note}
                          onChange={(e) => updateItem(item.key, { note: e.target.value })}
                          placeholder="توضیح برای دانشجو (اختیاری)"
                          aria-label="توضیح"
                          maxLength={500}
                        />
                        {item.id && <small className="pb-kept">این کار قبلاً منتشر شده؛ اگر دانشجو تیکش زده باشد، حفظ می‌شود.</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="pb-actions">
          <span className="ds-subtitle">
            {draft.items.length.toLocaleString("fa-IR")} کار در {days.length.toLocaleString("fa-IR")} روز
          </span>
          <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
            <Button type="button" onClick={onCancel} disabled={busy !== null}>انصراف</Button>
            <Button type="button" onClick={() => void save(false)} loading={busy === "save"} disabled={busy !== null}>
              ذخیره
            </Button>
            <Button type="button" variant="primary" onClick={() => void save(true)} loading={busy === "publish"} disabled={busy !== null}>
              ذخیره و ارسال برای دانشجو
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
