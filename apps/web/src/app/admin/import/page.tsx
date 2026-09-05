"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch, apiUpload, ApiError } from "../../../lib/api";

interface ImportJob {
  id: string;
  schemaVersion: string;
  status: string;
  totalItems: number;
  createdAt: string;
}

function ImportAdmin() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setJobs(await apiFetch<ImportJob[]>("/admin/import"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await apiUpload("/admin/import", file);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بارگذاری ناموفق بود");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>ورود داده (Import)</h1>
      <p>
        یک فایل zip حاوی <code>payload.json</code> (مطابق قرارداد article.v1،
        report-card.v1 یا question.v1) و رسانه‌های مرتبط بارگذاری کنید.
      </p>
      <input type="file" accept=".zip" onChange={onFileChange} disabled={uploading} />
      {uploading && <p>در حال پردازش...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h2>وظیفه‌های ورود داده</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>قرارداد</th>
            <th style={{ textAlign: "right" }}>وضعیت</th>
            <th style={{ textAlign: "right" }}>تعداد آیتم</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
              <td style={{ padding: "0.4rem" }}>{job.schemaVersion}</td>
              <td style={{ padding: "0.4rem" }}>{job.status}</td>
              <td style={{ padding: "0.4rem" }}>{job.totalItems}</td>
              <td style={{ padding: "0.4rem" }}>
                <Link href={`/admin/import/${job.id}`}>مشاهده و بررسی</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function ImportAdminPage() {
  return (
    <AdminGuard>
      <ImportAdmin />
    </AdminGuard>
  );
}
