import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "دربارهٔ محمد رستمی و kunkur01",
  description: "معرفی محمد رستمی، نقش او در کنکورصفریک و روش مستندسازی محتوای آموزشی.",
  path: "/about",
});

const thesisUrl =
  "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";

export default function AboutPage() {
  return (
    <main className="page-container trust-page about-page">
      <PageHeader
        eyebrow="پشت کنکورصفریک"
        title="یک مسیر آموزشی با نام، منبع و مسئولیت روشن"
        description="کنکورصفریک با مسئولیت محتوایی محمد رستمی ساخته می‌شود؛ جایی برای توضیح درس‌ها و تصمیم‌های کنکور کامپیوتر با مرز روشن میان سند، تحلیل و تجربه."
      />

      <section className="about-hero surface-card">
        <Image
          className="about-hero-art"
          src="/brand/mohammad-rostami.png"
          alt="محمد رستمی"
          width={150}
          height={150}
          priority
          style={{ objectFit: "cover" }}
        />
        <div className="about-hero-copy">
          <div className="about-kicker"><span className="status-dot" /> سازنده و مسئول محتوا</div>
          <h2>محمد رستمی</h2>
          <p className="about-lead">
            دانش‌آموختهٔ دانشگاه صنعتی شریف و مدرس حوزهٔ کنکور کامپیوتر است. نمونه‌ای قابل بررسی از مسیر دانشگاهی او، پایان‌نامهٔ «مسایل بهینه‌سازی شبکه روی منابع افرازشده» است که رکورد آن در کتابخانهٔ دانشگاه صنعتی شریف منتشر شده است.
          </p>
          <div className="subject-tags">
            <a href="https://t.me/konkurcom" target="_blank" rel="noreferrer">@konkurcom</a>
            <span>آموزش کنکور کامپیوتر</span>
            <span>تحلیل منبع‌محور</span>
          </div>
          <div className="about-actions">
            <a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">کانال رسمی</a>
            <a className="button button-secondary" href={thesisUrl} target="_blank" rel="noreferrer">پایان‌نامه در کتابخانهٔ شریف ↗</a>
          </div>
        </div>
        <div className="about-logo-lockup">
          <Image src="/brand/konkurcom-logo.png" alt="نشان کنکورصفریک" width={150} height={150} priority />
          <span>kunkur01</span>
        </div>
      </section>

      <section className="about-metrics" aria-label="اصول کاری کنکورصفریک">
        <div><strong>منبع</strong><span>پیوند به سند اصلی، هرجا در دسترس باشد</span></div>
        <div><strong>مرز</strong><span>جداسازی واقعیت، تحلیل و تجربه</span></div>
        <div><strong>اصلاح</strong><span>بازبینی اطلاعات زمان‌حساس و ثبت تغییر مهم</span></div>
      </section>

      <div className="trust-layout about-grid">
        <section className="surface-card about-card about-card-dark">
          <span className="eyebrow eyebrow-dark">نقش در سایت</span>
          <h2>آموزش و تحلیل، بدون وعدهٔ نتیجه</h2>
          <p>نقش محمد رستمی انتخاب موضوع، نگارش یا بازبینی محتوای آموزشی و توضیح مسیر تصمیم‌گیری برای داوطلبان است. صفحه‌های سایت باید نشان دهند کدام بخش از سند رسمی آمده و کدام بخش تفسیر آموزشی است.</p>
          <p>این معرفی ادعای تضمین رتبه، قبولی یا بی‌خطا بودن محتوا ندارد. نتیجهٔ هر داوطلب به شرایط فردی و مقررات همان دوره وابسته است و تصمیم نهایی باید با دفترچه و اطلاعیهٔ رسمی تطبیق داده شود.</p>
        </section>

        <section className="surface-card about-card">
          <span className="eyebrow">آنچه منتشر می‌کنیم</span>
          <h2>محتوای قابل پیگیری</h2>
          <ul className="about-list">
            <li><span>۰۱</span><div><strong>شرح درس و حل مسئله</strong><small>برای فهم ایده و روش حل؛ نه به‌عنوان جایگزین تمرین یا منبع رسمی آزمون.</small></div></li>
            <li><span>۰۲</span><div><strong>راهنمای تصمیم</strong><small>مقایسهٔ گزینه‌ها با ذکر فرض‌ها، محدودیت‌ها و تاریخ اطلاعات.</small></div></li>
            <li><span>۰۳</span><div><strong>خبر و تغییرات آزمون</strong><small>با ارجاع به مرجع منتشرکننده و هشدار دربارهٔ اصلاحیه‌های بعدی.</small></div></li>
          </ul>
        </section>
      </div>

      <section className="surface-card about-proof">
        <div><span className="eyebrow">مسیر اعتماد</span><h2>از ادعا تا مطلب منتشرشده</h2></div>
        <div className="proof-steps">
          <div><strong>۱</strong><p>مرجع و تاریخ دسترسی ثبت می‌شود.</p></div>
          <div><strong>۲</strong><p>واقعیت از برداشت آموزشی جدا می‌ماند.</p></div>
          <div><strong>۳</strong><p>خطای مؤثر اصلاح و برای خواننده توضیح داده می‌شود.</p></div>
        </div>
      </section>

      <section className="about-cta">
        <div>
          <span className="eyebrow">شفافیت بیشتر</span>
          <h2>روش کار و مسئولیت‌های ما را بخوان.</h2>
          <p>سیاست تحریریه، استفاده از منابع و شیوهٔ اصلاح محتوا جداگانه و روشن نوشته شده‌اند.</p>
        </div>
        <Link className="button button-light" href="/editorial-policy">روش تولید محتوا ←</Link>
      </section>
    </main>
  );
}
