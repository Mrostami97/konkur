"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { MIN_QUESTIONS_FOR_BANK, useAvailability } from "../../lib/availability";
import { toPersianDigits } from "../../lib/format";
import { Badge, Button, DataState, Input, Pagination, Select } from "../../components/ds";

interface Subject { code: string; title: string }
interface Block { type: string; text?: string }

/**
 * A locked question carries metadata only — the API decides server-side how
 * much of a question a caller may see, so everything below `version` is
 * optional here and a row must never assume a stem exists.
 */
interface Question {
  id: string;
  subjectCode: string;
  examMajor: string;
  examYear: number;
  isSample: boolean;
  stemBlocks?: Block[];
}

const PAGE_SIZE = 20;

export default function QuestionBankPage() {
  const availability = useAvailability();
  // A handful of questions is a bank still being filled; say so rather than
  // let a near-empty list read as the whole product.
  const filling = availability !== null && availability.questions < MIN_QUESTIONS_FOR_BANK;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectCode, setSubjectCode] = useState("");
  const [examYear, setExamYear] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ subjectCode: "", examYear: "", query: "" });
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Subject[]>("/subjects").then(setSubjects).catch(() => setSubjects([]));
  }, []);

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

  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied({ subjectCode, examYear, query });
  }

  function clear() {
    setSubjectCode("");
    setExamYear("");
    setQuery("");
    setApplied({ subjectCode: "", examYear: "", query: "" });
    setPage(1);
  }

  const hasFilters = applied.subjectCode || applied.examYear || applied.query;

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">بانک سؤال</p>
          <h1>سؤال‌های کنکور، درس به درس</h1>
          <p className="pg-lede">
            سؤال‌های نمونه برای همه باز است. متن و پاسخ بقیهٔ سؤال‌ها به دسترسی بانک همان درس نیاز دارد.
          </p>
        </div>
      </div>

      <section className="pg-shell pg-sec">
        {filling && (
          <p className="soon-banner" role="status">
            <span className="soon-pill">به‌زودی</span>
            بانک سؤال در حال تکمیل است؛ تست‌های کنکور سال‌های قبل درس‌به‌درس و مبحث‌به‌مبحث به‌زودی اضافه می‌شوند.
          </p>
        )}
        <form onSubmit={apply} className="ds-row" style={{ marginBottom: "var(--sp-6)" }}>
          <div style={{ minWidth: "12rem" }}>
            <Select value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} aria-label="درس">
              <option value="">همهٔ درس‌ها</option>
              {subjects.map((subject) => (
                <option key={subject.code} value={subject.code}>{subject.title}</option>
              ))}
            </Select>
          </div>
          <div style={{ width: "9rem" }}>
            <Input
              placeholder="سال کنکور"
              value={examYear}
              onChange={(event) => setExamYear(event.target.value)}
              inputMode="numeric"
              aria-label="سال کنکور"
            />
          </div>
          <div className="ds-grow" style={{ minWidth: "12rem" }}>
            <Input
              placeholder="جست‌وجو در کد درس، گرایش یا مبحث"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="جست‌وجو"
            />
          </div>
          <Button type="submit" variant="primary">جست‌وجو</Button>
          {hasFilters && <Button variant="ghost" onClick={clear}>پاک کردن</Button>}
        </form>

        <DataState
          loading={loading}
          error={error}
          isEmpty={items.length === 0}
          onRetry={search}
          emptyTitle="سؤالی یافت نشد"
          emptyDescription="با این فیلترها سؤالی وجود ندارد. می‌توانید فیلترها را پاک کنید."
          skeletonRows={6}
        >
          <p className="pg-card-meta" style={{ marginBottom: "var(--sp-4)" }}>
            {toPersianDigits(total)} سؤال یافت شد
          </p>

          <div className="pg-grid" style={{ ["--pg-min" as string]: "20rem" }}>
            {items.map((question) => {
              const stem = question.stemBlocks?.find((block) => block.type === "text")?.text;
              return (
                <Link className="pg-card" href={`/questions/${question.id}`} key={question.id}>
                  <span className="ds-row-between">
                    <span className="pg-card-meta">
                      {question.subjectCode} · {question.examMajor} · {toPersianDigits(question.examYear)}
                    </span>
                    {question.isSample
                      ? <Badge tone="success">نمونهٔ آزاد</Badge>
                      : <Badge>قفل</Badge>}
                  </span>
                  <b>
                    {stem
                      ? stem.slice(0, 140)
                      : "متن این سؤال با دسترسی بانک این درس نمایش داده می‌شود."}
                  </b>
                </Link>
              );
            })}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ marginTop: "var(--sp-6)" }}>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          )}
        </DataState>
      </section>
    </main>
  );
}
