import type { Metadata } from "next";
import Link from "next/link";
import {
  accessModeLabel,
  formatPublicDate,
  resourceKindLabel,
  type PublicResourceRecord,
} from "../../components/PublicContent";
import { EmptyState, PageHeader } from "../../components/ui";
import { findSubject, subjects } from "../../content/editorial";
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

const fieldOptions = [
  { value: "computer-engineering", label: "مهندسی کامپیوتر" },
  { value: "information-technology", label: "مهندسی فناوری اطلاعات" },
  { value: "computer-science", label: "علوم کامپیوتر" },
];

const kindOptions = [
  "NOTE",
  "VIDEO",
  "PDF",
  "EXTERNAL_LINK",
  "OFFICIAL_NOTICE",
  "ACADEMIC_SYLLABUS",
  "OLYMPIAD_PROBLEM_SET",
  "OLYMPIAD_SOLUTION",
  "TELEGRAM_POST",
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function publicResourceQuery(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const key of ["degree", "field", "subject", "topic", "kind", "reviewedFrom", "reviewedTo"]) {
    const value = firstParam(searchParams[key]);
    if (value?.trim()) query.set(key, value.trim());
  }
  const serialized = query.toString();
  return serialized ? `/resources?${serialized}` : "/resources";
}

export default async function ResourcesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const requestedSubject = firstParam(searchParams.subject);
  const subject = requestedSubject ? findSubject(requestedSubject) : undefined;
  let unavailable = false;
  let resources: PublicResourceRecord[] = [];
  try {
    resources = (await apiGetPublic<PublicResourceRecord[]>(publicResourceQuery(searchParams))) ?? [];
  } catch {
    unavailable = true;
  }
  const visibleResources = resources;
  const hasFilters = ["degree", "field", "subject", "topic", "kind", "reviewedFrom", "reviewedTo"]
    .some((key) => Boolean(firstParam(searchParams[key])?.trim()));

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="کتابخانهٔ منابع"
        title={subject ? `منابع ${subject.shortTitle}` : "از یک لینک پراکنده تا یک مسیر قابل استفاده"}
        description={subject
          ? `منابع منتشرشده و بررسی‌شدهٔ متصل به درس ${subject.title}؛ نتیجهٔ خالی با دادهٔ ساختگی پر نمی‌شود.`
          : "منابع منتشرشده با نوع، سطح دسترسی، تاریخ بررسی و سند منبع نمایش داده می‌شوند؛ لینک اصلی محتوای مجاز نیز حفظ می‌شود."}
        action={subject ? <Link className="button button-secondary" href="/resources">همهٔ منابع ←</Link> : undefined}
      />
      {unavailable && (
        <aside className="official-disclaimer"><strong>نسخهٔ آفلاین</strong><p>فهرست ساختاریافته فعلاً در دسترس نیست؛ مسیرهای پایهٔ کانال رسمی همچنان قابل استفاده‌اند.</p></aside>
      )}
      <section className="surface-card" aria-labelledby="resource-filters-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">فیلتر دقیق</span>
            <h2 id="resource-filters-title">منبع مناسب همین مسیر را پیدا کن</h2>
            <p>فیلترها مستقیماً روی رکوردهای منتشرشده اعمال می‌شوند و پیش‌نویس‌ها در نتیجه ظاهر نمی‌شوند.</p>
          </div>
        </div>
        <form action="/resources" method="get" className="field-grid field-grid-two">
          <label className="field-group">
            <span>مقطع</span>
            <select className="field-input" name="degree" defaultValue={firstParam(searchParams.degree) ?? ""}>
              <option value="">همهٔ مقاطع</option>
              <option value="MASTER">ارشد</option>
              <option value="PHD">دکتری</option>
            </select>
          </label>
          <label className="field-group">
            <span>رشته</span>
            <select className="field-input" name="field" defaultValue={firstParam(searchParams.field) ?? ""}>
              <option value="">همهٔ رشته‌ها</option>
              {fieldOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>درس</span>
            <select className="field-input" name="subject" defaultValue={requestedSubject ?? ""}>
              <option value="">همهٔ درس‌ها</option>
              {subjects.map((item) => <option value={item.slug} key={item.slug}>{item.shortTitle}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>کد مبحث</span>
            <input className="field-input" type="text" name="topic" defaultValue={firstParam(searchParams.topic) ?? ""} placeholder="مثلاً quick-sort" dir="ltr" />
          </label>
          <label className="field-group">
            <span>نوع منبع</span>
            <select className="field-input" name="kind" defaultValue={firstParam(searchParams.kind) ?? ""}>
              <option value="">همهٔ نوع‌ها</option>
              {kindOptions.map((kind) => <option value={kind} key={kind}>{resourceKindLabel(kind)}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>بررسی‌شده از تاریخ</span>
            <input className="field-input" type="date" name="reviewedFrom" defaultValue={firstParam(searchParams.reviewedFrom) ?? ""} />
          </label>
          <label className="field-group">
            <span>بررسی‌شده تا تاریخ</span>
            <input className="field-input" type="date" name="reviewedTo" defaultValue={firstParam(searchParams.reviewedTo) ?? ""} />
          </label>
          <div className="cluster">
            <button className="button button-primary" type="submit">اعمال فیلترها</button>
            {hasFilters && <Link className="button button-secondary" href="/resources">پاک‌کردن فیلترها</Link>}
          </div>
        </form>
      </section>
      {visibleResources.length > 0 && (
        <section aria-labelledby="published-resources-title">
          <div className="section-heading"><div><span className="eyebrow">منتشرشده در سایت</span><h2 id="published-resources-title">منابع بررسی‌شده</h2><p>جزئیات هر منبع فقط از رکورد عمومی و تأییدشده خوانده می‌شود.</p></div></div>
          <div className="resource-grid">
            {visibleResources.map((resource) => (
              <Link className="resource-card" href={`/resources/${resource.slug}`} key={resource.slug}>
                <span aria-hidden="true">{resource.kind === "VIDEO" ? "▶" : "◫"}</span>
                <h3>{resource.title}</h3>
                <p>{resource.summary}</p>
                <strong>{resource.catalogProfile?.learningType ?? resourceKindLabel(resource.kind)} · {accessModeLabel(resource.accessMode)}</strong>
                {resource.reviewedAt && <small>بررسی {formatPublicDate(resource.reviewedAt)}</small>}
              </Link>
            ))}
          </div>
        </section>
      )}
      {hasFilters && visibleResources.length === 0 && !unavailable && !subject && (
        <EmptyState
          title="منبع منتشرشده‌ای با این فیلترها پیدا نشد"
          description="فیلترها را ساده‌تر کن؛ نتیجهٔ خالی با لینک یا محتوای تأییدنشده پر نمی‌شود."
          action={<Link className="button button-secondary" href="/resources">پاک‌کردن فیلترها</Link>}
        />
      )}
      {subject && visibleResources.length === 0 && !unavailable && (
        <EmptyState
          title={`هنوز منبع منتشرشده‌ای برای ${subject.shortTitle} ثبت نشده است`}
          description="این نتیجه عمداً خالی است؛ منابع پس از ثبت منبع، وضعیت حقوق استفاده و بازبینی نمایش داده می‌شوند."
          action={<a className="button button-secondary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">دیدن آرشیو @konkurcom</a>}
        />
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
      <section className="surface-card" aria-labelledby="resource-comparison-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">مقایسهٔ بی‌طرف</span>
            <h2 id="resource-comparison-title">پنج معیار قبل از انتخاب منبع</h2>
            <p>مشهوربودن یا رایگان‌بودن به‌تنهایی معیار کافی نیست؛ منبع باید با وضعیت واقعی تو جور باشد.</p>
          </div>
        </div>
        <div className="responsive-table">
          <table>
            <thead><tr><th>معیار</th><th>چه چیزی ثبت می‌شود؟</th><th>قاعدهٔ تصمیم</th></tr></thead>
            <tbody>
              <tr><td>سطح شروع</td><td>پایه، متوسط یا مرور</td><td>منبعی بردار که اولین فصلش برایت قابل دنبال‌کردن باشد.</td></tr>
              <tr><td>پوشش</td><td>فصل‌ها و مباحث مشخص</td><td>پوشش را با سرفصل مسیر خودت مقایسه کن، نه با تعداد صفحات.</td></tr>
              <tr><td>حجم</td><td>مدت ویدئو یا تعداد صفحه</td><td>حجمی انتخاب کن که تا موعد مرور واقعاً تمام شود.</td></tr>
              <tr><td>نمونه</td><td>نمونهٔ مجاز یا لینک اصلی</td><td>قبل از تصمیم، بیان مدرس و سطح تمرین را با نمونه بسنج.</td></tr>
              <tr><td>هزینه</td><td>رایگان، عضویت یا نیازمند تهیه</td><td>هزینه را کنار زمان و شکاف آموزشی بسنج؛ نه جدا از آن‌ها.</td></tr>
            </tbody>
          </table>
        </div>
        <Link className="text-link" href="/guides/choose-study-resources">راهنمای کامل انتخاب منبع ←</Link>
      </section>
      <section className="surface-card resource-process"><div><span className="eyebrow">شفافیت منبع</span><h2>از کانال تا کتابخانهٔ ساختاریافته</h2><p>هر رکورد با درس، مبحث، مقطع، نوع، تاریخ بررسی و وضعیت حقوق استفاده ثبت می‌شود؛ پیش‌نویس و منبع بدون مجوز در این فهرست دیده نمی‌شود.</p></div><Link className="button button-secondary" href="/articles/telegram-learning-archive">راهنمای استفاده</Link></section>
    </main>
  );
}
