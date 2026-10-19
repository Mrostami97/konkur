"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { OUTSIDE_1406_SUBJECTS, SYLLABUS, chapterTopicCodes, topicPlace } from "../../lib/syllabus";
import { DataState, Pagination } from "../../components/ds";
import { Glyph } from "../../components/SubjectIcon";
import type { ReadingLink } from "../../content/article-topics";
import { LockedRun, QuestionCard, isOpen, type BankQuestion, type CardHandle } from "./QuestionCard";
import { loadHistories, type History, type Outcome } from "./practice";

export interface SubjectOption { code: string; title: string }

interface Counts { subjects: Record<string, number>; solved?: Record<string, number>; topics: Record<string, number> }

const PAGE_SIZE = 10;
/** Konkur years a question can come from, newest first. */
const YEARS = Array.from({ length: 26 }, (_, index) => 1405 - index);
/** The master's tracks a question can come from. */
const TRACKS = [
  { value: "computer-engineering", label: "مهندسی کامپیوتر" },
  { value: "information-technology", label: "فناوری اطلاعات" },
  { value: "computer-science", label: "علوم کامپیوتر" },
];

/** The signed-in student's own sets of questions (practice.service.ts `COLLECTIONS`). */
const COLLECTIONS = [
  { value: "unseen", label: "هنوز ندیده‌ام" },
  { value: "wrong", label: "غلط زده‌ام" },
  { value: "never_right", label: "هنوز درست نزده‌ام" },
  { value: "last_wrong", label: "بار آخر غلط" },
  { value: "last_two_wrong", label: "دو بار آخر غلط" },
  { value: "sure_but_wrong", label: "مطمئن بودم ولی غلط شد" },
  { value: "starred", label: "ستاره‌دارها" },
  { value: "noted", label: "یادداشت‌دارها" },
];

export interface Filters { subjectCode: string; chapter: string; topic: string; examYear: string; examMajor: string; collection: string; solved: string }
const EMPTY: Filters = { subjectCode: "", chapter: "", topic: "", examYear: "", examMajor: "", collection: "", solved: "" };

const KEYS: [string, string][] = [
  ["۱ تا ۴", "انتخاب گزینه"],
  ["Enter", "بررسی پاسخ"],
  ["J / K", "تست بعد / قبل"],
  ["H", "سرنخ"],
  ["S", "ستاره"],
  ["F", "حالت تمرکز"],
];

/** Typing in a field must never answer a question. */
function typing(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)));
}

/**
 * The bank as a practice sheet: ten whole questions a page, each answerable
 * where it stands -- no opening a question and coming back. Filters sit in one
 * sticky bar (subject → chapter → topic, year, track, the student's own sets),
 * a map beside the sheet shows how the page is going, and the keyboard or a
 * focus mode moves question to question.
 */
export function QuestionBank({
  catalog,
  initial,
  initialPage = 1,
  reading,
}: {
  catalog: SubjectOption[];
  initial: Partial<Filters>;
  initialPage?: number;
  /** Lesson notes and test articles per syllabus chapter. */
  reading: Record<string, ReadingLink[]>;
}) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initial });
  const [page, setPage] = useState(initialPage);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null when signed out: no history, collections or stars. */
  const [histories, setHistories] = useState<Record<string, History> | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [active, setActive] = useState(0);
  const [focus, setFocus] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const handles = useRef<(CardHandle | null)[]>([]);
  const itemEls = useRef<(HTMLDivElement | null)[]>([]);
  const sheetTop = useRef<HTMLDivElement | null>(null);
  const firstLoad = useRef(true);
  /** After "next" past the last card, the new page opens on its first card. */
  const openFirst = useRef(false);

  // The site header stays on screen; the filter bar sticks right under it.
  const root = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".hd");
    if (!header || !root.current) return;
    const place = () => root.current?.style.setProperty("--qb-top", `${header.offsetHeight}px`);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const params = filters.subjectCode ? `?subjectCode=${encodeURIComponent(filters.subjectCode)}` : "";
    apiFetch<Counts>(`/questions/counts${params}`).then(setCounts).catch(() => setCounts(null));
  }, [filters.subjectCode]);

  const titles = useMemo(() => {
    const map = new Map<string, string>(Object.entries(OUTSIDE_1406_SUBJECTS));
    catalog.forEach((subject) => map.set(subject.code, subject.title));
    return map;
  }, [catalog]);
  const titleOf = useCallback((code: string) => titles.get(code) ?? code, [titles]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (filters.subjectCode) params.set("subjectCode", filters.subjectCode);
      if (filters.topic) params.set("topicCode", filters.topic);
      else if (filters.chapter) params.set("topicCodes", chapterTopicCodes(filters.subjectCode, filters.chapter).join(","));
      if (filters.examYear) params.set("examYear", filters.examYear);
      if (filters.examMajor) params.set("examMajor", filters.examMajor);
      if (filters.collection) params.set("collection", filters.collection);
      if (filters.solved) params.set("solved", "true");
      const data = await apiFetch<{ items: BankQuestion[]; total: number }>(`/questions?${params}`);
      setHistories(await loadHistories(data.items.map((item) => item.id)));
      setItems(data.items);
      setTotal(data.total);
      setOutcomes({});
      setActive(0);
      if (!firstLoad.current && !openFirst.current) sheetTop.current?.scrollIntoView({ block: "start" });
      firstLoad.current = false;
      openFirst.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن بانک سؤال ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void search();
  }, [search]);

  // Keep the address in step, so a filtered page of the bank can be bookmarked or shared.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.subjectCode) params.set("subject", filters.subjectCode);
    if (filters.chapter) params.set("chapter", filters.chapter);
    if (filters.topic) params.set("topic", filters.topic);
    if (filters.examYear) params.set("year", filters.examYear);
    if (filters.examMajor) params.set("track", filters.examMajor);
    if (filters.collection) params.set("collection", filters.collection);
    if (filters.solved) params.set("solved", "1");
    if (page > 1) params.set("page", String(page));
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname);
  }, [filters, page]);

  function set(next: Partial<Filters>) {
    setPage(1);
    setFilters((previous) => ({ ...previous, ...next }));
  }

  const open = items.filter(isOpen);
  const firstIndex = (page - 1) * PAGE_SIZE;
  const tree = filters.subjectCode ? SYLLABUS[filters.subjectCode] ?? [] : [];
  const topicCount = (code: string) => counts?.topics[code] ?? 0;
  const chapter = tree.find((item) => item.code === filters.chapter);
  const activeFilters = [filters.subjectCode, filters.examYear, filters.examMajor, filters.collection, filters.solved].filter(Boolean).length;
  const bankTotal = counts ? Object.values(counts.subjects).reduce((sum, n) => sum + n, 0) : null;
  const bankSolved = counts?.solved ? Object.values(counts.solved).reduce((sum, n) => sum + n, 0) : null;
  const answered = open.filter((question) => outcomes[question.id]).length;
  const right = open.filter((question) => outcomes[question.id] === "CORRECT").length;
  const hasNext = page * PAGE_SIZE < total;

  const go = useCallback(
    (step: number) => {
      const next = active + step;
      if (next >= 0 && next < open.length) {
        setActive(next);
        if (!focus) itemEls.current[next]?.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if (next >= open.length && hasNext) {
        openFirst.current = focus;
        setPage((current) => current + 1);
      }
    },
    [active, open.length, focus, hasNext],
  );

  // The question being worked on is the one at the top of the screen.
  useEffect(() => {
    if (focus) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = 160;
        const index = itemEls.current.findIndex((element) => element && element.getBoundingClientRect().bottom > line);
        if (index >= 0) setActive(index);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [focus, open.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      const card = handles.current[active];
      const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code);
      if (digit) card?.pick(Number(digit[1]));
      else if (event.code === "Enter" && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) card?.check();
      else if (event.code === "KeyJ" || event.code === "KeyN") go(1);
      else if (event.code === "KeyK" || event.code === "KeyP") go(-1);
      else if (event.code === "KeyH") card?.hint();
      else if (event.code === "KeyS") card?.star();
      else if (event.code === "KeyF") setFocus((on) => !on);
      else if (event.code === "Escape") setFocus(false);
      else if (event.code === "Slash" && event.shiftKey) setHelpOpen((on) => !on);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

  // Focus mode covers the page; the page under it must not scroll. Leaving
  // it returns the sheet to the question the student ended on.
  const activeNow = useRef(active);
  activeNow.current = active;
  useEffect(() => {
    if (!focus) return;
    const previous = document.body.style.overflow;
    const elements = itemEls.current;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      elements[activeNow.current]?.scrollIntoView({ block: "start" });
    };
  }, [focus]);

  function onOutcome(id: string, outcome: Outcome) {
    setOutcomes((previous) => ({ ...previous, [id]: outcome }));
  }

  // Questions and runs of locked ones, in page order.
  const rows: ({ kind: "open"; question: BankQuestion; index: number; number: number } | { kind: "locked"; questions: BankQuestion[]; number: number })[] = [];
  const seenPassages = new Set<string>();
  items.forEach((question, offset) => {
    const number = firstIndex + offset + 1;
    if (isOpen(question)) {
      rows.push({ kind: "open", question, index: rows.filter((row) => row.kind === "open").length, number });
    } else {
      const last = rows[rows.length - 1];
      if (last?.kind === "locked") last.questions.push(question);
      else rows.push({ kind: "locked", questions: [question], number });
    }
  });

  const summary = [
    filters.subjectCode && titleOf(filters.subjectCode),
    filters.topic ? topicPlace(filters.subjectCode, filters.topic)?.topic.title : chapter?.title,
    filters.examYear && `کنکور ${toPersianDigits(filters.examYear)}`,
    filters.examMajor && TRACKS.find((track) => track.value === filters.examMajor)?.label,
    filters.collection && COLLECTIONS.find((item) => item.value === filters.collection)?.label,
    filters.solved && "با حل تشریحی",
  ].filter(Boolean);

  return (
    <main className="qb" data-focus={focus || undefined} ref={root}>
      <header className="qb-hero">
        <div className="qb-wrap">
          <div>
            <h1>بانک تست کنکور ارشد کامپیوتر</h1>
            <p className="qb-stats">
              {bankTotal !== null ? (
                <>
                  <strong className="tnum">{formatPersianNumber(bankTotal)}</strong> تست از کنکورهای ارشد سال‌های قبل
                  {bankSolved ? (
                    <>
                      ؛ <strong className="tnum">{formatPersianNumber(bankSolved)}</strong> تا با حل تشریحی
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "تست‌های کنکورهای ارشد سال‌های قبل، درس‌به‌درس و مبحث‌به‌مبحث."
              )}
            </p>
          </div>
          <nav className="qb-hero-links" aria-label="راه‌های دیگر تمرین">
            <Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/questions/subjects">فصل‌به‌فصل</Link>
            <Link className="ds-btn ds-btn-primary ds-btn-sm" href="/questions/build">آزمون شخصی</Link>
          </nav>
        </div>
      </header>

      <div className="qb-bar">
        <div className="qb-wrap">
          <button type="button" className="qb-bar-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((on) => !on)}>
            <Glyph name="filter" />
            فیلتر{activeFilters ? ` (${toPersianDigits(activeFilters)})` : ""}
          </button>
          <div className="qb-filters" data-open={filtersOpen || undefined}>
            <label>
              <span className="sr-only">درس</span>
              <select value={filters.subjectCode} onChange={(event) => set({ subjectCode: event.target.value, chapter: "", topic: "" })}>
                <option value="">همهٔ درس‌ها</option>
                {catalog
                  .filter((subject) => !counts || (counts.subjects[subject.code] ?? 0) > 0)
                  .map((subject) => (
                    <option key={subject.code} value={subject.code}>
                      {subject.title}
                      {counts ? ` (${toPersianDigits(counts.subjects[subject.code] ?? 0)})` : ""}
                    </option>
                  ))}
                {counts && Object.keys(OUTSIDE_1406_SUBJECTS).some((code) => counts.subjects[code]) && (
                  <optgroup label="خارج از کنکور ۱۴۰۶">
                    {Object.entries(OUTSIDE_1406_SUBJECTS)
                      .filter(([code]) => counts.subjects[code])
                      .map(([code, title]) => (
                        <option key={code} value={code}>{title} ({toPersianDigits(counts.subjects[code])})</option>
                      ))}
                  </optgroup>
                )}
              </select>
            </label>
            {tree.length > 0 && (
              <label>
                <span className="sr-only">فصل</span>
                <select value={filters.chapter} onChange={(event) => set({ chapter: event.target.value, topic: "" })}>
                  <option value="">همهٔ فصل‌ها</option>
                  {tree.map((item) => {
                    const n = item.topics.reduce((sum, topic) => sum + topicCount(topic.code), 0);
                    if (counts && n === 0) return null;
                    return (
                      <option key={item.code} value={item.code}>
                        {item.title}
                        {counts ? ` (${toPersianDigits(n)})` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            {chapter && (
              <label>
                <span className="sr-only">مبحث</span>
                <select value={filters.topic} onChange={(event) => set({ topic: event.target.value })}>
                  <option value="">همهٔ مبحث‌های فصل</option>
                  {chapter.topics
                    .filter((topic) => !counts || topicCount(topic.code) > 0)
                    .map((topic) => (
                      <option key={topic.code} value={topic.code}>
                        {topic.title}
                        {counts ? ` (${toPersianDigits(topicCount(topic.code))})` : ""}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              <span className="sr-only">سال کنکور</span>
              <select data-size="s" value={filters.examYear} onChange={(event) => set({ examYear: event.target.value })}>
                <option value="">همهٔ سال‌ها</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>{toPersianDigits(year)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">رشته</span>
              <select data-size="s" value={filters.examMajor} onChange={(event) => set({ examMajor: event.target.value })}>
                <option value="">همهٔ رشته‌ها</option>
                {TRACKS.map((track) => (
                  <option key={track.value} value={track.value}>{track.label}</option>
                ))}
              </select>
            </label>
            {histories && (
              <label>
                <span className="sr-only">سؤال‌های من</span>
                <select value={filters.collection} onChange={(event) => set({ collection: event.target.value })}>
                  <option value="">همهٔ تست‌ها</option>
                  {COLLECTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="qb-chip" aria-pressed={Boolean(filters.solved)} onClick={() => set({ solved: filters.solved ? "" : "1" })}>
              فقط با حل تشریحی
            </button>
            {activeFilters > 0 && (
              <button type="button" className="qb-clear" onClick={() => set(EMPTY)}>پاک کردن</button>
            )}
          </div>
          <p className="qb-count" aria-live="polite">
            {loading ? "در حال آوردن تست‌ها…" : `${formatPersianNumber(total)} تست`}
          </p>
          {open.length > 0 && (
            <button type="button" className="qb-focus-btn" onClick={() => setFocus(true)} title="حالت تمرکز (F)">
              <Glyph name="focus" />
              <span>تمرکز</span>
            </button>
          )}
        </div>
      </div>

      <div className="qb-wrap qb-layout" ref={sheetTop}>
        <section className="qb-sheet" aria-label="تست‌ها">
          {summary.length > 0 && <p className="qb-summary">{summary.join(" · ")}</p>}
          <DataState
            loading={loading}
            error={error}
            isEmpty={items.length === 0}
            onRetry={search}
            emptyTitle={filters.collection ? "در این دسته هنوز تستی نیست" : "تستی با این فیلترها نیست"}
            emptyDescription={filters.collection ? "تست بزن تا این دسته پر شود، یا دستهٔ دیگری را انتخاب کن." : "فیلترها را کمتر کن یا همه را پاک کن."}
            skeletonRows={6}
          >
            <div className="qb-items">
              {rows.map((row) => {
                if (row.kind === "locked") {
                  return <LockedRun key={row.questions[0].id} questions={row.questions} subjectTitle={titleOf} startAt={row.number} signedOut={histories === null} />;
                }
                const passage = row.question.passage?.externalId;
                const passageOpen = Boolean(passage && !seenPassages.has(passage));
                if (passage) seenPassages.add(passage);
                const place = topicPlace(row.question.subjectCode, row.question.topicCodes?.[0]);
                return (
                  <div
                    key={row.question.id}
                    className="qb-item"
                    data-focused={(focus && active === row.index) || undefined}
                    ref={(element) => {
                      itemEls.current[row.index] = element;
                    }}
                  >
                    <QuestionCard
                      ref={(handle) => {
                        handles.current[row.index] = handle;
                      }}
                      question={row.question}
                      subjectTitle={titleOf(row.question.subjectCode)}
                      position={row.number}
                      history={histories?.[row.question.id] ?? null}
                      onHistory={(history) => setHistories((previous) => (previous ? { ...previous, [row.question.id]: history } : previous))}
                      onOutcome={onOutcome}
                      active={active === row.index}
                      onActivate={() => setActive(row.index)}
                      reading={place ? reading[place.chapter.code] : undefined}
                      passageOpen={passageOpen}
                    />
                  </div>
                );
              })}
            </div>

            {hasNext && (
              <button type="button" className="qb-next" onClick={() => setPage(page + 1)}>
                {toPersianDigits(Math.min(PAGE_SIZE, total - page * PAGE_SIZE))} تست بعدی
                <Glyph name="arrowLeft" />
              </button>
            )}
            {total > PAGE_SIZE && (
              <div className="qb-pages">
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>
            )}
          </DataState>
        </section>

        <aside className="qb-side" aria-label="این صفحه">
          {open.length > 0 && (
            <div className="qb-map">
              <p className="qb-map-title">این صفحه</p>
              <ol className="qb-dots">
                {rows
                  .filter((row) => row.kind === "open")
                  .map((row) => {
                    if (row.kind !== "open") return null;
                    const outcome = outcomes[row.question.id];
                    const history = histories?.[row.question.id];
                    return (
                      <li key={row.question.id}>
                        <button
                          type="button"
                          data-active={active === row.index || undefined}
                          data-outcome={outcome}
                          data-seen={(!outcome && history?.seen) || undefined}
                          data-starred={history?.starred || undefined}
                          aria-label={`تست ${toPersianDigits(row.number)}`}
                          onClick={() => {
                            setActive(row.index);
                            itemEls.current[row.index]?.scrollIntoView({ block: "start", behavior: "smooth" });
                          }}
                        >
                          {toPersianDigits(row.number)}
                        </button>
                      </li>
                    );
                  })}
              </ol>
              <p className="qb-map-score tnum">
                {answered === 0
                  ? "هنوز تستی از این صفحه نزده‌ای."
                  : `${toPersianDigits(answered)} از ${toPersianDigits(open.length)} زده‌ای · ${toPersianDigits(right)} درست`}
              </p>
              {histories === null && (
                <p className="qb-map-note">
                  <Link href="/login?next=/questions">وارد شو</Link> تا پاسخ‌هایت، ستاره‌ها و یادداشت‌هایت بماند.
                </p>
              )}
            </div>
          )}
          <div className="qb-keys">
            <button type="button" className="qb-keys-toggle" aria-expanded={helpOpen} onClick={() => setHelpOpen((on) => !on)}>
              <Glyph name="keyboard" />
              میان‌برهای صفحه‌کلید
            </button>
            {helpOpen && (
              <dl>
                {KEYS.map(([key, label]) => (
                  <div key={key}>
                    <dt><kbd>{key}</kbd></dt>
                    <dd>{label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </aside>
      </div>

      {focus && open.length > 0 && (
        <div className="qb-focusbar" role="toolbar" aria-label="حالت تمرکز">
          <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="تست قبلی (K)">
            <Glyph name="arrowRight" />
          </button>
          <span className="tnum">
            {toPersianDigits(firstIndex + 1 + items.indexOf(open[active] ?? items[0]))} از {formatPersianNumber(total)}
          </span>
          <button type="button" onClick={() => go(1)} disabled={active >= open.length - 1 && !hasNext} aria-label="تست بعدی (J)">
            <Glyph name="arrowLeft" />
          </button>
          <span className="qb-focus-progress" aria-hidden="true">
            <span style={{ width: `${((active + 1) / open.length) * 100}%` }} />
          </span>
          <button type="button" className="qb-focus-exit" onClick={() => setFocus(false)}>
            <Glyph name="unfocus" />
            خروج
          </button>
        </div>
      )}
    </main>
  );
}
