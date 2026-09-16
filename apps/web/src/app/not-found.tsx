import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "../components/ui";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد",
  description: "نشانی درخواستی در کنکورصفریک پیدا نشد.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="page-container">
      <PageHeader
        eyebrow="خطای ۴۰۴"
        title="این صفحه پیدا نشد"
        description="ممکن است نشانی تغییر کرده باشد یا محتوای موردنظر هنوز منتشر نشده باشد."
      />
      <EmptyState
        title="از یک مسیر معتبر ادامه بدهید"
        description="از صفحهٔ اصلی یا راهنماهای به‌روز کنکور، مسیر مناسب را پیدا کنید."
        action={(
          <div className="button-row">
            <Link className="button button-primary" href="/">بازگشت به خانه</Link>
            <Link className="button button-secondary" href="/guides">مشاهدهٔ راهنماها</Link>
          </div>
        )}
      />
    </main>
  );
}
