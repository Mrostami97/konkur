"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { MIN_QUESTIONS_FOR_BANK, useAvailability } from "../../lib/availability";
import { toPersianDigits } from "../../lib/format";
import { OUTSIDE_1406_SUBJECTS, SYLLABUS, chapterTopicCodes, topicPlace } from "../../lib/syllabus";
import { DataState, Pagination } from "../../components/ds";
import { fieldLabel } from "../account/profile-options";

export interface SubjectOption { code: string; title: string }
interface Block { type: string; text?: string }

/**
 * A locked question carries metadata only -- the API decides server-side how
 * much of a question a caller may see, so a row must never assume a stem.
 */
interface Question {
  id: string;
  subjectCode: string;
  examMajor: string;
  examDegree?: string;
  examYear: number;
  questionNumber?: number | null;
  isSample: boolean;
  topicCodes?: string[];
  stemBlocks?: Block[];
}

interface Counts { subjects: Record<string, number>; topics: Record<string, number> }

const PAGE_SIZE = 20;
/** Konkur years a question can come from, newest first. */
const YEARS = Array.from({ length: 26 }, (_, index) => 1405 - index);
/** The master's tracks a question can come from. */
const TRACKS = [
  { value: "computer-engineering", label: "مهندسی کامپیوتر" },
  { value: "information-technology", label: "فناوری اطلاعات" },
  { value: "computer-science", label: "علوم کامپیوتر" },
];

interface Filters { subjectCode: string; chapter: string; topic: string; examYear: string; examMajor: string; query: string }
const EMPTY: Filters = { subjectCode: "", chapter: "", topic: "", examYear: "", examMajor: "", query: "" };

/**
 * The bank as a study tool: filters stay put on the side, questions are a
 * dense list you scan and open one after another -- the shape of an index,
 * not a catalogue of cards. A subject opens its 1406 syllabus tree (chapters,
 * then topics) with how many questions each holds, so a candidate who read
 * one topic tonight finds exactly its questions.
 */
export function QuestionBank({
  catalog,
  initial,
}: {
  catalog: SubjectOption[];
  initial: Partial<Filters>;
}) {
  const availability = useAvailability();
  const filling = availability !== null && availability.questions < MIN_QUESTIONS_FOR_BANK;

  const start = { ...EMPTY, ...initial };
  const [draft, setDraft] = useState({ examYear: start.examYear, examMajor: start.examMajor, query: start.query });
  const [applied, setApplied] = useState<Filters>(start);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);

  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Counts beside every subject, and the open subject's topics.
  useEffect(() => {
    const params = applied.subjectCode ? `?subjectCode=${encodeURIComponent(applied.subjectCode)}` : "";
    apiFetch<Counts>(`/questions/counts${params}`).then(setCounts).catch(() => setCounts(null));
  }, [applied.subjectCode]);

  const titleOf = useMemo(() => {
    const map = new Map<string, string>(Object.entries(OUTSIDE_1406_SUBJECTS));
    catalog.forEach((subject) => map.set(subject.code, subject.title));
    return (code: string) => map.get(code) ?? code;
  }, [catalog]);

  // 1406 subjects first, in the editorial order; courses the exam dropped after, when they hold questions.
  const subjectList = useMemo(() => {
    const has = (code: string) => !counts || (counts.subjects[code] ?? 0) > 0;
    const main = catalog.filter((subject) => has(subject.code));
    const outside = Object.entries(OUTSIDE_1406_SUBJECTS)
      .filter(([code]) => counts && (counts.subjects[code] ?? 0) > 0)
      .map(([code, title]) => ({ code, title }));
    return { main, outside };
  }, [catalog, counts]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied.subjectCode) params.set("subjectCode", applied.subjectCode);
      if (applied.topic) params.set("topicCode", applied.topic);
      else if (applied.chapter) params.set("topicCodes", chapterTopicCodes(applied.subjectCode, applied.chapter).join(","));
      if (applied.examYear) params.set("examYear", applied.examYear);
      if (applied.examMajor) params.set("examMajor", applied.examMajor);
      if (applied.query) params.set("q", applied.query);
      const data = await apiFetch<{ items: Question[]; total: number }>(`/questions?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن بانک سؤال ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void search();
  }, [search]);

  // Keep the address in step, so a filtered bank can be bookmarked or shared.
  useEffect(() => {
    const params = new URLSearchParams();
    if (applied.subjectCode) params.set("subject", applied.subjectCode);
    if (applied.chapter) params.set("chapter", applied.chapter);
    if (applied.topic) params.set("topic", applied.topic);
    if (applied.examYear) params.set("year", applied.examYear);
    if (applied.examMajor) params.set("track", applied.examMajor);
    const next = params.size ? `?${params}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, [applied]);

  function apply(event?: FormEvent) {
    event?.preventDefault();
    setPage(1);
    setApplied((previous) => ({ ...previous, ...draft }));
    setFiltersOpen(false);
  }

  function pick(next: Partial<Filters>) {
    setPage(1);
    setApplied((previous) => ({ ...previous, ...next }));
  }

  function clear() {
    setDraft({ examYear: "", examMajor: "", query: "" });
    setApplied(EMPTY);
    setPage(1);
  }

  const activeCount = [applied.subjectCode, applied.examYear, applied.examMajor, applied.query].filter(Boolean).length;
  const firstIndex = (page - 1) * PAGE_SIZE;
  const tree = applied.subjectCode ? SYLLABUS[applied.subjectCode] ?? [] : [];
  const topicCount = (code: string) => counts?.topics[code] ?? 0;
  const chapterCount = (codes: string[]) => codes.reduce((sum, code) => sum + topicCount(code), 0);
  const place = applied.topic ? topicPlace(applied.subjectCode, applied.topic) : null;
  const openChapter = applied.chapter || place?.chapter.code || "";

  const subjectButton = (subject: SubjectOption) => (
    <button
      type="button"
      key={subject.code}
      aria-pressed={applied.subjectCode === subject.code}
      onClick={() => pick({ subjectCode: subject.code, chapter: "", topic: "" })}
    >
      <span>{subject.title}</span>
      {counts && <span className="qb-count tnum">{toPersianDigits(counts.subjects[subject.code] ?? 0)}</span>}
    </button>
  );

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker">بانک سؤال</p>
          <h1>تست‌های کنکور، درس‌به‌درس و مبحث‌به‌مبحث</h1>
          <p>هر تست سر جای خودش در سرفصل ۱۴۰۶ است. سؤال‌های نمونه برای همه باز است؛ متن و پاسخ بقیه با دسترسی بانک همان درس نمایش داده می‌شود.</p>
        </div>
      </header>

      <div className="qb-wrap qb-layout">
        <aside className="qb-filters" data-open={filtersOpen || undefined} aria-label="فیلتر سؤال‌ها">
          <button type="button" className="qb-filters-toggle" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
            فیلترها{activeCount > 0 ? ` (${toPersianDigits(activeCount)})` : ""}
          </button>

          <form className="qb-filters-body" onSubmit={apply}>
            <label className="qb-field">
              <span>جست‌وجو</span>
              <input type="search" value={draft.query} onChange={(event) => setDraft({ ...draft, query: event.target.value })} placeholder="متن، مبحث یا کد درس" />
            </label>

            <label className="qb-field">
              <span>رشته</span>
              <select value={draft.examMajor} onChange={(event) => setDraft({ ...draft, examMajor: event.target.value })}>
                <option value="">همهٔ رشته‌ها</option>
                {TRACKS.map((track) => (
                  <option key={track.value} value={track.value}>{track.label}</option>
                ))}
              </select>
            </label>

            <label className="qb-field">
              <span>سال کنکور</span>
              <select value={draft.examYear} onChange={(event) => setDraft({ ...draft, examYear: event.target.value })}>
                <option value="">همهٔ سال‌ها</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>{toPersianDigits(year)}</option>
                ))}
              </select>
            </label>

            <button type="submit" className="qb-apply">اعمال</button>
            {activeCount > 0 && (
              <button type="button" className="qb-clear" onClick={clear}>پاک کردن همهٔ فیلترها</button>
            )}

            <fieldset className="qb-subjects">
              <legend>درس</legend>
              <button type="button" aria-pressed={applied.subjectCode === ""} onClick={() => pick({ subjectCode: "", chapter: "", topic: "" })}>
                <span>همهٔ درس‌ها</span>
              </button>
              {subjectList.main.map(subjectButton)}
              {subjectList.outside.length > 0 && (
                <>
                  <p className="qb-subjects-note">خارج از کنکور ۱۴۰۶</p>
                  {subjectList.outside.map(subjectButton)}
                </>
              )}
            </fieldset>

            {tree.length > 0 && (
              <fieldset className="qb-tree">
                <legend>سرفصل {titleOf(applied.subjectCode)}</legend>
                <button type="button" aria-pressed={!applied.chapter && !applied.topic} onClick={() => pick({ chapter: "", topic: "" })}>
                  <span>همهٔ فصل‌ها</span>
                </button>
                {tree.map((chapter) => {
                  const codes = chapter.topics.map((topic) => topic.code);
                  const n = chapterCount(codes);
                  if (counts && n === 0) return null;
                  const open = openChapter === chapter.code;
                  return (
                    <div className="qb-chapter" key={chapter.code} data-off={chapter.offSyllabus || undefined}>
                      <button type="button" aria-pressed={applied.chapter === chapter.code && !applied.topic} aria-expanded={open} onClick={() => pick({ chapter: chapter.code, topic: "" })}>
                        <span>{chapter.title}</span>
                        {counts && <span className="qb-count tnum">{toPersianDigits(n)}</span>}
                      </button>
                      {open && (
                        <div className="qb-topics">
                          {chapter.topics
                            .filter((topic) => !counts || topicCount(topic.code) > 0)
                            .map((topic) => (
                              <button type="button" key={topic.code} aria-pressed={applied.topic === topic.code} onClick={() => pick({ chapter: chapter.code, topic: topic.code })}>
                                <span>{topic.title}</span>
                                {counts && <span className="qb-count tnum">{toPersianDigits(topicCount(topic.code))}</span>}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}
          </form>
        </aside>

        <section className="qb-main" aria-labelledby="qb-count">
          {filling && (
            <p className="soon-banner" role="status">
              <span className="soon-pill">به‌زودی</span>
              بانک سؤال در حال تکمیل است؛ تست‌های کنکور سال‌های قبل درس‌به‌درس و مبحث‌به‌مبحث اضافه می‌شوند.
            </p>
          )}

          <div className="qb-bar">
            <p id="qb-count">
              {loading ? "در حال جست‌وجو…" : `${toPersianDigits(total)} سؤال`}
              {applied.subjectCode ? ` · ${titleOf(applied.subjectCode)}` : ""}
              {place ? ` · ${place.topic.title}` : applied.chapter ? ` · ${tree.find((chapter) => chapter.code === applied.chapter)?.title ?? ""}` : ""}
              {applied.examMajor ? ` · ${fieldLabel(applied.examMajor)}` : ""}
              {applied.examYear ? ` · کنکور ${toPersianDigits(applied.examYear)}` : ""}
            </p>
          </div>

          <DataState
            loading={loading}
            error={error}
            isEmpty={items.length === 0}
            onRetry={search}
            emptyTitle="سؤالی با این فیلترها نیست"
            emptyDescription="فیلترها را کمتر کن یا همه را پاک کن."
            skeletonRows={8}
          >
            <ol className="qb-list" start={firstIndex + 1}>
              {items.map((question, index) => {
                const stem = question.stemBlocks?.find((block) => block.type === "text")?.text;
                const where = topicPlace(question.subjectCode, question.topicCodes?.[0]);
                return (
                  <li key={question.id}>
                    <Link className="qb-row" href={`/questions/${question.id}`}>
                      <span className="qb-n tnum" aria-hidden="true">{toPersianDigits(firstIndex + index + 1)}</span>
                      <span className="qb-body">
                        <span className="qb-stem" data-locked={!stem || undefined}>
                          {stem ?? "متن این سؤال با دسترسی بانک این درس نمایش داده می‌شود."}
                        </span>
                        <span className="qb-meta">
                          <span>
                            کنکور {question.examDegree === "PHD" ? "دکتری " : ""}
                            {toPersianDigits(question.examYear)}
                            {question.questionNumber ? ` · سؤال ${toPersianDigits(question.questionNumber)}` : ""}
                          </span>
                          <span>{fieldLabel(question.examMajor)}</span>
                          <span>{where ? where.topic.title : titleOf(question.subjectCode)}</span>
                          {where?.chapter.offSyllabus && <span>خارج از سرفصل ۱۴۰۶</span>}
                        </span>
                      </span>
                      {(question.isSample || !stem) && (
                        <span className="qb-access" data-free={question.isSample || undefined}>
                          {question.isSample ? "نمونهٔ رایگان" : "قفل"}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>

            {total > PAGE_SIZE && (
              <div className="qb-pages">
                <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
              </div>
            )}
          </DataState>
        </section>
      </div>
    </main>
  );
}
