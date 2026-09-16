"use client";

import Link from "next/link";
import { EmptyState, PageHeader } from "../components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-container" role="alert" aria-live="assertive">
      <PageHeader
        eyebrow="اختلال موقت"
        title="دریافت این صفحه ممکن نشد"
        description="اطلاعات ناقص یا قدیمی نمایش نمی‌دهیم. اتصال را بررسی کنید یا چند لحظهٔ دیگر دوباره تلاش کنید."
      />
      <EmptyState
        title="سرویس موقتاً پاسخ نمی‌دهد"
        description="این خطا به معنی حذف محتوا نیست و با تلاش دوباره ممکن است برطرف شود."
        action={(
          <div className="button-row">
            <button className="button button-primary" type="button" onClick={() => reset()}>تلاش دوباره</button>
            <Link className="button button-secondary" href="/">بازگشت به خانه</Link>
          </div>
        )}
      />
    </main>
  );
}
