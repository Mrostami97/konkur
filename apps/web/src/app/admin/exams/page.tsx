"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  forms: { _count: { items: number } }[];
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
 * effectively unusable. This searches the public question endpoint, which
 * already supports subject and free-text filters.
 */
function QuestionPicker({ examId, onAdded }: { examId: string; onAdded: () => void }) {
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
      const data = await apiFetch<{ items: QuestionRow[] }>(`/questions?${params}`);
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
      await apiFetch(`/admin/exams/${examId}/items`, { method: "POST", body: { questionId, order: 0 } });
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
        <div style={{ width: "10rem" }}>
          <Input placeholder="کد درس" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} aria-label="کد درس" />
        </div>
        <div className="ds-grow" style={{ minWidth: "10rem" }}>
          <Input placeholder="جست‌وجو در کد درس، گرایش یا مبحث" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="جست‌وجو" />
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
                <td>{row.subjectCode}</td>
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

export default function ExamsAdminPage() {
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
  const [publishTarget, setPublishTarget] = useState<{ exam: Exam; publish: boolean } | null>(null);
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

  async function publish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await apiFetch(`/admin/exams/${publishTarget.exam.id}/${publishTarget.publish ? "publish" : "unpublish"}`, { method: "POST" });
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
                <Field label="کد درس" hint="بانک همین درس مبنای انتخاب سؤال است" required>
                  {(props) => <Input {...props} value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} required />}
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
                            {toPersianDigits(exam.forms?.[0]?._count?.items ?? 0)} سؤال
                          </span>
                        </div>
                      </div>
                      <div className="ds-row">
                        {exam.isPublished ? (
                          <Button size="sm" variant="ghost" onClick={() => setPublishTarget({ exam, publish: false })}>لغو انتشار</Button>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setPublishTarget({ exam, publish: true })}>انتشار</Button>
                        )}
                        <Button size="sm" onClick={() => setExpanded(expanded === exam.id ? null : exam.id)}>
                          {expanded === exam.id ? "بستن" : "مدیریت"}
                        </Button>
                      </div>
                    </div>

                    {expanded === exam.id && (
                      <div className="ds-stack" style={{ marginTop: "var(--sp-5)" }}>
                        {exam.mode === "STATIC" && <QuestionPicker examId={exam.id} onAdded={load} />}
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
        title={publishTarget?.publish ? `انتشار «${publishTarget.exam.title}»؟` : `لغو انتشار «${publishTarget?.exam.title ?? ""}»؟`}
        description={
          publishTarget?.publish
            ? "پس از انتشار، آزمون در فهرست آزمون‌ها می‌آید و کاربران می‌توانند شروعش کنند."
            : "آزمون از فهرست خارج می‌شود و شروع تازه ممکن نیست؛ کسانی که وسط آزمون‌اند می‌توانند تمامش کنند و کارنامه‌ها می‌مانند."
        }
        confirmLabel={publishTarget?.publish ? "منتشر کن" : "لغو انتشار"}
        busy={publishing}
        onConfirm={publish}
        onCancel={() => setPublishTarget(null)}
      />
    </>
  );
}
