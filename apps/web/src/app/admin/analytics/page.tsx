"use client";

import { useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Backtest {
  id: string;
  estimatorVersion: string;
  sampleSize: number;
  coverageP50: number;
  coverageP80: number;
  meanAbsPercentError: number;
  computedAt: string;
}

function AnalyticsAdmin() {
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBacktests(await apiFetch<Backtest[]>("/admin/analytics/backtests"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function runBacktest() {
    setRunning(true);
    setError(null);
    try {
      await apiFetch("/admin/analytics/backtest", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "بک‌تست ناموفق بود");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>بک‌تست تخمین رتبه</h1>
      <p style={{ fontSize: "0.85rem", color: "#486581" }}>
        هر کارنامه به‌عنوان یک نمونه آزمایشی در نظر گرفته می‌شود؛ رتبه آن با استفاده از سایر کارنامه‌های
        مشابه تخمین زده می‌شود و با رتبه واقعی مقایسه می‌گردد.
      </p>
      <button onClick={runBacktest} disabled={running}>
        {running ? "در حال اجرا..." : "اجرای بک‌تست جدید"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>نسخه</th>
            <th style={{ textAlign: "right" }}>نمونه</th>
            <th style={{ textAlign: "right" }}>پوشش ۵۰٪</th>
            <th style={{ textAlign: "right" }}>پوشش ۸۰٪</th>
            <th style={{ textAlign: "right" }}>میانگین خطای درصدی</th>
          </tr>
        </thead>
        <tbody>
          {backtests.map((b) => (
            <tr key={b.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
              <td style={{ padding: "0.4rem" }}>{b.estimatorVersion}</td>
              <td style={{ padding: "0.4rem" }}>{b.sampleSize}</td>
              <td style={{ padding: "0.4rem" }}>{(b.coverageP50 * 100).toFixed(0)}٪</td>
              <td style={{ padding: "0.4rem" }}>{(b.coverageP80 * 100).toFixed(0)}٪</td>
              <td style={{ padding: "0.4rem" }}>{(b.meanAbsPercentError * 100).toFixed(1)}٪</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function AnalyticsAdminPage() {
  return (
    <AdminGuard>
      <AnalyticsAdmin />
    </AdminGuard>
  );
}
