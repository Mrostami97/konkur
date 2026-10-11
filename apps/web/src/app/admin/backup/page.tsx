"use client";

import { useState } from "react";
import { API_URL } from "../../../lib/api";
import { AdminPageHeader, Alert, Card } from "../../../components/ds";

const CONTENTS = [
  ["دیتابیس کامل", "کاربران، سفارش‌ها و پرداخت‌ها، سؤال‌ها، آزمون‌ها و پاسخ‌ها، مقاله‌ها، دوره‌ها، کارنامه‌ها و همهٔ تنظیمات سایت (database.sql.gz)"],
  ["همهٔ فایل‌ها", "تصویرها و فایل‌های سؤال‌ها و مقاله‌ها، جزوه‌ها، تصویرها و ویدیوهای آپلودی درس‌ها و عکس نتایج شاگردان (پوشهٔ media)"],
  ["راهنما و فهرست", "README.txt با روش بازگردانی و manifest.json با زمان پشتیبان و فهرست فایل‌ها"],
];

export default function BackupAdminPage() {
  const [started, setStarted] = useState(false);

  return (
    <>
      <AdminPageHeader
        title="پشتیبان‌گیری کامل"
        description="یک فایل از کل سایت، دیتابیس و همهٔ فایل‌ها، که روی سیستم خودت دانلود می‌شود."
      />

      <Card>
        <h2 className="ds-card-title">در فایل پشتیبان چه هست</h2>
        <ul style={{ margin: "var(--sp-3) 0 var(--sp-4)", paddingInlineStart: "var(--sp-5)", display: "grid", gap: "var(--sp-2)" }}>
          {CONTENTS.map(([title, body]) => (
            <li key={title}>
              <strong>{title}:</strong> {body}
            </li>
          ))}
        </ul>
        <a
          className="ds-btn ds-btn-primary"
          href={`${API_URL}/admin/backup`}
          download
          onClick={() => setStarted(true)}
        >
          دانلود پشتیبان کامل
        </a>
        {started && (
          <div style={{ marginTop: "var(--sp-4)" }}>
            <Alert tone="info">
              دانلود چند ثانیه بعد از آماده شدن دیتابیس در نوار دانلود مرورگر شروع می‌شود. تا تمام نشده این صفحه را نبند.
            </Alert>
          </div>
        )}
      </Card>

      <Alert tone="warning">
        این فایل شمارهٔ موبایل و اطلاعات همهٔ کاربران را دارد؛ جای امن نگهش دار و برای کسی نفرست. رمزها و کلیدهای فایل .env سرور
        (پیامک، اسپات‌پلیر، دیتابیس) در پشتیبان نیستند و باید جدا نگه داشته شوند. فایل با پسوند tar است و با خود ویندوز یا 7-Zip باز می‌شود.
      </Alert>
    </>
  );
}
