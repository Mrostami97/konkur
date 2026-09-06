import type { Metadata } from "next";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({ title: "سیاست تحریریه و روش تولید محتوا", description: "روش منبع‌یابی، بازنویسی مستقل، بازبینی و به‌روزرسانی مطالب kunkur01.", path: "/editorial-policy" });
export default function EditorialPolicyPage() { return <main className="page-container trust-page"><PageHeader eyebrow="شفافیت تحریریه" title="هر ادعا باید قابل پیگیری باشد" description="این سیاست مشخص می‌کند محتوای kunkur01 چگونه از منبع به صفحهٔ قابل انتشار تبدیل می‌شود." /><div className="policy-steps">{[
  ["۱", "منبع‌یابی", "برای قوانین، زمان‌بندی و مواد آزمون، منبع رسمی سازمان سنجش اولویت دارد."],
  ["۲", "نگارش مستقل", "واقعیت‌ها استخراج می‌شوند، اما ساختار و متن با بیان اصیل kunkur01 نوشته می‌شود."],
  ["۳", "بازبینی", "نام نویسنده، بازبین و تاریخ آخرین کنترل روی صفحه دیده می‌شود."],
  ["۴", "انتشار و اصلاح", "اگر اصلاحیهٔ رسمی برسد، صفحه و تاریخ اعتبار آن به‌روزرسانی می‌شود."],
].map(([index, title, copy]) => <section className="surface-card" key={index}><span>{index}</span><h2>{title}</h2><p>{copy}</p></section>)}</div><section className="surface-card policy-note"><h2>استفاده از منابع دیگر</h2><p>مقاله، پاسخ تشریحی، کتاب یا محتوای اختصاصی رقبا کپی نمی‌شود. منابع بیرونی برای اعتبارسنجی واقعیت، مقایسه و استناد استفاده می‌شوند. محتوای کانال رسمی @konkurcom هنگام تبدیل به مقاله، لینک پست اصلی را حفظ می‌کند.</p></section></main>; }
