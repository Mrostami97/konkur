"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../../lib/api";
import { EXAM_SETS, GENDER_LABEL, MAX_CHOICES, PERIODS, groupLabel, isKeyNote, noteItems, periodLabel, type ProgramGender, type StudyPeriod } from "../../lib/admissions";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";

export interface CatalogRow {
  id: string;
  code: string;
  set: string;
  group: number;
  orientation: string;
  period: StudyPeriod;
  university: string;
  universityCode: string;
  city: string;
  location: string;
  gender: ProgramGender;
  capacity: number;
  selectionCode: string;
  notes: string;
}

export interface FinderFilters {
  set: string;
  group: string;
  orientation: string;
  periods: string[];
  city: string;
  gender: string;
  query: string;
  sort: string;
}

const PAGE = 30;
const SORTS = [
  { id: "university", label: "نام دانشگاه" },
  { id: "capacity", label: "بیشترین ظرفیت" },
  { id: "code", label: "کد رشته‌محل" },
];

/** Persian and Arabic letters and digits folded together, so «ي» finds «ی» and «۲۲۵» finds 225. */
function fold(text: string) {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/‌/g, " ")
    .toLowerCase();
}

type ChoiceState = { status: "loading" } | { status: "anonymous" } | { status: "ready"; ids: Set<string> };

export function ChoiceFinder({ rows, year, initial }: { rows: CatalogRow[]; year: number; initial: FinderFilters }) {
  const sets = useMemo(() => EXAM_SETS.filter((item) => rows.some((row) => row.set === item.code)), [rows]);
  const [set, setSet] = useState(sets.some((s) => s.code === initial.set) ? initial.set : sets[0]?.code ?? "");
  const [group, setGroup] = useState(initial.group);
  const [orientation, setOrientation] = useState(initial.orientation);
  const [periods, setPeriods] = useState<string[]>(initial.periods.filter((p) => PERIODS.some((item) => item.id === p)));
  const [city, setCity] = useState(initial.city);
  const [gender, setGender] = useState(initial.gender === "female" || initial.gender === "male" ? initial.gender : "");
  const [query, setQuery] = useState(initial.query);
  const [sort, setSort] = useState(SORTS.some((s) => s.id === initial.sort) ? initial.sort : "university");
  const [shown, setShown] = useState(PAGE);
  const [choices, setChoices] = useState<ChoiceState>({ status: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    apiFetch<{ programId: string }[]>("/me/choices")
      .then((items) => setChoices({ status: "ready", ids: new Set(items.map((item) => item.programId)) }))
      .catch(() => setChoices({ status: "anonymous" }));
  }, []);

  // A filtered view is shareable: the address keeps the filters.
  useEffect(() => {
    const params = new URLSearchParams();
    if (set && set !== sets[0]?.code) params.set("set", set);
    if (group) params.set("group", group);
    if (orientation) params.set("o", orientation);
    if (periods.length) params.set("period", periods.join(","));
    if (city) params.set("city", city);
    if (gender) params.set("gender", gender);
    if (query) params.set("q", query);
    if (sort !== "university") params.set("sort", sort);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setShown(PAGE);
  }, [set, group, orientation, periods, city, gender, query, sort, sets]);

  const inSet = useMemo(() => rows.filter((row) => row.set === set), [rows, set]);
  const groups = useMemo(() => [...new Set(inSet.map((row) => row.group))].sort((a, b) => a - b), [inSet]);
  const orientations = useMemo(
    () => [...new Set(inSet.filter((row) => !group || row.group === Number(group)).map((row) => row.orientation))].sort((a, b) => a.localeCompare(b, "fa")),
    [inSet, group],
  );
  const cities = useMemo(() => [...new Set(inSet.map((row) => row.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fa")), [inSet]);

  const results = useMemo(() => {
    const needle = fold(deferredQuery.trim());
    const filtered = inSet.filter((row) =>
      (!group || row.group === Number(group)) &&
      (!orientation || row.orientation === orientation) &&
      (!periods.length || periods.includes(row.period)) &&
      (!city || row.city === city) &&
      (!gender || row.gender === "ANY" || row.gender === (gender === "female" ? "FEMALE" : "MALE")) &&
      (!needle || fold(`${row.university} ${row.location} ${row.city} ${row.orientation} ${row.selectionCode} ${row.notes}`).includes(needle)),
    );
    return filtered.sort((a, b) =>
      sort === "capacity" ? b.capacity - a.capacity || a.university.localeCompare(b.university, "fa")
        : sort === "code" ? a.selectionCode.localeCompare(b.selectionCode)
          : a.university.localeCompare(b.university, "fa") || a.orientation.localeCompare(b.orientation, "fa") || a.selectionCode.localeCompare(b.selectionCode),
    );
  }, [inSet, group, orientation, periods, city, gender, deferredQuery, sort]);

  const seats = results.reduce((sum, row) => sum + row.capacity, 0);

  // Quick picks: this set's biggest orientations, by seats.
  const topOrientations = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of inSet) if (!group || row.group === Number(group)) totals.set(row.orientation, (totals.get(row.orientation) ?? 0) + row.capacity);
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [inSet, group]);

  // Where the seats of the current results sit, by period.
  const bySeat = PERIODS.map((p) => ({ ...p, seats: results.filter((row) => row.period === p.id).reduce((sum, row) => sum + row.capacity, 0) })).filter((p) => p.seats > 0);
  const filterCount = [group, orientation, periods.length ? "p" : "", city, gender, query].filter(Boolean).length;
  const chosen = choices.status === "ready" ? choices.ids : null;

  function reset() {
    setGroup("");
    setOrientation("");
    setPeriods([]);
    setCity("");
    setGender("");
    setQuery("");
  }

  function togglePeriod(id: string) {
    setPeriods((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));
  }

  async function toggleChoice(row: CatalogRow) {
    if (choices.status !== "ready" || busy) return;
    setBusy(row.id);
    setMessage(null);
    const has = choices.ids.has(row.id);
    try {
      if (has) await apiFetch(`/me/choices/${row.id}`, { method: "DELETE" });
      else await apiFetch("/me/choices", { method: "POST", body: { programId: row.id } });
      const ids = new Set(choices.ids);
      if (has) ids.delete(row.id);
      else ids.add(row.id);
      setChoices({ status: "ready", ids });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setChoices({ status: "anonymous" });
      else setMessage(error instanceof Error ? error.message : "ذخیرهٔ انتخاب ممکن نشد؛ دوباره تلاش کن.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="af-finder" id="finder" aria-label="جست‌وجوی کد رشته‌محل">
      <div className="af-sets" role="tablist" aria-label="مجموعهٔ امتحانی">
        {sets.map((item) => (
          <button
            key={item.code}
            type="button"
            role="tab"
            aria-selected={set === item.code}
            onClick={() => {
              setSet(item.code);
              setGroup("");
              setOrientation("");
              setCity("");
            }}
          >
            {item.title}
            <span>{toPersianDigits(item.code)} · {formatPersianNumber(rows.filter((row) => row.set === item.code).length)} کد</span>
          </button>
        ))}
      </div>

      {topOrientations.length > 1 && (
        <div className="af-picks" role="group" aria-label="گرایش‌های پرظرفیت">
          {topOrientations.map(([name, total]) => (
            <button key={name} type="button" aria-pressed={orientation === name} onClick={() => setOrientation(orientation === name ? "" : name)}>
              <span>{name}</span>
              <b>{formatPersianNumber(total)}</b>
            </button>
          ))}
        </div>
      )}

      <div className="af-filters">
        <label className="af-search">
          <span className="sr-only">جست‌وجو</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام دانشگاه، شهر یا کد رشته‌محل" />
        </label>
        <div className="af-selects">
          {groups.length > 1 && (
            <label>
              <span>کد ضریب</span>
              <select value={group} onChange={(event) => { setGroup(event.target.value); setOrientation(""); }}>
                <option value="">همه</option>
                {groups.map((g) => <option key={g} value={g}>{toPersianDigits(groupLabel(set, g))}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>گرایش</span>
            <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
              <option value="">همهٔ گرایش‌ها</option>
              {orientations.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label>
            <span>شهر محل تحصیل</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">همهٔ شهرها</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span>جنسیت</span>
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">نمایش همه</option>
              <option value="female">کدهایی که زن می‌پذیرند</option>
              <option value="male">کدهایی که مرد می‌پذیرند</option>
            </select>
          </label>
          <label>
            <span>ترتیب</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="af-periods" role="group" aria-label="دورهٔ تحصیلی">
          {PERIODS.filter((p) => inSet.some((row) => row.period === p.id)).map((p) => (
            <button key={p.id} type="button" aria-pressed={periods.includes(p.id)} data-free={p.id === "DAILY" || undefined} onClick={() => togglePeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="af-summary" role="status">
        <p>
          <b>{formatPersianNumber(results.length)}</b> کد رشته‌محل با <b>{formatPersianNumber(seats)}</b> ظرفیت
          {filterCount > 0 && <button type="button" onClick={reset}>پاک کردن فیلترها</button>}
        </p>
        {choices.status === "anonymous" && (
          <p className="af-login">برای ساختن فهرست انتخاب‌ها <Link href="/login?next=/programs">وارد حساب شو</Link>.</p>
        )}
      </div>
      {seats > 0 && (
        <div className="af-seatbar">
          <div className="af-seatbar-track" role="group" aria-label="ظرفیت این نتیجه‌ها به تفکیک دوره">
            {bySeat.map((p) => (
              <button
                key={p.id}
                type="button"
                data-period={p.id}
                aria-pressed={periods.includes(p.id)}
                style={{ flexGrow: p.seats }}
                title={`${p.label}: ${formatPersianNumber(p.seats)} ظرفیت`}
                onClick={() => togglePeriod(p.id)}
              >
                <span className="sr-only">{p.label}</span>
              </button>
            ))}
          </div>
          <ul className="af-seatbar-legend">
            {bySeat.map((p) => (
              <li key={p.id} data-period={p.id}>{p.label} <b>{formatPersianNumber(p.seats)}</b> <small>{toPersianDigits(Math.round((100 * p.seats) / seats))}٪</small></li>
            ))}
          </ul>
        </div>
      )}
      {message && <p className="af-error" role="alert">{message}</p>}

      {results.length === 0 ? (
        <div className="af-empty">
          <p>کدی با این فیلترها پیدا نشد.</p>
          <button type="button" onClick={reset}>پاک کردن فیلترها</button>
        </div>
      ) : (
        <ol className="af-list">
          {results.slice(0, shown).map((row) => {
            const added = chosen?.has(row.id) ?? false;
            return (
              <li key={row.id} className="af-row" data-chosen={added || undefined} data-period={row.period}>
                <div className="af-stub">
                  <small>کد رشته‌محل</small>
                  <span className="af-code">{toPersianDigits(row.selectionCode)}</span>
                </div>
                <div className="af-row-main">
                  <div className="af-row-head">
                    <Link href={`/universities/${encodeURIComponent(row.universityCode)}`} className="af-uni">{row.university}</Link>
                  </div>
                  <p className="af-place">
                    {row.city}
                    {row.location && row.location !== row.city ? ` · ${row.location}` : ""}
                  </p>
                  <div className="af-tags">
                    <span className="af-tag af-tag-orientation">{row.orientation}</span>
                    <span className="af-tag" data-period={row.period}>{periodLabel(row.period)}</span>
                    {row.group > 0 && groups.length > 1 && <span className="af-tag af-tag-muted">کد ضریب {toPersianDigits(row.group)}</span>}
                    {row.gender !== "ANY" && <span className="af-tag af-tag-key">{GENDER_LABEL[row.gender]}</span>}
                  </div>
                  {row.notes && (
                    <p className="af-notes">
                      {noteItems(row.notes).filter((note) => note !== GENDER_LABEL[row.gender]).map((note) => (
                        <span key={note} data-key={isKeyNote(note) || undefined}>{note}</span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="af-row-side">
                  <p className="af-cap"><b>{formatPersianNumber(row.capacity)}</b> ظرفیت</p>
                  {choices.status === "ready" && (
                    <button
                      type="button"
                      className="af-add"
                      aria-pressed={added}
                      disabled={busy === row.id || (!added && choices.ids.size >= MAX_CHOICES)}
                      onClick={() => toggleChoice(row)}
                    >
                      {busy === row.id ? "…" : added ? "در فهرست من ✓" : "افزودن به فهرست"}
                    </button>
                  )}
                  <Link className="af-more" href={`/programs/${encodeURIComponent(row.code)}`}>جزئیات</Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {results.length > shown && (
        <button type="button" className="af-show-more" onClick={() => setShown((n) => n + PAGE)}>
          {formatPersianNumber(Math.min(PAGE, results.length - shown))} کد دیگر ({formatPersianNumber(results.length - shown)} باقی‌مانده)
        </button>
      )}
      <p className="af-footnote">ظرفیت‌ها مال سال {toPersianDigits(year)} است.</p>

      {choices.status === "ready" && choices.ids.size > 0 && (
        <Link href="/choices" className="af-tray">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15" />
            <circle cx="18" cy="18" r="15" className="af-tray-fill" style={{ strokeDasharray: `${(94.2 * choices.ids.size) / MAX_CHOICES} 94.2` }} />
          </svg>
          <span>
            <b>{toPersianDigits(choices.ids.size)}</b> از {toPersianDigits(MAX_CHOICES)} کد در فهرست من
          </span>
          <em>چیدن و کپی کدها ←</em>
        </Link>
      )}
    </section>
  );
}
