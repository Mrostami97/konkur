import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({ title: "منابع رایگان کنکور کامپیوتر", description: "دسترسی منظم به تحلیل‌ها، نمونه تدریس، پاسخ‌ها و راهنماهای رایگان کانال رسمی kunkur01.", path: "/resources" });
const collections = [
  { icon: "▶", title: "نمونه تدریس و ویدئو", description: "ویدئوهای آموزشی و حل مسئله از آرشیو رسمی.", href: "https://t.me/konkurcom" },
  { icon: "PDF", title: "جزوه و فایل‌های رایگان", description: "فایل‌هایی که با اجازهٔ صاحب محتوا منتشر شده‌اند.", href: "https://t.me/konkurcom" },
  { icon: "✓", title: "تحلیل سؤال و پاسخ", description: "پاسخ‌ها و نکته‌هایی که به مبحث مرتبط می‌شوند.", href: "https://t.me/konkurcom" },
  { icon: "↗", title: "خبر و اطلاعیه", description: "آخرین خبرهای آزمون و آپدیت‌های kunkur01.", href: "https://t.me/konkurcom" },
];
export default function ResourcesPage() { return <main className="page-container"><PageHeader eyebrow="کتابخانهٔ رایگان" title="منابع پراکنده را به مسیر قابل استفاده تبدیل کن" description="نسخهٔ اول کتابخانه، آرشیو رسمی تلگرام را دسته‌بندی می‌کند. هر محتوای منتقل‌شده به سایت لینک پست اصلی را حفظ خواهد کرد." /><div className="resource-grid">{collections.map((item) => <a className="resource-card" href={item.href} target="_blank" rel="noreferrer" key={item.title}><span>{item.icon}</span><h2>{item.title}</h2><p>{item.description}</p><strong>بازکردن در تلگرام ←</strong></a>)}</div><section className="surface-card resource-process"><div><span className="eyebrow">در حال توسعه</span><h2>از کانال تا کتابخانهٔ ساختاریافته</h2><p>محتواها به‌تدریج با درس، مبحث، مقطع، نوع فایل و تاریخ اعتبار برچسب می‌خورند؛ بدون حذف لینک منبع اصلی.</p></div><Link className="button button-secondary" href="/articles/telegram-learning-archive">راهنمای استفاده</Link></section></main>; }
