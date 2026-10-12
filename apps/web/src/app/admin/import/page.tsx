"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, apiUpload, ApiError } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Badge,
  Card,
  DataState,
  Pagination,
  TableWrap,
} from "../../../components/ds";

interface ImportJob {
  id: string;
  schemaVersion: string;
  status: string;
  totalItems: number;
  createdAt: string;
}

/** The API returns pipeline enum values. An operator should read the stage,
 * not the constant, so each is named and given a tone. Anything unmapped
 * falls back to the raw value rather than being hidden. */
const STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  RECEIVED: { label: "دریافت‌شده", tone: "info" },
  STAGED: { label: "در انتظار بررسی", tone: "warning" },
  VALIDATED: { label: "اعتبارسنجی‌شده", tone: "info" },
  REVIEWED: { label: "بررسی‌شده", tone: "info" },
  PUBLISHED: { label: "منتشرشده", tone: "success" },
  FAILED: { label: "ناموفق", tone: "danger" },
  REJECTED: { label: "ردشده", tone: "danger" },
  ROLLED_BACK: { label: "بازگردانده‌شده", tone: "neutral" },
};

const PAGE_SIZE = 20;

export default function ImportAdminPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await apiFetch<ImportJob[]>("/admin/import"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست وظیفه‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploaded(null);
    try {
      await apiUpload("/admin/import", file);
      setUploaded(`«${file.name}» بارگذاری شد و در انتظار بررسی است.`);
      setPage(1);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "بارگذاری ناموفق بود.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  // The endpoint returns every job unbounded, so paging is client-side for
  // now; it needs real skip/take server-side once the archive grows.
  const visible = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <AdminPageHeader
        title="ورود داده"
        description="داده‌های بیرونی فقط از این مسیر وارد می‌شوند: بارگذاری، اعتبارسنجی، بررسی و در آخر انتشار. تا وقتی وظیفه‌ای منتشر نشده، چیزی روی سایت دیده نمی‌شود."
      />

      <div className="ds-stack-lg">
        <Card>
          <h2 className="ds-card-title">بارگذاری بستهٔ تازه</h2>
          <p className="ds-subtitle" style={{ marginTop: "var(--sp-2)" }}>
            فایل zip مقاله، کارنامه یا بانک سؤال را این‌جا بارگذاری کن (مقاله: article.v2، سؤال: question.v2،
            کارنامه: report-card.v1). تصویرها و فایل‌های هر بسته داخل همان zip هستند.
          </p>

          <div className="ds-form">
            <label className="ds-label" htmlFor="import-file">فایل zip</label>
            <input
              id="import-file"
              className="ds-input"
              type="file"
              accept=".zip"
              onChange={onFileChange}
              disabled={uploading}
            />
            {uploading && <Alert tone="info">در حال پردازش بسته…</Alert>}
            {uploadError && <Alert tone="danger">{uploadError}</Alert>}
            {uploaded && <Alert tone="success">{uploaded}</Alert>}
          </div>
        </Card>

        <Card padded={false}>
          <div className="ds-card-head">
            <div>
              <h2 className="ds-card-title">وظیفه‌های ورود داده</h2>
              <p>برای بررسی آیتم‌ها و انتشار، وارد هر وظیفه شوید.</p>
            </div>
          </div>
          <div className={`ds-card-body ${visible.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
            <DataState
              loading={loading}
              error={error}
              isEmpty={jobs.length === 0}
              onRetry={load}
              emptyTitle="هنوز وظیفه‌ای ثبت نشده"
              emptyDescription="با بارگذاری یک بستهٔ zip، اولین وظیفهٔ ورود داده ساخته می‌شود."
            >
              <TableWrap
                pagination={
                  jobs.length > PAGE_SIZE ? (
                    <Pagination page={page} pageSize={PAGE_SIZE} total={jobs.length} onPageChange={setPage} />
                  ) : undefined
                }
              >
                <thead>
                  <tr>
                    <th>قرارداد</th>
                    <th>وضعیت</th>
                    <th>تعداد آیتم</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((job) => {
                    const status = STATUS[job.status];
                    return (
                      <tr key={job.id}>
                        <td className="ds-code">{job.schemaVersion}</td>
                        <td>
                          {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>{job.status}</Badge>}
                        </td>
                        <td className="ds-table-numeric">{toPersianDigits(job.totalItems)}</td>
                        <td>
                          <Link className="text-link" href={`/admin/import/${job.id}`}>بررسی و انتشار ←</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </DataState>
          </div>
        </Card>
      </div>
    </>
  );
}
