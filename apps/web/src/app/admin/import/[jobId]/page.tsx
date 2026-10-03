"use client";

import Link from "next/link";
import { use, Fragment, FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../../lib/api";
import { toPersianDigits } from "../../../../lib/format";
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
} from "../../../../components/ds";

type EntityType = "ARTICLE" | "QUESTION" | "REPORT_CARD";

interface ImportItem {
  id: string;
  externalId: string;
  status: string;
  dedupeStatus: string | null;
  validationErrors: string[];
  publishedEntityId: string | null;
  publishedVersion: number | null;
  rawPayload: Record<string, unknown>;
}

interface ImportJob {
  id: string;
  schemaVersion: string;
  status: string;
}

const ITEM_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  VALID: { label: "معتبر", tone: "info" },
  INVALID: { label: "نامعتبر", tone: "danger" },
  APPROVED: { label: "تأییدشده", tone: "success" },
  REJECTED: { label: "ردشده", tone: "danger" },
  PUBLISHED: { label: "منتشرشده", tone: "success" },
  SKIPPED: { label: "رد شد", tone: "neutral" },
};

// The API reports NEW, MATCH (identical to the latest version) or CONFLICT
// (an existing item whose text differs, i.e. this import is its next version).
const DEDUPE: Record<string, string> = {
  NEW: "تازه",
  MATCH: "بدون تغییر",
  CONFLICT: "نسخهٔ جدیدِ محتوای موجود",
};

/** Rolling a published entity back needs its id and a version. The id is
 * shown on the item row it came from, so the row can fill this in rather than
 * leaving an operator to copy a UUID by hand. */
function RollbackTool({ prefill }: { prefill: { entityId: string; entityType: EntityType } | null }) {
  const [entityType, setEntityType] = useState<EntityType>("ARTICLE");
  const [entityId, setEntityId] = useState("");
  const [toVersion, setToVersion] = useState("1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!prefill) return;
    setEntityId(prefill.entityId);
    setEntityType(prefill.entityType);
    setResult(null);
    setError(null);
  }, [prefill]);

  async function rollback() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetch<{ newVersion: number; restoredFromVersion: number }>(
        "/admin/content/rollback",
        { method: "POST", body: { entityType, entityId, toVersion: Number(toVersion) } },
      );
      setResult(
        `نسخهٔ ${toPersianDigits(response.restoredFromVersion)} بازگردانده شد و به‌عنوان نسخهٔ ${toPersianDigits(response.newVersion)} ثبت شد.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "بازگشت نسخه ناموفق بود.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <Card>
      <h2 className="ds-card-title">بازگشت نسخهٔ محتوا</h2>
      <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
        محتوای منتشرشده را به نسخهٔ قبلی برمی‌گرداند. این کار خودش یک نسخهٔ تازه می‌سازد، پس تاریخچه
        پاک نمی‌شود.
      </p>
      <form
        className="ds-form"
        onSubmit={(event: FormEvent) => { event.preventDefault(); setConfirming(true); }}
      >
        <FieldRow>
          <Field label="نوع محتوا" required>
            {(props) => (
              <Select {...props} value={entityType} onChange={(event) => setEntityType(event.target.value as EntityType)}>
                <option value="ARTICLE">مقاله</option>
                <option value="QUESTION">سؤال</option>
                <option value="REPORT_CARD">کارنامه</option>
              </Select>
            )}
          </Field>
          <Field label="شناسهٔ محتوا" hint="از دکمهٔ «بازگشت نسخه» روی همان ردیف پر می‌شود" required>
            {(props) => <Input {...props} value={entityId} onChange={(event) => setEntityId(event.target.value)} required />}
          </Field>
          <Field label="بازگشت به نسخهٔ" required>
            {(props) => (
              <Input {...props} type="number" min={1} value={toVersion} onChange={(event) => setToVersion(event.target.value)} required />
            )}
          </Field>
        </FieldRow>
        {error && <Alert tone="danger">{error}</Alert>}
        {result && <Alert tone="success">{result}</Alert>}
        <div><Button type="submit" variant="danger" disabled={!entityId}>بازگشت به این نسخه</Button></div>
      </form>

      <ConfirmDialog
        open={confirming}
        title="بازگرداندن محتوا به نسخهٔ قبلی؟"
        description="نسخهٔ منتشرشدهٔ فعلی با نسخهٔ انتخاب‌شده جایگزین می‌شود و بلافاصله روی سایت اثر می‌گذارد."
        confirmLabel="بازگردان"
        tone="danger"
        busy={busy}
        onConfirm={rollback}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}

export default function ImportJobDetailPage({ params: pendingParams }: { params: Promise<{ jobId: string }> }) {
  const params = use(pendingParams);
  const jobId = params.jobId;
  const [job, setJob] = useState<ImportJob | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ entityId: string; entityType: EntityType } | null>(null);

  const [pending, setPending] = useState<"APPROVE" | "REJECT" | "PUBLISH" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextJob, nextItems] = await Promise.all([
        apiFetch<ImportJob>(`/admin/import/${jobId}`),
        apiFetch<ImportItem[]>(`/admin/import/${jobId}/items`),
      ]);
      setJob(nextJob);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن وظیفهٔ ورود داده ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmAction() {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending === "PUBLISH") {
        await apiFetch(`/admin/import/${jobId}/publish`, { method: "POST" });
      } else {
        await apiFetch("/admin/import/items/review", {
          method: "POST",
          body: { itemIds: [...selected], decision: pending },
        });
        setSelected(new Set());
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "انجام این کار ممکن نشد.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const selectable = items.filter((item) => item.status === "VALID");
  const dialog = {
    APPROVE: {
      title: `تأیید ${toPersianDigits(selected.size)} آیتم؟`,
      description: "آیتم‌های تأییدشده آمادهٔ انتشار می‌شوند، ولی هنوز منتشر نمی‌شوند.",
      label: "تأیید کن",
      tone: "primary" as const,
    },
    REJECT: {
      title: `رد ${toPersianDigits(selected.size)} آیتم؟`,
      description: "آیتم‌های ردشده منتشر نخواهند شد. برای واردکردن دوبارهٔ آن‌ها باید بستهٔ اصلاح‌شده را دوباره بارگذاری کنید.",
      label: "رد کن",
      tone: "danger" as const,
    },
    PUBLISH: {
      title: "انتشار همهٔ آیتم‌های تأییدشده؟",
      description: "محتوا بلافاصله روی سایت عمومی منتشر می‌شود. برگرداندن آن فقط با ابزار بازگشت نسخه ممکن است.",
      label: "منتشر کن",
      tone: "primary" as const,
    },
  }[pending ?? "APPROVE"];

  return (
    <>
      <AdminPageHeader
        title="وظیفهٔ ورود داده"
        description={job ? `قرارداد ${job.schemaVersion}` : undefined}
        action={<Link className="ds-btn ds-btn-secondary ds-btn-sm" href="/admin/import">بازگشت به فهرست</Link>}
      />

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <DataState loading={loading} error={error} onRetry={load} skeletonRows={4}>
        {job && (
          <div className="ds-stack-lg">
            <Card>
              <div className="ds-row-between">
                <div className="ds-row">
                  <Badge tone="info">{job.status}</Badge>
                  <span className="ds-subtitle">
                    {toPersianDigits(items.length)} آیتم · {toPersianDigits(selectable.length)} آمادهٔ بررسی
                  </span>
                </div>
                <div className="ds-row">
                  <Button size="sm" variant="primary" disabled={selected.size === 0} onClick={() => setPending("APPROVE")}>
                    تأیید انتخاب‌شده‌ها ({toPersianDigits(selected.size)})
                  </Button>
                  <Button size="sm" variant="danger" disabled={selected.size === 0} onClick={() => setPending("REJECT")}>
                    رد انتخاب‌شده‌ها
                  </Button>
                  <Button size="sm" onClick={() => setPending("PUBLISH")}>انتشار تأییدشده‌ها</Button>
                </div>
              </div>
            </Card>

            <Card padded={false}>
              <div className="ds-card-head"><h2 className="ds-card-title">آیتم‌ها</h2></div>
              <div className={`ds-card-body ${items.length ? "ds-card-body-flush" : ""}`}>
                {items.length === 0 ? (
                  <p className="ds-subtitle">این وظیفه آیتمی ندارد.</p>
                ) : (
                  <TableWrap>
                    <thead>
                      <tr>
                        <th>
                          {selectable.length > 0 && (
                            <input
                              type="checkbox"
                              checked={selectable.every((item) => selected.has(item.id))}
                              onChange={(event) => setSelected(event.target.checked ? new Set(selectable.map((item) => item.id)) : new Set())}
                              aria-label={`انتخاب همهٔ ${toPersianDigits(selectable.length)} آیتم آمادهٔ بررسی`}
                            />
                          )}
                        </th>
                        <th>شناسهٔ بیرونی</th>
                        <th>وضعیت</th>
                        <th>تشخیص تکرار</th>
                        <th>نسخه</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const status = ITEM_STATUS[item.status];
                        return (
                          <Fragment key={item.id}>
                            <tr>
                              <td>
                                {item.status === "VALID" && (
                                  <input
                                    type="checkbox"
                                    checked={selected.has(item.id)}
                                    onChange={() => toggle(item.id)}
                                    aria-label={`انتخاب ${item.externalId}`}
                                  />
                                )}
                              </td>
                              <td className="ds-code">{item.externalId}</td>
                              <td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>{item.status}</Badge>}</td>
                              <td>{item.dedupeStatus ? (DEDUPE[item.dedupeStatus] ?? item.dedupeStatus) : "—"}</td>
                              <td className="ds-table-numeric">
                                {item.publishedVersion ? toPersianDigits(item.publishedVersion) : "—"}
                              </td>
                              <td>
                                <div className="ds-row">
                                  <Button size="sm" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                                    {expanded === item.id ? "بستن" : "جزئیات"}
                                  </Button>
                                  {item.publishedEntityId && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setPrefill({
                                          entityId: item.publishedEntityId!,
                                          entityType: job.schemaVersion.startsWith("question")
                                            ? "QUESTION"
                                            : job.schemaVersion.startsWith("report-card")
                                              ? "REPORT_CARD"
                                              : "ARTICLE",
                                        })
                                      }
                                    >
                                      بازگشت نسخه
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expanded === item.id && (
                              <tr>
                                <td colSpan={6}>
                                  <div className="ds-detail-cell">
                                    {item.validationErrors.length > 0 && (
                                      <Alert tone="danger">
                                        <span>
                                          {item.validationErrors.map((message, index) => (
                                            <span key={index} style={{ display: "block" }}>{message}</span>
                                          ))}
                                        </span>
                                      </Alert>
                                    )}
                                    {item.publishedEntityId && (
                                      <p className="ds-hint" style={{ margin: 0 }}>
                                        شناسهٔ محتوای منتشرشده: <span className="ds-code">{item.publishedEntityId}</span>
                                      </p>
                                    )}
                                    <pre className="ds-payload">{JSON.stringify(item.rawPayload, null, 2)}</pre>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            </Card>

            <RollbackTool prefill={prefill} />
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={pending !== null}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.label}
        tone={dialog.tone}
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
