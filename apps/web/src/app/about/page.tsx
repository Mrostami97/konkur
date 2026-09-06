import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "دربارهٔ محمد رستمی و kunkur01",
  description: "معرفی محمد رستمی، مسیر تحصیلی و روش تولید محتوای مستند در کنکورصفریک.",
  path: "/about",
});

const researchLink = "https://scholar.google.com/scholar?q=%22%D9%85%D8%AD%D9%85%D8%AF+%D8%B1%D8%B3%D8%AA%D9%85%DB%8C%22+%22%D8%AF%D8%A7%D9%86%D8%B4%DA%AF%D8%A7%D9%87+%D8%B5%D9%86%D8%B9%D8%AA%DB%8C+%D8%B4%D8%B1%DB%8C%D9%81%22";

export default function AboutPage() {
  return (
    <main className="page-container trust-page about-page">
      <PageHeader
        eyebrow="پشت کنکورصفریک"
        title="یک مسیر آموزشی با نام، منبع و مسئولیت روشن"
        description="کنکورصفریک را محمد رستمی برای تبدیل تجربهٔ مطالعه، تدریس و تحلیل کنکور کامپیوتر به یک مسیر قابل اعتماد و قابل جست‌وجو می‌سازد."
      />

      <section className="about-hero surface-card">
        <div className="about-hero-art" aria-hidden="true"><span>ک</span><i>۰۱</i></div>
        <div className="about-hero-copy">
          <div className="about-kicker"><span className="status-dot" /> پروفایل سازنده</div>
          <h2>محمد رستمی</h2>
          <p className="about-lead">دانش‌آموختهٔ دانشگاه صنعتی شریف در گرایش نرم‌افزار و پژوهشگر/مدرس حوزهٔ الگوریتم و محاسبات؛ با تمرکز بر آموزش شفاف، حل مسئله و همراهی داوطلبان ارشد و دکتری کامپیوتر.</p>
          <div className="subject-tags"><a href="https://t.me/konkurcom" target="_blank" rel="noreferrer">@konkurcom</a><span>ارشد و دکتری</span><span>مهندسی، IT و علوم کامپیوتر</span></div>
          <div className="about-actions"><a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">ارتباط در کانال رسمی</a><a className="button button-secondary" href={researchLink} target="_blank" rel="noreferrer">پژوهش‌ها و پایان‌نامه‌ها ↗</a></div>
        </div>
        <div className="about-logo-lockup"><Image src="/brand/konkurcom-logo.png" alt="نشان کنکورصفریک" width={150} height={150} priority /><span>kunkur01</span></div>
      </section>

      <div className="about-metrics" aria-label="تمرکز kunkur01">
        <div><strong>۱</strong><span>کانال رسمی و یکپارچه</span></div>
        <div><strong>۱۴۰۶</strong><span>اطلاعات با تاریخ بازبینی</span></div>
        <div><strong>۳</strong><span>مسیر: یادگیری، برنامه، تحلیل</span></div>
      </div>

      <div className="trust-layout about-grid">
        <section className="surface-card about-card about-card-dark">
          <span className="eyebrow eyebrow-dark">روایت حرفه‌ای</span>
          <h2>از حل سؤال تا ساختن مسیر</h2>
          <p>کارنامهٔ واقعی داوطلب فقط یک عدد نیست؛ نقطهٔ شروع یک تصمیم است. kunkur01 تلاش می‌کند پشت هر پیشنهاد، سرفصل رسمی، نمونهٔ قابل بررسی یا تجربهٔ آموزشی مشخص وجود داشته باشد.</p>
          <p>تمرکز محتوایی محمد رستمی روی درس‌های عمیق و مسئله‌محور مانند داده‌ساختار و الگوریتم، نظریهٔ زبان‌ها و ماشین‌ها و ریاضیات مورد نیاز کامپیوتر است؛ محتوایی که در کانال رسمی به‌صورت درس‌به‌درس و همراه با تحلیل منتشر می‌شود.</p>
        </section>

        <section className="surface-card about-card">
          <span className="eyebrow">آنچه در کانال می‌بینی</span>
          <h2>محتوا، نه وعدهٔ مبهم</h2>
          <ul className="about-list">
            <li><span>۰۱</span><div><strong>سرفصل و تغییرات</strong><small>آخرین وضعیت مواد امتحانی و ضرایب، با هشدار رجوع به دفترچهٔ سنجش.</small></div></li>
            <li><span>۰۲</span><div><strong>تدریس و حل مسئله</strong><small>نمونه‌های آموزشی برای فهم ایده، نه فقط حفظ پاسخ.</small></div></li>
            <li><span>۰۳</span><div><strong>کارنامه و تجربه</strong><small>روایت‌های داوطلبان با احترام به رضایت و حریم خصوصی.</small></div></li>
          </ul>
        </section>
      </div>

      <section className="surface-card about-proof">
        <div><span className="eyebrow">روش اعتماد</span><h2>چطور محتوا را بررسی می‌کنیم؟</h2></div>
        <div className="proof-steps"><div><strong>۱</strong><p>منبع رسمی یا پست اصلی ثبت می‌شود.</p></div><div><strong>۲</strong><p>محتوا به زبان مستقل و قابل فهم بازنویسی می‌شود.</p></div><div><strong>۳</strong><p>تاریخ بازبینی و محدودیت داده کنار مطلب می‌آید.</p></div></div>
      </section>

      <section className="about-cta">
        <div><span className="eyebrow">یک آدرس برای شروع</span><h2>مطالب جدید را از @konkurcom دنبال کن.</h2><p>تمام خبرها، سرفصل‌ها و محتوای آموزشی رسمی kunkur01 در همین کانال معرفی می‌شوند.</p></div>
        <a className="button button-light" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">رفتن به کانال ←</a>
      </section>
    </main>
  );
}
