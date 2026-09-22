"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import {
  AdminPageHeader,
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataState,
  TableWrap,
} from "../../../components/ds";

interface Backtest {
  id: string;
  estimatorVersion: string;
  sampleSize: number;
  coverageP50: number;
  coverageP80: number;
  meanAbsPercentError: number;
  computedAt: string;
}

const percent = (value: number, digits = 0) => `${toPersianDigits((value * 100).toFixed(digits))}٪`;

export default function AnalyticsAdminPage() {
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBacktests(await apiFetch<Backtest[]>("/admin/analytics/backtests"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خواندن فهرست بک‌تست‌ها ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBacktest() {
    setRunning(true);
    setRunError(null);
    try {
      await apiFetch("/admin/analytics/backtest", { method: "POST" });
      setConfirming(false);
      await load();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "بک‌تست ناموفق بود.");
      setConfirming(false);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="بک‌تست تخمین رتبه"
        description="هر کارنامه به‌عنوان یک نمونهٔ آزمایشی در نظر گرفته می‌شود؛ رتبه‌اش با کارنامه‌های مشابه تخمین زده و با رتبهٔ واقعی مقایسه می‌شود."
        action={<Button variant="primary" onClick={() => setConfirming(true)}>اجرای بک‌تست تازه</Button>}
      />

      {runError && <Alert tone="danger">{runError}</Alert>}

      <Card padded={false}>
        <div className="ds-card-head">
          <div>
            <h2 className="ds-card-title">بک‌تست‌های اجراشده</h2>
            <p>پوشش یعنی چند درصد رتبه‌های واقعی داخل بازهٔ اعلام‌شده افتاده‌اند.</p>
          </div>
        </div>
        <div className={`ds-card-body ${backtests.length && !loading && !error ? "ds-card-body-flush" : ""}`}>
          <DataState
            loading={loading}
            error={error}
            isEmpty={backtests.length === 0}
            onRetry={load}
            emptyTitle="هنوز بک‌تستی اجرا نشده"
            emptyDescription="برای سنجش دقت تخمین‌گر، یک بک‌تست اجرا کنید."
          >
            <TableWrap>
              <thead>
                <tr>
                  <th>نسخهٔ تخمین‌گر</th>
                  <th>حجم نمونه</th>
                  <th>پوشش ۵۰٪</th>
                  <th>پوشش ۸۰٪</th>
                  <th>میانگین خطای درصدی</th>
                </tr>
              </thead>
              <tbody>
                {backtests.map((item) => (
                  <tr key={item.id}>
                    <td className="ds-code">{item.estimatorVersion}</td>
                    <td className="ds-table-numeric">{toPersianDigits(item.sampleSize)}</td>
                    <td className="ds-table-numeric">{percent(item.coverageP50)}</td>
                    <td className="ds-table-numeric">{percent(item.coverageP80)}</td>
                    <td className="ds-table-numeric">{percent(item.meanAbsPercentError, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </DataState>
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="اجرای بک‌تست تازه؟"
        description="این کار روی همهٔ کارنامه‌های موجود اجرا می‌شود و بسته به حجم داده ممکن است طول بکشد."
        confirmLabel="اجرا کن"
        busy={running}
        onConfirm={runBacktest}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
