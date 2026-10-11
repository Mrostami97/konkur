"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";

const formatPersianDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" });
import { AdminPageHeader, Alert, Badge, Button, Card, DataState, TableWrap } from "../../../components/ds";

interface Row {
  user: { id: string; phone: string; name: string | null };
  licenseKey: string | null;
  requests: { id: string; course: { id: string; title: string; spotPlayerCourseId: string | null }; requestedAt: string; handledAt: string | null }[];
}

function IssueForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const [key, setKey] = useState(row.licenseKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/video-licenses/${row.user.id}`, { method: "POST", body: { licenseKey: key } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت لایسنس ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 260 }}>
      <input
        className="ds-input"
        dir="ltr"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder="کد لایسنس اسپات‌پلیر"
        aria-label={`کد لایسنس ${row.user.name ?? row.user.phone}`}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button size="sm" variant="primary" loading={busy} disabled={!key.trim()} onClick={() => void save()}>
          {row.licenseKey ? "دوره‌ها به لایسنس اضافه شد" : "ثبت لایسنس"}
        </Button>
      </div>
    </div>
  );
}

export default function VideoLicensesAdminPage() {
  const [status, setStatus] = useState<"PENDING" | "DONE">("PENDING");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Row[]>(`/admin/video-licenses?status=${status}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "بارگذاری درخواست‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader
        title="لایسنس‌های اسپات‌پلیر"
        description="دانشجویی که دورهٔ ویدیودار خریده از صفحهٔ دوره لایسنس درخواست می‌دهد. لایسنس را در پنل اسپات‌پلیر بساز (یا دورهٔ تازه را به لایسنس قبلی‌اش اضافه کن)، کدش را این‌جا ثبت کن تا در صفحهٔ دوره‌اش نمایش داده شود. یک لایسنس می‌تواند همهٔ دوره‌ها را داشته باشد."
        action={
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            <Button variant={status === "PENDING" ? "primary" : "secondary"} onClick={() => setStatus("PENDING")}>در انتظار</Button>
            <Button variant={status === "DONE" ? "primary" : "secondary"} onClick={() => setStatus("DONE")}>انجام‌شده</Button>
          </div>
        }
      />

      <Card padded={false}>
        <DataState
          loading={loading}
          error={error}
          onRetry={() => void load()}
          isEmpty={rows.length === 0}
          emptyTitle={status === "PENDING" ? "درخواست تازه‌ای نیست" : "هنوز لایسنسی ثبت نشده"}
        >
          <TableWrap>
            <table className="ds-table">
              <thead>
                <tr>
                  <th>دانشجو</th>
                  <th>دوره‌های درخواستی</th>
                  <th>{status === "PENDING" ? "ثبت لایسنس" : "کد لایسنس"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.user.id}>
                    <td>
                      <strong>{row.user.name ?? "بی‌نام"}</strong>
                      <div dir="ltr" style={{ textAlign: "right" }}>{toPersianDigits(row.user.phone.replace(/^\+98/, "0"))}</div>
                      {status === "PENDING" && row.licenseKey && <Badge tone="info">لایسنس قبلی دارد</Badge>}
                    </td>
                    <td>
                      {row.requests.map((item) => (
                        <div key={item.id}>
                          {item.course.title}
                          {item.course.spotPlayerCourseId && (
                            <span className="ds-subtitle" dir="ltr"> ({item.course.spotPlayerCourseId})</span>
                          )}
                          <div className="ds-subtitle">
                            {status === "PENDING" ? `درخواست ${formatPersianDate(item.requestedAt)}` : `ثبت ${formatPersianDate(item.handledAt ?? item.requestedAt)}`}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td>
                      {status === "PENDING" ? (
                        <IssueForm row={row} onDone={() => void load()} />
                      ) : (
                        <code dir="ltr">{row.licenseKey}</code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </DataState>
      </Card>
    </>
  );
}
