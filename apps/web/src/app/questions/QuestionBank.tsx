"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { MIN_QUESTIONS_FOR_BANK, useAvailability } from "../../lib/availability";
import { toPersianDigits } from "../../lib/format";
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
  examYear: number;
  isSample: boolean;
  topicCodes?: string[];
  stemBlocks?: Block[];
}

const PAGE_SIZE = 20;
/** Konkur years a question can come from, newest first. */
const YEARS = Array.from({ length: 16 }, (_, index) => 1405 - index);

/**
 * The bank as a study tool: filters stay put on the side, questions are a
 * dense list you scan and open one after another -- the shape of an index,
 * not a catalogue of cards.
 */
export function QuestionBank({ catalog, initialSubject = "" }: { catalog: SubjectOption[]; initialSubject?: string }) {
  const availability = useAvailability();
  const filling = availability !== null && availability.questions < MIN_QUESTIONS_FOR_BANK;

  const [apiSubjects, setApiSubjects] = useState<SubjectOption[]>([]);
  const [subjectCode, setSubjectCode] = useState(initialSubject);
  const [examYear, setExamYear] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ subjectCode: initialSubject, examYear: "", query: "" });
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SubjectOption[]>("/subjects").then(setApiSubjects).catch(() => setApiSubjects([]));
  }, []);

  // The taxonomy's own subjects when it has them; the editorial list names
  // the same codes otherwise.
  const subjects = apiSubjects.length > 0 ? apiSubjects : catalog;
  const titleOf = useMemo(() => {
    const map = new Map<string, string>();
    [...catalog, ...apiSubjects].forEach((subject) => map.set(subject.code, subject.title));
    return (code: string) => map.get(code) ?? code;
  }, [catalog, apiSubjects]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied.subjectCode) params.set("subjectCode", applied.subjectCode);
      if (applied.examYear) params.set("examYear", applied.examYear);
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

  function apply(event?: FormEvent) {
    event?.preventDefault();
    setPage(1);
    setApplied({ subjectCode, examYear, query });
    setFiltersOpen(false);
  }

  function pickSubject(code: string) {
    setSubjectCode(code);
    setPage(1);
    setApplied((previous) => ({ ...previous, subjectCode: code }));
  }

  function clear() {
    setSubjectCode("");
    setExamYear("");
    setQuery("");
    setApplied({ subjectCode: "", examYear: "", query: "" });
    setPage(1);
  }

  const activeCount = [applied.subjectCode, applied.examYear, applied.query].filter(Boolean).length;
  const firstIndex = (page - 1) * PAGE_SIZE;

  return (
    <main className="qb">
      <header className="qb-top">
        <div className="qb-wrap">
          <p className="qb-kicker">بانک سؤال</p>
          <h1>تست‌های کنکور، درس‌به‌درس</h1>
          <p>سؤال‌های نمونه برای همه باز است؛ متن و پاسخ بقیه با دسترسی بانک همان درس نمایش داده می‌شود.</p>
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
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="متن، مبحث یا کد درس"
              />
            </label>

            <label className="qb-field">
              <span>سال کنکور</span>
              <select value={examYear} onChange={(event) => setExamYear(event.target.value)}>
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
              <button type="button" aria-pressed={applied.subjectCode === ""} onClick={() => pickSubject("")}>
                همهٔ درس‌ها
              </button>
              {subjects.map((subject) => (
                <button
                  type="button"
                  key={subject.code}
                  aria-pressed={applied.subjectCode === subject.code}
                  onClick={() => pickSubject(subject.code)}
                >
                  {subject.title}
                </button>
              ))}
            </fieldset>
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
                return (
                  <li key={question.id}>
                    <Link className="qb-row" href={`/questions/${question.id}`}>
                      <span className="qb-n tnum" aria-hidden="true">{toPersianDigits(firstIndex + index + 1)}</span>
                      <span className="qb-body">
                        <span className="qb-stem" data-locked={!stem || undefined}>
                          {stem ?? "متن این سؤال با دسترسی بانک این درس نمایش داده می‌شود."}
                        </span>
                        <span className="qb-meta">
                          <span>{titleOf(question.subjectCode)}</span>
                          <span>{fieldLabel(question.examMajor)}</span>
                          <span>کنکور {toPersianDigits(question.examYear)}</span>
                        </span>
                      </span>
                      <span className="qb-access" data-free={question.isSample || undefined}>
                        {question.isSample ? "نمونهٔ رایگان" : "قفل"}
                      </span>
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
