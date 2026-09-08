import type { Metadata } from "next";
import Link from "next/link";
import {
  accessModeLabel,
  formatPublicDate,
  resourceKindLabel,
  type PublicResourceRecord,
} from "../../components/PublicContent";
import { PageHeader } from "../../components/ui";
import { apiGetPublic } from "../../lib/api";
import { pageMetadata } from "../../lib/seo";

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  return pageMetadata({
    title: "منابع رایگان کنکور کامپیوتر",
    description: "دسترسی منظم به تحلیل‌ها، نمونه تدریس، پاسخ‌ها و راهنماهای رایگان کانال رسمی kunkur01.",
    path: "/resources",
    noIndex: Object.keys(searchParams).length > 0,
  });
}
const collections = [
  { icon: "▶", title: "نمونه تدریس و ویدئو", description: "ویدئوهای آموزشی و حل مسئله از آرشیو رسمی.", href: "https://t.me/konkurcom" },
  { icon: "PDF", title: "جزوه و فایل‌های رایگان", description: "فایل‌هایی که با اجازهٔ صاحب محتوا منتشر شده‌اند.", href: "https://t.me/konkurcom" },
  { icon: "✓", title: "تحلیل سؤال و پاسخ", description: "پاسخ‌ها و نکته‌هایی که به مبحث مرتبط می‌شوند.", href: "https://t.me/konkurcom" },
  { icon: "↗", title: "خبر و اطلاعیه", description: "آخرین خبرهای آزمون و آپدیت‌های kunkur01.", href: "https://t.me/konkurcom" },
];

export default async function ResourcesPage() {
  let unavailable = false;
  let resources: PublicResourceRecord[] = [];
  try {
    resources = (await apiGetPublic<PublicResourceRecord[]>("/resources")) ?? [];
  } catch {
    unavailable = true;
  }

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="کتابخانهٔ منابع"
        title="از یک لینک پراکنده تا یک مسیر قابل استفاده"
        description="منابع منتشرشده با نوع، سطح دسترسی، تاریخ بررسی و سند منبع نمایش داده می‌شوند؛ لینک اصلی محتوای مجاز نیز حفظ می‌شود."
      />
      {unavailable && (
        <aside className="official-disclaimer"><strong>نسخهٔ آفلاین</strong><p>فهرست ساختاریافته فعلاً در دسترس نیست؛ مسیرهای پایهٔ کانال رسمی همچنان قابل استفاده‌اند.</p></aside>
      )}
      {resources.length > 0 && (
        <section aria-labelledby="published-resources-title">
          <div className="section-heading"><div><span className="eyebrow">منتشرشده در سایت</span><h2 id="published-resources-title">منابع بررسی‌شده</h2><p>جزئیات هر منبع فقط از رکورد عمومی و تأییدشده خوانده می‌شود.</p></div></div>
          <div className="resource-grid">
            {resources.map((resource) => (
              <Link className="resource-card" href={`/resources/${resource.slug}`} key={resource.slug}>
                <span aria-hidden="true">{resource.kind === "VIDEO" ? "▶" : "◫"}</span>
                <h3>{resource.title}</h3>
                <p>{resource.summary}</p>
                <strong>{resourceKindLabel(resource.kind)} · {accessModeLabel(resource.accessMode)}</strong>
                {resource.reviewedAt && <small>بررسی {formatPublicDate(resource.reviewedAt)}</small>}
              </Link>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="telegram-resources-title">
        <div className="section-heading"><div><span className="eyebrow">کانال رسمی</span><h2 id="telegram-resources-title">مسیرهای پایهٔ آرشیو @konkurcom</h2></div></div>
        <div className="resource-grid">
          {collections.map((item) => (
            <a className="resource-card" href={item.href} target="_blank" rel="noreferrer" key={item.title}>
              <span>{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p><strong>بازکردن در تلگرام ←</strong>
            </a>
          ))}
        </div>
      </section>
      <section className="surface-card resource-process"><div><span className="eyebrow">شفافیت منبع</span><h2>از کانال تا کتابخانهٔ ساختاریافته</h2><p>هر رکورد با درس، مبحث، مقطع، نوع، تاریخ بررسی و وضعیت حقوق استفاده ثبت می‌شود؛ پیش‌نویس و منبع بدون مجوز در این فهرست دیده نمی‌شود.</p></div><Link className="button button-secondary" href="/articles/telegram-learning-archive">راهنمای استفاده</Link></section>
    </main>
  );
}
