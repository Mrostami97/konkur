"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminGuard } from "../../../../components/AdminGuard";
import { apiFetch } from "../../../../lib/api";

function RollbackTool() {
  const [entityType, setEntityType] = useState<"ARTICLE" | "QUESTION" | "REPORT_CARD">("ARTICLE");
  const [entityId, setEntityId] = useState("");
  const [toVersion, setToVersion] = useState("1");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<{ newVersion: number; restoredFromVersion: number }>(
        "/admin/content/rollback",
        { method: "POST", body: { entityType, entityId, toVersion: Number(toVersion) } },
      );
      setResult(`نسخه ${res.restoredFromVersion} بازگردانده شد و به‌عنوان نسخه ${res.newVersion} ثبت شد.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "بازگشت نسخه ناموفق بود");
    }
  }

  return (
    <details style={{ marginTop: "1.5rem" }}>
      <summary>ابزار بازگشت نسخه محتوا</summary>
      <form onSubmit={submit} style={{ marginTop: "0.5rem" }}>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value as typeof entityType)}>
          <option value="ARTICLE">مقاله</option>
          <option value="QUESTION">سؤال</option>
          <option value="REPORT_CARD">کارنامه</option>
        </select>
        <input
          placeholder="شناسه موجودیت (publishedEntityId)"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          required
          style={{ margin: "0 0.5rem" }}
        />
        <input
          type="number"
          min={1}
          value={toVersion}
          onChange={(e) => setToVersion(e.target.value)}
          style={{ width: "4rem" }}
        />
        <button type="submit" style={{ marginInlineStart: "0.5rem" }}>
          بازگشت به این نسخه
        </button>
      </form>
      {result && <p style={{ color: "green" }}>{result}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </details>
  );
}

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

function ImportJobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [j, i] = await Promise.all([
      apiFetch<ImportJob>(`/admin/import/${jobId}`),
      apiFetch<ImportItem[]>(`/admin/import/${jobId}/items`),
    ]);
    setJob(j);
    setItems(i);
  }, [jobId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function review(decision: "APPROVE" | "REJECT") {
    if (selected.size === 0) return;
    await apiFetch("/admin/import/items/review", {
      method: "POST",
      body: { itemIds: [...selected], decision },
    });
    setSelected(new Set());
    await load();
  }

  async function publish() {
    await apiFetch(`/admin/import/${jobId}/publish`, { method: "POST" });
    await load();
  }

  if (!job) return <main style={{ padding: "2rem" }}>در حال بارگذاری...</main>;

  return (
    <main style={{ padding: "2rem", maxWidth: 820, margin: "0 auto" }}>
      <h1>
        وظیفه ورود داده — {job.schemaVersion} ({job.status})
      </h1>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={() => review("APPROVE")} disabled={selected.size === 0}>
          تأیید انتخاب‌شده‌ها ({selected.size})
        </button>
        <button onClick={() => review("REJECT")} disabled={selected.size === 0} style={{ marginInlineStart: "0.5rem" }}>
          رد انتخاب‌شده‌ها
        </button>
        <button onClick={publish} style={{ marginInlineStart: "0.5rem" }}>
          انتشار همه تأییدشده‌ها
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th />
            <th style={{ textAlign: "right" }}>external_id</th>
            <th style={{ textAlign: "right" }}>وضعیت</th>
            <th style={{ textAlign: "right" }}>تشخیص تکرار</th>
            <th style={{ textAlign: "right" }}>نسخه منتشرشده</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <>
              <tr key={item.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
                <td style={{ padding: "0.4rem" }}>
                  {item.status === "VALID" && (
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  )}
                </td>
                <td style={{ padding: "0.4rem" }}>{item.externalId}</td>
                <td style={{ padding: "0.4rem" }}>{item.status}</td>
                <td style={{ padding: "0.4rem" }}>{item.dedupeStatus ?? "—"}</td>
                <td style={{ padding: "0.4rem" }}>{item.publishedVersion ?? "—"}</td>
                <td style={{ padding: "0.4rem" }}>
                  <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    {expanded === item.id ? "بستن" : "جزئیات"}
                  </button>
                </td>
              </tr>
              {expanded === item.id && (
                <tr>
                  <td colSpan={6} style={{ padding: "0.5rem", background: "#F4F8FB" }}>
                    {item.validationErrors.length > 0 && (
                      <div style={{ color: "crimson", marginBottom: "0.5rem" }}>
                        {item.validationErrors.map((e, i) => (
                          <div key={i}>{e}</div>
                        ))}
                      </div>
                    )}
                    {item.publishedEntityId && (
                      <p style={{ fontSize: "0.85rem" }}>
                        entityId (for rollback): <code>{item.publishedEntityId}</code>
                      </p>
                    )}
                    <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", fontSize: "0.8rem" }}>
                      {JSON.stringify(item.rawPayload, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      <RollbackTool />
    </main>
  );
}

export default function ImportJobDetailPage({ params }: { params: { jobId: string } }) {
  return (
    <AdminGuard>
      <ImportJobDetail jobId={params.jobId} />
    </AdminGuard>
  );
}
