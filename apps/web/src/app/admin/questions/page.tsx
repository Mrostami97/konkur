"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Field,
  FieldRow,
  Input,
  Pagination,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";

const PAGE_SIZE = 20;

/** Locked rows carry metadata only; a sample carries its body too. Both
 * shapes come back from the same list endpoint, so every body field is
 * optional here. */
type QuestionRow = {
  id: string;
  externalId: string;
  subjectCode: string;
  examMajor: string;
  examYear: number;
  examDegree: string;
  topicCodes: string[];
  isSample: boolean;
  version: number;
};

function QuestionList() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [subjectCode, setSubjectCode] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ subjectCode: "", query: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied.subjectCode) params.set("subjectCode", applied.subjectCode);
      if (applied.query) params.set("q", applied.query);
      const data = await apiFetch<{ items: QuestionRow[]; total: number }>(`/questions?${params}`);
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست سؤال‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card padded={false}>
      <div className="ds-card-head">
        <form
          className="ds-row"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setApplied({ subjectCode, query });
          }}
        >
          <div className="ds-grow" style={{ minWidth: "12rem" }}>
            <Input
              placeholder="جست‌وجو در کد درس، گرایش یا مبحث"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="جست‌وجو"
            />
          </div>
          <div style={{ width: "12rem" }}>
            <Input
              placeholder="کد درس"
              value={subjectCode}
              onChange={(event) => setSubjectCode(event.target.value)}
              aria-label="کد درس"
            />
          </div>
          <Button type="submit" variant="primary">
            اعمال
          </Button>
          {(applied.subjectCode || applied.query) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSubjectCode("");
                setQuery("");
                setApplied({ subjectCode: "", query: "" });
                setPage(1);
              }}
            >
              پاک کردن
            </Button>
          )}
        </form>
      </div>

      <div style={{ padding: rows.length && !loading && !error ? 0 : "var(--sp-4)" }}>
        <DataState
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          onRetry={load}
          emptyTitle="سؤالی یافت نشد"
          emptyDescription="با این فیلترها سؤالی وجود ندارد. می‌توانید فیلترها را پاک کنید یا از فرم زیر سؤال تازه ثبت کنید."
          skeletonRows={6}
        >
          <TableWrap
            pagination={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
          >
            <thead>
              <tr>
                <th>شناسه بیرونی</th>
                <th>درس</th>
                <th>گرایش</th>
                <th>سال</th>
                <th>مبحث‌ها</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/questions/${row.id}`} className="text-link">
                      {row.externalId}
                    </Link>
                  </td>
                  <td>{row.subjectCode}</td>
                  <td>{row.examMajor}</td>
                  <td className="ds-table-numeric">{row.examYear}</td>
                  <td style={{ color: "var(--muted)" }}>{row.topicCodes.join("، ") || "—"}</td>
                  <td>
                    {row.isSample ? <Badge tone="success">نمونهٔ عمومی</Badge> : <Badge>قفل</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </DataState>
      </div>
    </Card>
  );
}

function AuthorQuestion({ onCreated }: { onCreated: () => void }) {
  const [externalId, setExternalId] = useState("");
  const [degree, setDegree] = useState<"master" | "phd">("master");
  const [major, setMajor] = useState("computer-engineering");
  const [year, setYear] = useState("1405");
  const [subjectCode, setSubjectCode] = useState("");
  const [topicCodes, setTopicCodes] = useState("");
  const [stem, setStem] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(1);
  const [solution, setSolution] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const job = await apiFetch<{ id: string }>("/admin/questions", {
        method: "POST",
        body: {
          external_id: externalId,
          exam: { degree, major, year: Number(year) },
          subject_code: subjectCode,
          topic_codes: topicCodes.split(",").map((code) => code.trim()).filter(Boolean),
          stem_blocks: [{ type: "text", text: stem }],
          options: options.map((text, index) => ({ number: index + 1, blocks: [{ type: "text", text }] })),
          correct_option: correctOption,
          solution_blocks: [{ type: "text", text: solution }],
        },
      });
      setResult(`سؤال در وظیفهٔ ${job.id} ثبت شد. برای بررسی و انتشار به «ورود داده» بروید.`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت سؤال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
        ثبت سؤال تازه
      </h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        این فرم همان مسیر بررسی و انتشارِ بارگذاری zip را طی می‌کند. پس از ثبت، سؤال در{" "}
        <Link href="/admin/import" className="text-link">
          ورود داده
        </Link>{" "}
        منتظر تأیید می‌ماند و تا آن زمان منتشر نمی‌شود.
      </p>

      <form onSubmit={submit} className="ds-stack">
        <FieldRow>
          <Field label="شناسه بیرونی" hint="شناسهٔ یکتا برای جلوگیری از ثبت تکراری" required>
            {(props) => (
              <Input {...props} value={externalId} onChange={(event) => setExternalId(event.target.value)} required />
            )}
          </Field>
          <Field label="مقطع" required>
            {(props) => (
              <Select {...props} value={degree} onChange={(event) => setDegree(event.target.value as "master" | "phd")}>
                <option value="master">ارشد</option>
                <option value="phd">دکتری</option>
              </Select>
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="گرایش" required>
            {(props) => <Input {...props} value={major} onChange={(event) => setMajor(event.target.value)} required />}
          </Field>
          <Field label="سال کنکور" required>
            {(props) => (
              <Input {...props} value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" required />
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="کد درس" hint="مثلاً data-structures" required>
            {(props) => (
              <Input {...props} value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} required />
            )}
          </Field>
          <Field label="کد مبحث‌ها" hint="چند مبحث را با کاما جدا کنید" required>
            {(props) => (
              <Input {...props} value={topicCodes} onChange={(event) => setTopicCodes(event.target.value)} required />
            )}
          </Field>
        </FieldRow>

        <Field label="متن سؤال" required>
          {(props) => <Textarea {...props} value={stem} onChange={(event) => setStem(event.target.value)} required />}
        </Field>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="ds-label" style={{ padding: 0 }}>
            گزینه‌ها — گزینهٔ صحیح را علامت بزنید
          </legend>
          <div className="ds-stack-sm">
            {options.map((option, index) => (
              <label key={index} className="ds-checkbox-row">
                <input
                  type="radio"
                  name="correct"
                  checked={correctOption === index + 1}
                  onChange={() => setCorrectOption(index + 1)}
                  aria-label={`گزینهٔ ${index + 1} پاسخ صحیح است`}
                />
                <span className="ds-grow">
                  <Input
                    placeholder={`گزینهٔ ${index + 1}`}
                    value={option}
                    onChange={(event) =>
                      setOptions(options.map((current, position) => (position === index ? event.target.value : current)))
                    }
                    required
                  />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="راه‌حل" hint="برای دارندگان دسترسی بانک سؤال نمایش داده می‌شود" required>
          {(props) => <Textarea {...props} value={solution} onChange={(event) => setSolution(event.target.value)} required />}
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}
        {result && <Alert tone="success">{result}</Alert>}

        <div>
          <Button type="submit" variant="primary" loading={busy}>
            ثبت سؤال
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminQuestionsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <AdminPageHeader
        title="بانک سؤال"
        description="فهرست سؤال‌های منتشرشده و ثبت سؤال تازه. سؤال‌های «نمونهٔ عمومی» برای همه قابل مشاهده‌اند؛ بقیه به دسترسی بانک همان درس نیاز دارند."
      />
      <div className="ds-stack-lg">
        <QuestionList key={refreshKey} />
        <AuthorQuestion onCreated={() => setRefreshKey((key) => key + 1)} />
      </div>
    </>
  );
}
