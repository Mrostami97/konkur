"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";
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
  Pagination,
  Select,
  TableWrap,
  Textarea,
} from "../../../components/ds";

const PAGE_SIZE = 20;

/** The admin listing is the one read path that returns the whole row — body,
 * answer key, and retirement state — because an operator has to see exactly
 * what a student would get before deciding to publish, sample or retire it. */
type AdminQuestion = {
  id: string;
  externalId: string;
  subjectCode: string;
  examMajor: string;
  examYear: number;
  examDegree: string;
  topicCodes: string[];
  isSample: boolean;
  version: number;
  stemBlocks: unknown;
  options: unknown;
  correctOption: number;
  solutionBlocks: unknown;
  assets: unknown;
  retiredAt: string | null;
  retiredReason: string | null;
};

type FormValues = {
  externalId: string;
  degree: "master" | "phd";
  major: string;
  year: string;
  subjectCode: string;
  topicCodes: string;
  stem: string;
  options: string[];
  correctOption: number;
  solution: string;
};

const BLANK_FORM: FormValues = {
  externalId: "",
  degree: "master",
  major: "computer-engineering",
  year: "1405",
  subjectCode: "",
  topicCodes: "",
  stem: "",
  options: ["", "", "", ""],
  correctOption: 1,
  solution: "",
};

/**
 * Flattens a block array back to the plain text this form edits, or returns
 * null when it cannot. Null is the important case: a question imported from a
 * zip may hold images, LaTeX or tables, and round-tripping those through a
 * textarea would silently destroy them. The caller refuses to open such a
 * question for inline editing rather than quietly dropping content.
 */
function blocksToText(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") return null;
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type !== "text" || typeof candidate.text !== "string") return null;
    parts.push(candidate.text);
  }
  return parts.join("\n\n");
}

/** Builds form values from an existing question, or null when the question
 * holds content this form cannot represent without loss. */
function toFormValues(row: AdminQuestion): FormValues | null {
  if (Array.isArray(row.assets) && row.assets.length > 0) return null;

  const stem = blocksToText(row.stemBlocks);
  const solution = blocksToText(row.solutionBlocks);
  if (stem === null || solution === null) return null;

  if (!Array.isArray(row.options) || row.options.length === 0) return null;
  const options: string[] = [];
  for (const option of row.options) {
    if (!option || typeof option !== "object") return null;
    const text = blocksToText((option as { blocks?: unknown }).blocks);
    if (text === null) return null;
    options.push(text);
  }

  return {
    externalId: row.externalId,
    degree: row.examDegree.toLowerCase() === "phd" ? "phd" : "master",
    major: row.examMajor,
    year: String(row.examYear),
    subjectCode: row.subjectCode,
    topicCodes: row.topicCodes.join(", "),
    stem,
    options,
    correctOption: row.correctOption,
    solution,
  };
}

function QuestionList({ onEdit }: { onEdit: (row: AdminQuestion) => void }) {
  const [rows, setRows] = useState<AdminQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [subjectCode, setSubjectCode] = useState("");
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState({ subjectCode: "", query: "" });
  const [includeRetired, setIncludeRetired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<AdminQuestion | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (applied.subjectCode) params.set("subjectCode", applied.subjectCode);
      if (applied.query) params.set("q", applied.query);
      if (includeRetired) params.set("includeRetired", "true");
      const data = await apiFetch<{ items: AdminQuestion[]; total: number }>(`/admin/questions?${params}`);
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست سؤال‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [page, applied, includeRetired]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Returns whether the action succeeded, so a caller holding an open dialog
   * can keep it open — and keep what the operator typed — on failure. */
  async function runAction(row: AdminQuestion, key: string, action: () => Promise<string>) {
    setActionBusy(`${row.id}:${key}`);
    setActionError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این عملیات ممکن نشد.");
      return false;
    } finally {
      setActionBusy(null);
    }
  }

  function toggleSample(row: AdminQuestion) {
    void runAction(row, "sample", async () => {
      await apiFetch(`/admin/questions/${row.id}/sample`, {
        method: "POST",
        body: { isSample: !row.isSample },
      });
      return row.isSample
        ? `«${row.externalId}» از نمونه‌های عمومی خارج شد.`
        : `«${row.externalId}» به نمونهٔ عمومی تبدیل شد؛ متن و پاسخ آن برای همه قابل دیدن است.`;
    });
  }

  function restore(row: AdminQuestion) {
    void runAction(row, "restore", async () => {
      await apiFetch(`/admin/questions/${row.id}/restore`, { method: "POST" });
      return `«${row.externalId}» به بانک بازگشت. پرچم نمونهٔ عمومی بازنمی‌گردد و در صورت نیاز باید دوباره تنظیم شود.`;
    });
  }

  async function confirmRetire() {
    const row = retiring;
    if (!row) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    const ok = await runAction(row, "retire", async () => {
      const result = await apiFetch<{ examUses: number }>(`/admin/questions/${row.id}/retire`, {
        method: "POST",
        body: { reason: trimmed },
      });
      return result.examUses > 0
        ? `«${row.externalId}» بازنشسته شد. این سؤال در ${result.examUses} آزمون به‌کار رفته و برای گزارش تلاش‌های گذشته دست‌نخورده می‌ماند.`
        : `«${row.externalId}» بازنشسته شد و دیگر در بانک دیده نمی‌شود.`;
    });
    if (!ok) return;
    setRetiring(null);
    setReason("");
  }

  const hasFilters = Boolean(applied.subjectCode || applied.query);

  return (
    <>
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
                placeholder="جست‌وجو در شناسه، کد درس، گرایش یا مبحث"
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
            {hasFilters && (
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
            <label className="ds-checkbox-row">
              <input
                type="checkbox"
                checked={includeRetired}
                onChange={(event) => {
                  setPage(1);
                  setIncludeRetired(event.target.checked);
                }}
              />
              <span>نمایش سؤال‌های بازنشسته</span>
            </label>
          </form>
        </div>

        {(actionError || notice) && (
          <div style={{ padding: "var(--sp-4) var(--sp-4) 0" }}>
            {actionError && <Alert tone="danger">{actionError}</Alert>}
            {notice && !actionError && <Alert tone="success">{notice}</Alert>}
          </div>
        )}

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
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const retired = Boolean(row.retiredAt);
                  const editable = toFormValues(row) !== null;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/questions/${row.id}`} className="text-link">
                          {row.externalId}
                        </Link>
                        <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
                          نسخهٔ {row.version}
                        </div>
                      </td>
                      <td>{row.subjectCode}</td>
                      <td>{row.examMajor}</td>
                      <td className="ds-table-numeric">{row.examYear}</td>
                      <td style={{ color: "var(--muted)" }}>{row.topicCodes.join("، ") || "—"}</td>
                      <td>
                        {retired ? (
                          <>
                            <Badge tone="danger">بازنشسته</Badge>
                            {row.retiredReason && (
                              <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginTop: "var(--sp-1)" }}>
                                {row.retiredReason}
                              </div>
                            )}
                          </>
                        ) : row.isSample ? (
                          <Badge tone="success">نمونهٔ عمومی</Badge>
                        ) : (
                          <Badge>قفل</Badge>
                        )}
                      </td>
                      <td>
                        <div className="ds-table-actions">
                          <Button
                            size="sm"
                            onClick={() => onEdit(row)}
                            disabled={!editable}
                            title={
                              editable
                                ? undefined
                                : "این سؤال رسانه یا بلوک غیرمتنی دارد و با این فرم بدون از دست رفتن محتوا ویرایش نمی‌شود. از مسیر «ورود داده» بازنگری کنید."
                            }
                          >
                            ویرایش
                          </Button>
                          {!retired && (
                            <Button
                              size="sm"
                              onClick={() => toggleSample(row)}
                              loading={actionBusy === `${row.id}:sample`}
                              disabled={actionBusy !== null}
                            >
                              {row.isSample ? "خروج از نمونه" : "نمونهٔ عمومی"}
                            </Button>
                          )}
                          {retired ? (
                            <Button
                              size="sm"
                              onClick={() => restore(row)}
                              loading={actionBusy === `${row.id}:restore`}
                              disabled={actionBusy !== null}
                            >
                              بازگرداندن
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setReason("");
                                setActionError(null);
                                setNotice(null);
                                setRetiring(row);
                              }}
                              disabled={actionBusy !== null}
                            >
                              بازنشسته کردن
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </DataState>
        </div>
      </Card>

      <ConfirmDialog
        open={retiring !== null}
        title="این سؤال بازنشسته شود؟"
        description={`«${retiring?.externalId ?? ""}» از بانک و از صفحات عمومی برداشته می‌شود و اگر نمونهٔ عمومی باشد آن پرچم هم پاک می‌شود. سؤال حذف نمی‌شود: تلاش‌ها و گزارش‌های گذشته دست‌نخورده می‌مانند و هر زمان می‌توانید بازش گردانید.`}
        confirmLabel="بازنشسته کن"
        tone="danger"
        busy={actionBusy?.endsWith(":retire") ?? false}
        confirmDisabled={reason.trim().length === 0}
        onConfirm={() => void confirmRetire()}
        onCancel={() => {
          setRetiring(null);
          setReason("");
        }}
      >
        <Field label="دلیل بازنشستگی" hint="در تاریخچهٔ ممیزی ثبت می‌شود و کنار سؤال دیده خواهد شد" required>
          {(props) => (
            <Textarea
              {...props}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="مثلاً: گزینهٔ صحیح اشتباه بود و نسخهٔ اصلاح‌شده جداگانه ثبت شد."
            />
          )}
        </Field>
        {/* Repeated inside the dialog because the copy in the card behind it
         * sits under the backdrop and would go unread. */}
        {actionError && (
          <div style={{ marginTop: "var(--sp-3)" }}>
            <Alert tone="danger">{actionError}</Alert>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

function QuestionForm({
  initial,
  editingId,
  onCancelEdit,
}: {
  initial: FormValues;
  editingId: string | null;
  onCancelEdit: () => void;
}) {
  const isEdit = editingId !== null;
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function patch(next: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...next }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const job = await apiFetch<{ id: string }>("/admin/questions", {
        method: "POST",
        body: {
          external_id: values.externalId,
          exam: { degree: values.degree, major: values.major, year: Number(values.year) },
          subject_code: values.subjectCode,
          topic_codes: values.topicCodes.split(",").map((code) => code.trim()).filter(Boolean),
          stem_blocks: [{ type: "text", text: values.stem }],
          options: values.options.map((text, index) => ({
            number: index + 1,
            blocks: [{ type: "text", text }],
          })),
          correct_option: values.correctOption,
          solution_blocks: [{ type: "text", text: values.solution }],
        },
      });
      setResult(
        isEdit
          ? `ویرایش در وظیفهٔ ${job.id} ثبت شد. تا تأیید و انتشار در «ورود داده»، نسخهٔ فعلی سؤال بدون تغییر می‌ماند.`
          : `سؤال در وظیفهٔ ${job.id} ثبت شد. برای بررسی و انتشار به «ورود داده» بروید.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت سؤال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="ds-row-between">
        <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
          {isEdit ? `ویرایش سؤال ${values.externalId}` : "ثبت سؤال تازه"}
        </h2>
        {isEdit && (
          <Button variant="ghost" onClick={onCancelEdit}>
            انصراف از ویرایش
          </Button>
        )}
      </div>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-6)" }}>
        {isEdit ? (
          <>
            ویرایش هم از همان مسیر بررسی و انتشار می‌گذرد: این فرم نسخهٔ تازه‌ای از همین شناسهٔ بیرونی می‌سازد که
            پس از تأیید در{" "}
            <Link href="/admin/import" className="text-link">
              ورود داده
            </Link>{" "}
            جایگزین می‌شود و شمارهٔ نسخهٔ سؤال یک واحد بالا می‌رود. تاریخچهٔ نسخه‌ها حفظ می‌شود.
          </>
        ) : (
          <>
            این فرم همان مسیر بررسی و انتشارِ بارگذاری zip را طی می‌کند. پس از ثبت، سؤال در{" "}
            <Link href="/admin/import" className="text-link">
              ورود داده
            </Link>{" "}
            منتظر تأیید می‌ماند و تا آن زمان منتشر نمی‌شود.
          </>
        )}
      </p>

      <form onSubmit={submit} className="ds-stack">
        <FieldRow>
          <Field
            label="شناسه بیرونی"
            hint={
              isEdit
                ? "در حالت ویرایش ثابت است؛ تغییر آن به‌جای ویرایش، یک سؤال تازه می‌سازد"
                : "شناسهٔ یکتا برای جلوگیری از ثبت تکراری"
            }
            required
          >
            {(props) => (
              <Input
                {...props}
                value={values.externalId}
                onChange={(event) => patch({ externalId: event.target.value })}
                readOnly={isEdit}
                required
              />
            )}
          </Field>
          <Field label="مقطع" required>
            {(props) => (
              <Select
                {...props}
                value={values.degree}
                onChange={(event) => patch({ degree: event.target.value as "master" | "phd" })}
              >
                <option value="master">ارشد</option>
                <option value="phd">دکتری</option>
              </Select>
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="گرایش" required>
            {(props) => (
              <Input {...props} value={values.major} onChange={(event) => patch({ major: event.target.value })} required />
            )}
          </Field>
          <Field label="سال کنکور" required>
            {(props) => (
              <Input
                {...props}
                value={values.year}
                onChange={(event) => patch({ year: event.target.value })}
                inputMode="numeric"
                required
              />
            )}
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="کد درس" hint="مثلاً data-structures" required>
            {(props) => (
              <Input
                {...props}
                value={values.subjectCode}
                onChange={(event) => patch({ subjectCode: event.target.value })}
                required
              />
            )}
          </Field>
          <Field label="کد مبحث‌ها" hint="چند مبحث را با کاما جدا کنید" required>
            {(props) => (
              <Input
                {...props}
                value={values.topicCodes}
                onChange={(event) => patch({ topicCodes: event.target.value })}
                required
              />
            )}
          </Field>
        </FieldRow>

        <Field label="متن سؤال" required>
          {(props) => (
            <Textarea {...props} value={values.stem} onChange={(event) => patch({ stem: event.target.value })} required />
          )}
        </Field>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="ds-label" style={{ padding: 0 }}>
            گزینه‌ها — گزینهٔ صحیح را علامت بزنید
          </legend>
          <div className="ds-stack-sm">
            {values.options.map((option, index) => (
              <label key={index} className="ds-checkbox-row">
                <input
                  type="radio"
                  name="correct"
                  checked={values.correctOption === index + 1}
                  onChange={() => patch({ correctOption: index + 1 })}
                  aria-label={`گزینهٔ ${index + 1} پاسخ صحیح است`}
                />
                <span className="ds-grow">
                  <Input
                    placeholder={`گزینهٔ ${index + 1}`}
                    value={option}
                    onChange={(event) =>
                      patch({
                        options: values.options.map((current, position) =>
                          position === index ? event.target.value : current,
                        ),
                      })
                    }
                    required
                  />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="راه‌حل" hint="برای دارندگان دسترسی بانک سؤال نمایش داده می‌شود" required>
          {(props) => (
            <Textarea
              {...props}
              value={values.solution}
              onChange={(event) => patch({ solution: event.target.value })}
              required
            />
          )}
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}
        {result && <Alert tone="success">{result}</Alert>}

        <div>
          <Button type="submit" variant="primary" loading={busy}>
            {isEdit ? "ثبت ویرایش" : "ثبت سؤال"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminQuestionsPage() {
  const [editing, setEditing] = useState<{ id: string; values: FormValues } | null>(null);

  const formInitial = useMemo(() => editing?.values ?? BLANK_FORM, [editing]);

  return (
    <>
      <AdminPageHeader
        title="بانک سؤال"
        description="فهرست کامل سؤال‌ها همراه با وضعیت دسترسی و بازنشستگی. سؤال‌های «نمونهٔ عمومی» برای همه قابل مشاهده‌اند؛ بقیه به دسترسی بانک همان درس نیاز دارند."
      />
      <div className="ds-stack-lg">
        <QuestionList
          onEdit={(row) => {
            const values = toFormValues(row);
            if (!values) return;
            setEditing({ id: row.id, values });
            if (typeof document !== "undefined") {
              document.getElementById("question-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />
        <div id="question-form">
          <QuestionForm
            key={editing?.id ?? "new"}
            initial={formInitial}
            editingId={editing?.id ?? null}
            onCancelEdit={() => setEditing(null)}
          />
        </div>
      </div>
    </>
  );
}
