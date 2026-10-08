"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  Field,
  FieldRow,
  Input,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";

interface Exam {
  id: string;
  slug: string;
  title: string;
  mode: "STATIC" | "DYNAMIC";
  isPublished: boolean;
  subjectCode?: string | null;
  forms: { _count: { items: number } }[];
  _count?: { attempts: number };
}

interface SubjectOption { code: string; title: string }

interface ExamDetail {
  _count: { attempts: number };
  forms: {
    items: {
      id: string;
      order: number;
      question: { id: string; externalId: string; subjectCode: string; examYear: number; stemBlocks: unknown; retiredAt: string | null };
    }[];
  }[];
}

/** The first line of a question's text, so an item is recognisable in a list. */
function stemPreview(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  for (const block of blocks) {
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type === "text" && typeof candidate.text === "string") {
      const text = candidate.text.replace(/\s+/g, " ").trim();
      return text.length > 90 ? `${text.slice(0, 90)}…` : text;
    }
  }
  return "";
}

interface QuestionRow {
  id: string;
  externalId: string;
  subjectCode: string;
  examMajor: string;
  examYear: number;
}

interface Psychometrics {
  attemptCount: number;
  items: { questionId: string; difficulty: number; discrimination: number; sampleSize: number }[];
}

/**
 * Before this existed the only way to add a question was to paste its raw
 * UUID, and nothing in the panel listed those ids — so the exam builder was
 * effectively unusable. This searches the admin question list, which
 * already supports subject and free-text filters; retired questions are left out.
 */
function QuestionPicker({
  examId,
  nextOrder,
  subjects,
  subjectTitle,
  onAdded,
}: {
  examId: string;
  nextOrder: number;
  subjects: SubjectOption[];
  subjectTitle: (code: string) => string;
  onAdded: () => void;
}) {
  const [subjectCode, setSubjectCode] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: "10" });
      if (subjectCode) params.set("subjectCode", subjectCode);
      if (query) params.set("q", query);
      const data = await apiFetch<{ items: QuestionRow[] }>(`/admin/questions?${params}`);
      setRows(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "جست‌وجوی سؤال ممکن نشد.");
    } finally {
      setSearching(false);
    }
  }

  async function add(questionId: string) {
    setAddingId(questionId);
    setError(null);
    try {
      await apiFetch(`/admin/exams/${examId}/items`, { method: "POST", body: { questionId, order: nextOrder } });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "افزودن سؤال ناموفق بود.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="ds-stack">
      <form onSubmit={search} className="ds-row">
        <div style={{ width: "13rem" }}>
          <Select value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} aria-label="درس">
            <option value="">همهٔ درس‌ها</option>
            {subjects.map((subject) => <option key={subject.code} value={subject.code}>{subject.title}</option>)}
          </Select>
        </div>
        <div className="ds-grow" style={{ minWidth: "10rem" }}>
          <Input placeholder="جست‌وجو در شناسه، گرایش یا کد مبحث" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجو" />
        </div>
        <Button type="submit" loading={searching}>جست‌وجو</Button>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}

      {rows.length > 0 && (
        <TableWrap>
          <thead><tr><th>شناسه بیرونی</th><th>درس</th><th>سال</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="ds-code">{row.externalId}</td>
                <td>{subjectTitle(row.subjectCode)}</td>
                <td className="ds-table-numeric">{toPersianDigits(row.examYear)}</td>
                <td>
                  <Button size="sm" variant="primary" loading={addingId === row.id} onClick={() => add(row.id)}>
                    افزودن
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}

/** The exam's questions in order, with removal while nobody has sat it. */
function ExamItems({
  exam,
  subjects,
  subjectTitle,
  onChanged,
}: {
  exam: Exam;
  subjects: SubjectOption[];
  subjectTitle: (code: string) => string;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await apiFetch<ExamDetail>(`/admin/exams/${exam.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن سؤال‌های آزمون ممکن نشد.");
    }
  }, [exam.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(itemId: string) {
    setRemoving(itemId);
    setError(null);
    try {
      await apiFetch(`/admin/exams/${exam.id}/items/${itemId}`, { method: "DELETE" });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "برداشتن سؤال ممکن نشد.");
    } finally {
      setRemoving(null);
    }
  }

  const items = detail?.forms[0]?.items ?? [];
  const locked = (detail?._count.attempts ?? 0) > 0;

  return (
    <div className="ds-stack">
      {error && <Alert tone="danger">{error}</Alert>}
      {exam.mode === "STATIC" && (
        <>
          <h3 className="ds-label" style={{ margin: 0 }}>سؤال‌های این آزمون</h3>
          {locked && (
            <Alert tone="info">
              این آزمون {toPersianDigits(detail!._count.attempts)} شرکت‌کننده داشته؛ سؤال‌هایش ثابت می‌مانند تا کارنامه‌های قبلی معتبر بمانند.
            </Alert>
          )}
          {detail === null ? (
            <p className="ds-hint">در حال خواندن…</p>
          ) : items.length === 0 ? (
            <p className="ds-hint">هنوز سؤالی اضافه نشده. از جست‌وجوی زیر سؤال بیاورید.</p>
          ) : (
            <TableWrap>
              <thead><tr><th>#</th><th>سؤال</th><th>درس</th><th /></tr></thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="ds-table-numeric">{toPersianDigits(index + 1)}</td>
                    <td>
                      <div>{stemPreview(item.question.stemBlocks) || item.question.externalId}</div>
                      <div className="ds-code" style={{ color: "var(--muted)", fontSize: "var(--text-xs)" }}>
                        {item.question.externalId}
                        {item.question.retiredAt && " · بازنشسته"}
                      </div>
                    </td>
                    <td>{subjectTitle(item.question.subjectCode)}</td>
                    <td>
                      <Button size="sm" variant="ghost" disabled={locked} loading={removing === item.id} onClick={() => void remove(item.id)}>
                        برداشتن
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {!locked && (
            <QuestionPicker
              examId={exam.id}
              nextOrder={items.length + 1}
              subjects={subjects}
              subjectTitle={subjectTitle}
              onAdded={() => {
                void load();
                onChanged();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function PsychometricsPanel({ examId }: { examId: string }) {
  const [data, setData] = useState<Psychometrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data || loading) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<Psychometrics>(`/admin/exams/${examId}/psychometrics`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن روان‌سنجی ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="ds-details" onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) void load(); }}>
      <summary>روان‌سنجی سؤال‌ها</summary>
      <div className="ds-details-body">
        {loading && <p className="ds-subtitle">در حال خواندن…</p>}
        {error && <Alert tone="danger">{error}</Alert>}
        {data && (data.items.length === 0 ? (
          <p className="ds-subtitle">هنوز تلاشی روی این آزمون ثبت نشده، پس آماری محاسبه نشده است.</p>
        ) : (
          <>
            <p className="ds-subtitle">تلاش ثبت‌شده: {toPersianDigits(data.attemptCount)}</p>
            <TableWrap>
              <thead><tr><th>سؤال</th><th>دشواری</th><th>تمایز</th><th>نمونه</th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.questionId}>
                    <td className="ds-code">{item.questionId.slice(0, 8)}…</td>
                    <td className="ds-table-numeric">{toPersianDigits(item.difficulty.toFixed(2))}</td>
                    <td className="ds-table-numeric">{toPersianDigits(item.discrimination.toFixed(2))}</td>
                    <td className="ds-table-numeric">{toPersianDigits(item.sampleSize)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        ))}
      </div>
    </details>
  );
}

interface ExamYear {
  examCode: string;
  examYear: number;
  GOLD: number;
  SILVER: number;
  DRAFT: number;
}

/**
 * A simulator of one real exam year, built from that year's reviewed
 * questions in booklet order and the konkur's sections. Its report card
 * estimates the rank the same percentages earned that year.
 */
/** The master's exams the bank holds, by code. */
const EXAM_NAMES: Record<string, string> = { "1277": "مهندسی کامپیوتر", "1276": "فناوری اطلاعات", "1209": "علوم کامپیوتر" };
const examName = (code: string) => EXAM_NAMES[code] ?? `کد ${toPersianDigits(Number(code))}`;

function SimulatorBuilder({ onBuilt }: { onBuilt: () => void }) {
  const [years, setYears] = useState<ExamYear[] | null>(null);
  const [selected, setSelected] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    apiFetch<ExamYear[]>("/admin/questions/review-summary")
      .then((rows) => setYears(rows.filter((row) => row.GOLD + row.SILVER > 0)))
      .catch(() => setYears(null));
  }, []);

  const year = years?.find((row) => `${row.examCode}-${row.examYear}` === selected) ?? null;
  const ready = year ? year.GOLD + year.SILVER : 0;

  async function build(event: FormEvent) {
    event.preventDefault();
    if (!year) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const built = await apiFetch<{ title: string; questions: number; inBooklet: number }>("/admin/exams/simulators", {
        method: "POST",
        body: { examCode: year.examCode, examYear: year.examYear, durationMinutes: Number(minutes) },
      });
      setNotice(
        `«${built.title}» با ${toPersianDigits(built.questions)} سؤال ساخته شد${built.inBooklet > built.questions ? ` (${toPersianDigits(built.inBooklet - built.questions)} سؤال این سال هنوز بازبینی نشده و در آن نیست)` : ""}. از فهرست پایین منتشرش کن.`,
      );
      onBuilt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت شبیه‌ساز ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  /** Every year with reviewed questions at once; none is published by this. */
  async function buildAll() {
    setAllBusy(true);
    setError(null);
    setNotice(null);
    try {
      const results = await apiFetch<{ examCode: string; examYear: number; status: "built" | "rebuilt" | "frozen"; questions: number }[]>(
        "/admin/exams/simulators/all",
        { method: "POST" },
      );
      const made = results.filter((row) => row.status !== "frozen");
      const frozen = results.length - made.length;
      setNotice(
        `${toPersianDigits(made.length)} شبیه‌ساز ساخته یا به‌روز شد` +
          (frozen ? `؛ ${toPersianDigits(frozen)} شبیه‌ساز شرکت‌کننده داشت و دست نخورد` : "") +
          ". هیچ‌کدام منتشر نشده‌اند؛ زمان هر کدام یک‌ونیم دقیقه برای هر سؤال است و از فهرست پایین می‌توانی زمان را عوض کنی و منتشر کنی.",
      );
      onBuilt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت شبیه‌سازها ممکن نشد.");
    } finally {
      setAllBusy(false);
      setConfirmAll(false);
    }
  }

  // Only reviewers and admins can read the review summary; others skip this card.
  if (years === null) return null;
  return (
    <Card>
      <h2 className="ds-card-title">شبیه‌ساز کنکور یک سال</h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
        سؤال‌های بازبینی‌شدهٔ یک کنکور، به ترتیب دفترچه و در بخش‌های کنکور. کارنامه‌اش درصد و تراز هر بخش را می‌دهد و رتبهٔ تقریبی آن سال
        را از روی کارنامه‌های واقعی تخمین می‌زند. تا وقتی کسی در آن شرکت نکرده، ساختن دوباره‌اش همان آزمون را به‌روز می‌کند.
      </p>
      {years.length === 0 ? (
        <Alert tone="info">هنوز سالی سؤال آمادهٔ آزمون ندارد؛ اول در «بازبینی سؤال‌های کنکور» کلید سال‌ها را تأیید کن.</Alert>
      ) : (
        <form className="ds-form" onSubmit={build}>
          <FieldRow>
            <Field label="کنکور" required>
              {(props) => (
                <Select
                  {...props}
                  value={selected}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    const row = years.find((item) => `${item.examCode}-${item.examYear}` === event.target.value);
                    if (row && !minutes) setMinutes(String(Math.round((row.GOLD + row.SILVER) * 1.5)));
                  }}
                  required
                >
                  <option value="">انتخاب سال</option>
                  {years.map((row) => (
                    <option key={`${row.examCode}-${row.examYear}`} value={`${row.examCode}-${row.examYear}`}>
                      {examName(row.examCode)} {toPersianDigits(row.examYear)} · {toPersianDigits(row.GOLD + row.SILVER)} سؤال آماده
                      {row.DRAFT > 0 ? ` · ${toPersianDigits(row.DRAFT)} در انتظار بازبینی` : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="زمان آزمون (دقیقه)" hint="زمان واقعی دفترچهٔ همان سال را بگذار؛ پیش‌فرض یک‌ونیم دقیقه برای هر سؤال است" required>
              {(props) => <Input {...props} type="number" min={10} max={600} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />}
            </Field>
          </FieldRow>
          {year && year.DRAFT > 0 && (
            <Alert tone="warning">
              {toPersianDigits(year.DRAFT)} سؤال این سال هنوز بازبینی نشده و در شبیه‌ساز نمی‌آید؛ شبیه‌ساز {toPersianDigits(ready)} سؤال خواهد داشت.
            </Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          <div className="ds-row">
            <Button type="submit" variant="primary" loading={busy} disabled={!year || !minutes}>
              ساخت شبیه‌ساز
            </Button>
            <Button type="button" loading={allBusy} disabled={busy} onClick={() => setConfirmAll(true)}>
              ساخت شبیه‌ساز همهٔ سال‌ها ({toPersianDigits(years.length)})
            </Button>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={confirmAll}
        title="ساخت شبیه‌ساز همهٔ سال‌ها؟"
        description={`برای هر ${toPersianDigits(years.length)} کنکوری که سؤال بازبینی‌شده دارد شبیه‌ساز ساخته یا به‌روز می‌شود؛ شبیه‌سازی که شرکت‌کننده داشته دست نمی‌خورد. هیچ‌کدام منتشر نمی‌شود: شبیه‌ساز منتشرشده سؤال‌ها و کلیدش را به شرکت‌کننده نشان می‌دهد، پس انتشار هر کدام تصمیم جداست.`}
        confirmLabel="بساز"
        busy={allBusy}
        onConfirm={() => void buildAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </Card>
  );
}

/**
 * A 1406-style exam drawn from the bank: language and mathematics as in
 * 1405, ten questions from each specialised subject (computer science keeps
 * its own structure), questions no earlier mock of the track used first.
 */
function MockBuilder({ onBuilt }: { onBuilt: () => void }) {
  const [track, setTrack] = useState<"1277" | "1276" | "1209">("1277");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function build(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const built = await apiFetch<{ title: string; questions: number; durationMinutes: number; short: string[] }>("/admin/exams/mock-1406", {
        method: "POST",
        body: { track },
      });
      setNotice(
        `«${built.title}» با ${toPersianDigits(built.questions)} سؤال و ${toPersianDigits(built.durationMinutes)} دقیقه ساخته شد` +
          (built.short.length ? `؛ بانک برای بعضی درس‌ها سؤال کافی نداشت (${built.short.map((row) => toPersianDigits(row)).join("، ")})` : "") +
          ". از فهرست پایین مرورش کن و منتشرش کن.",
      );
      onBuilt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت آزمون ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="ds-card-title">آزمون جامع به سبک کنکور ۱۴۰۶</h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
        از بانک، با درس‌ها و ضرایب ۱۴۰۶: زبان ۲۵ سؤال و ریاضیات ۲۰ سؤال مثل ۱۴۰۵، و از هر درس بخش تخصصی ۱۰ سؤال. علوم کامپیوتر ساختار
        سال‌های قبلش را دارد. هر بار یک آزمون تازه با شمارهٔ بعدی ساخته می‌شود و اول سؤال‌هایی می‌آیند که در آزمون‌های جامع قبلی نبوده‌اند.
        آزمون منتشرنشده ساخته می‌شود.
      </p>
      <form className="ds-form" onSubmit={build}>
        <Field label="رشته" required>
          {(props) => (
            <Select {...props} value={track} onChange={(event) => setTrack(event.target.value as "1277" | "1276" | "1209")}>
              <option value="1277">ارشد مهندسی کامپیوتر (۱۲۷۷)</option>
              <option value="1276">ارشد فناوری اطلاعات (۱۲۷۶)</option>
              <option value="1209">ارشد علوم کامپیوتر (۱۲۰۹)</option>
            </Select>
          )}
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <div>
          <Button type="submit" variant="primary" loading={busy}>ساخت آزمون جامع تازه</Button>
        </div>
      </form>
    </Card>
  );
}

export function ExamsAdmin({ subjects }: { subjects: SubjectOption[] }) {
  const subjectTitle = useMemo(() => {
    const names = new Map(subjects.map((subject) => [subject.code, subject.title]));
    return (code: string) => names.get(code) ?? code;
  }, [subjects]);
  const [examAction, setExamAction] = useState<{ exam: Exam; kind: "unpublish" | "delete" } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"STATIC" | "DYNAMIC">("STATIC");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [subjectCode, setSubjectCode] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<Exam | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExams(await apiFetch<Exam[]>("/admin/exams"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست آزمون‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createExam(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await apiFetch("/admin/exams", {
        method: "POST",
        body: {
          slug,
          title,
          description,
          mode,
          durationMinutes: Number(durationMinutes),
          ...(mode === "DYNAMIC" ? { subjectCode, questionCount: Number(questionCount) } : {}),
        },
      });
      setSlug("");
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "ساخت آزمون ناموفق بود.");
    } finally {
      setCreating(false);
    }
  }

  async function runExamAction() {
    const action = examAction;
    if (!action) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (action.kind === "unpublish") {
        await apiFetch(`/admin/exams/${action.exam.id}/unpublish`, { method: "POST" });
      } else {
        await apiFetch(`/admin/exams/${action.exam.id}`, { method: "DELETE" });
      }
      setExamAction(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
      setExamAction(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function publish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await apiFetch(`/admin/exams/${publishTarget.id}/publish`, { method: "POST" });
      setPublishTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "انتشار آزمون ناموفق بود.");
      setPublishTarget(null);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="آزمون‌ها"
        description="آزمون ثابت سؤال‌هایش را دستی می‌گیرد؛ آزمون پویا در لحظهٔ شروع از بانک همان درس سؤال برمی‌دارد."
      />

      <div className="ds-stack-lg">
        <MockBuilder onBuilt={() => void load()} />
        <SimulatorBuilder onBuilt={() => void load()} />
        <Card>
          <h2 className="ds-card-title">آزمون تازه</h2>
          <form onSubmit={createExam} className="ds-form">
            <FieldRow>
              <Field label="نشانی یکتا (slug)" hint="در نشانی صفحهٔ آزمون استفاده می‌شود؛ لاتین و بدون فاصله" required>
                {(props) => <Input {...props} value={slug} onChange={(event) => setSlug(event.target.value)} required />}
              </Field>
              <Field label="عنوان آزمون" required>
                {(props) => <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} required />}
              </Field>
            </FieldRow>

            <Field label="توضیح" hint="در فهرست عمومی آزمون‌ها دیده می‌شود" required>
              {(props) => <Textarea {...props} value={description} onChange={(event) => setDescription(event.target.value)} required />}
            </Field>

            <FieldRow>
              <Field label="نوع آزمون" required>
                {(props) => (
                  <Select {...props} value={mode} onChange={(event) => setMode(event.target.value as "STATIC" | "DYNAMIC")}>
                    <option value="STATIC">ثابت — سؤال‌ها را خودتان انتخاب می‌کنید</option>
                    <option value="DYNAMIC">پویا — از بانک یک درس سؤال برمی‌دارد</option>
                  </Select>
                )}
              </Field>
              <Field label="مدت (دقیقه)" required>
                {(props) => (
                  <Input {...props} value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} inputMode="numeric" required />
                )}
              </Field>
            </FieldRow>

            {mode === "DYNAMIC" && (
              <FieldRow>
                <Field label="درس" hint="بانک همین درس مبنای انتخاب سؤال است" required>
                  {(props) => (
                    <Select {...props} value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} required>
                      <option value="" disabled>انتخاب درس</option>
                      {subjects.map((subject) => <option key={subject.code} value={subject.code}>{subject.title}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="تعداد سؤال" hint="اگر بانک به این تعداد سؤال منتشرشده نداشته باشد، شروع آزمون خطا می‌دهد" required>
                  {(props) => (
                    <Input {...props} value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} inputMode="numeric" required />
                  )}
                </Field>
              </FieldRow>
            )}

            {createError && <Alert tone="danger">{createError}</Alert>}
            <div><Button type="submit" variant="primary" loading={creating}>ساخت آزمون</Button></div>
          </form>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head"><h2 className="ds-card-title">همهٔ آزمون‌ها</h2></div>
          <div className="ds-card-body">
            <DataState
              loading={loading}
              error={error}
              isEmpty={exams.length === 0}
              onRetry={load}
              emptyTitle="هنوز آزمونی ساخته نشده"
              emptyDescription="با فرم بالا اولین آزمون را بسازید."
            >
              <div className="ds-stack">
                {actionError && <Alert tone="danger">{actionError}</Alert>}
                {exams.map((exam) => (
                  <div className="ds-panel" key={exam.id}>
                    <div className="ds-row-between">
                      <div>
                        <strong>{exam.title}</strong>
                        <div className="ds-row" style={{ marginTop: "var(--sp-2)" }}>
                          <Badge tone={exam.isPublished ? "success" : "neutral"}>
                            {exam.isPublished ? "منتشرشده" : "پیش‌نویس"}
                          </Badge>
                          <Badge tone="info">{exam.mode === "STATIC" ? "ثابت" : "پویا"}</Badge>
                          <span className="ds-hint" style={{ margin: 0 }}>
                            {exam.mode === "STATIC"
                              ? `${toPersianDigits(exam.forms?.[0]?._count?.items ?? 0)} سؤال`
                              : `از بانک ${subjectTitle(exam.subjectCode ?? "")}`}
                            {` · ${toPersianDigits(exam._count?.attempts ?? 0)} شرکت`}
                          </span>
                        </div>
                      </div>
                      <div className="ds-row">
                        {!exam.isPublished && (
                          <Button size="sm" variant="primary" onClick={() => setPublishTarget(exam)}>انتشار</Button>
                        )}
                        <Button size="sm" onClick={() => setExpanded(expanded === exam.id ? null : exam.id)}>
                          {expanded === exam.id ? "بستن" : "مدیریت"}
                        </Button>
                        {exam.isPublished ? (
                          <Button size="sm" variant="ghost" onClick={() => { setActionError(null); setExamAction({ exam, kind: "unpublish" }); }}>
                            لغو انتشار
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => { setActionError(null); setExamAction({ exam, kind: "delete" }); }}>
                            حذف
                          </Button>
                        )}
                      </div>
                    </div>

                    {expanded === exam.id && (
                      <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
                        <ExamItems exam={exam} subjects={subjects} subjectTitle={subjectTitle} onChanged={load} />
                        <PsychometricsPanel examId={exam.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DataState>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={publishTarget !== null}
        title={`انتشار «${publishTarget?.title ?? ""}»؟`}
        description="پس از انتشار، آزمون برای کاربران قابل شروع می‌شود. هر وقت لازم شد می‌توانید انتشارش را لغو کنید."
        confirmLabel="منتشر کن"
        busy={publishing}
        onConfirm={publish}
        onCancel={() => setPublishTarget(null)}
      />

      <ConfirmDialog
        open={examAction !== null}
        title={examAction?.kind === "unpublish" ? `لغو انتشار «${examAction.exam.title}»؟` : `حذف «${examAction?.exam.title ?? ""}»؟`}
        description={
          examAction?.kind === "unpublish"
            ? "آزمون از فهرست عمومی برداشته می‌شود و کسی نمی‌تواند شروعش کند. کارنامه‌های قبلی سر جایشان می‌مانند."
            : "آزمون و فهرست سؤال‌هایش پاک می‌شود (خود سؤال‌ها در بانک می‌مانند). اگر کسی در آن شرکت کرده باشد، حذف انجام نمی‌شود."
        }
        confirmLabel={examAction?.kind === "unpublish" ? "لغو انتشار" : "حذف آزمون"}
        tone="danger"
        busy={actionBusy}
        onConfirm={() => void runExamAction()}
        onCancel={() => setExamAction(null)}
      />
    </>
  );
}
