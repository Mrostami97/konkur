import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, StatCard } from "../../components/ui";
import { StructuredData } from "../../components/StructuredData";
import { EvidenceFigures } from "../../components/EvidenceFigures";
import { evidenceStats, ownerResults } from "../../content/evidence";
import { EXAM_DATES } from "../../lib/exam-dates";
import { absoluteUrl, OWNER_PERSON_ID, pageMetadata, SITE_NAME } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "محمد رستمی، مدرس کنکور ارشد کامپیوتر از دانشگاه شریف",
  description:
    "کارشناس ارشد نرم‌افزار با گرایش الگوریتم و محاسبات از دانشگاه صنعتی شریف و چند ترم دستیار آموزشی. مسیر آموزشی، روش تدریس و مستندات تطبیق کلاس با سؤالات کنکور.",
  path: "/about",
});

const thesisUrl =
  "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";
const telegramUrl = "https://t.me/konkurcom";
const roleTitle = "کارشناس ارشد مهندسی نرم‌افزار، گرایش الگوریتم و محاسبات، دانشگاه صنعتی شریف";

// One Person, described once, so search and answer engines resolve the author
// of every article on the site to the same identity.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  url: absoluteUrl("/about"),
  inLanguage: "fa-IR",
  mainEntity: {
    "@type": "Person",
    "@id": OWNER_PERSON_ID,
    name: "محمد رستمی",
    jobTitle: "مدرس کنکور ارشد و دکتری کامپیوتر",
    description: roleTitle,
    image: absoluteUrl("/brand/mohammad-rostami.png"),
    url: absoluteUrl("/about"),
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "دانشگاه صنعتی شریف",
      sameAs: "https://www.sharif.edu",
    },
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "degree",
      name: "کارشناسی ارشد مهندسی نرم‌افزار، گرایش الگوریتم و محاسبات",
      recognizedBy: { "@type": "CollegeOrUniversity", name: "دانشگاه صنعتی شریف" },
    },
    knowsAbout: [
      "طراحی الگوریتم",
      "ساختمان داده",
      "نظریه زبان‌ها و ماشین‌ها",
      "کنکور کارشناسی ارشد مهندسی کامپیوتر",
    ],
    subjectOf: {
      "@type": "Thesis",
      name: "مسایل بهینه‌سازی شبکه روی منابع افرازشده",
      url: thesisUrl,
    },
    sameAs: [telegramUrl],
    // Points at the Organization the root layout already publishes on every
    // page, so the person and the site resolve as one connected entity.
    worksFor: { "@id": `${absoluteUrl("/")}#organization`, name: SITE_NAME },
  },
};

export default function AboutPage() {
  return (
    <main className="page-container trust-page about-page">
      <StructuredData data={personJsonLd} />
      <PageHeader
        eyebrow="کسی که پشت این کلاس‌هاست"
        title="من محمد رستمی‌ام و کنکور کامپیوتر را از پایه درس می‌دهم"
        description="ارشدم را در دانشگاه صنعتی شریف گرفتم و چند ترم همان‌جا دستیار آموزشی بودم. اینجا کنکور ارشد کامپیوتر را درس می‌دهم؛ از مباحث پایه تا حل تست."
      />

      <section className="about-hero surface-card">
        <Image
          className="about-hero-art"
          src="/brand/mohammad-rostami.png"
          alt="محمد رستمی، مدرس کنکور ارشد کامپیوتر"
          width={150}
          height={150}
          priority
          style={{ objectFit: "cover" }}
        />
        <div className="about-hero-copy">
          <div className="about-kicker"><span className="status-dot" /> مدرس و مسئول محتوای کنکور کامپیوتر</div>
          <h2>محمد رستمی</h2>
          <p className="about-lead">
            گرایشم در ارشد نرم‌افزار بود، با زیرگرایش الگوریتم و محاسبات؛ یعنی درس‌هایی مثل طراحی الگوریتم و
            ساختمان داده که برای خیلی از داوطلب‌ها سخت‌ترین بخش کنکورند، کار هرروزهٔ من بوده‌اند. سرفصل کامل
            درس‌های کامپیوتر را برای {EXAM_DATES.master1406.label} درس داده‌ام و برای کسی که از صفر شروع می‌کند،
            بیش از هشت ساعت فقط مباحث پایه گفته‌ام.
          </p>
          <div className="subject-tags">
            <span>طراحی الگوریتم</span>
            <span>ساختمان داده</span>
            <span>نظریه زبان‌ها و ماشین‌ها</span>
          </div>
          <div className="about-actions">
            <Link className="button button-primary" href="/free-videos">ویدیوهای رایگان را ببین</Link>
            <Link className="button button-secondary" href="/consultations">مشاوره با من</Link>
          </div>
        </div>
        <div className="about-logo-lockup">
          <Image src="/brand/konkurcom-logo.png" alt="نشان کنکور کامپیوتر" width={150} height={150} priority />
          <span dir="ltr">kunkurcomputer.ir</span>
        </div>
      </section>

      <section className="about-metrics" aria-label="سابقهٔ آموزشی محمد رستمی">
        <div><strong>دانشگاه شریف</strong><span>کارشناسی ارشد نرم‌افزار، گرایش الگوریتم و محاسبات</span></div>
        <div><strong>دستیار آموزشی</strong><span>چند ترم در دانشگاه صنعتی شریف</span></div>
        <div><strong>۸ ساعت پایه</strong><span>برای کسی که از رشتهٔ دیگر یا از صفر شروع می‌کند</span></div>
      </section>

      <section className="surface-card owner-results-section" aria-labelledby="owner-results">
        <span className="eyebrow">خودم هم کنکور داده‌ام</span>
        <h2 id="owner-results">آنچه درس می‌دهم را سر جلسهٔ کنکور امتحان کرده‌ام</h2>
        <p>
          در کنکور دکتری ۱۴۰۱ مهندسی کامپیوتر شرکت کردم تا ببینم دوره‌ای که درس داده بودم سر جلسه چقدر جواب می‌دهد.
          کارنامه و پاسخ‌نامه‌ام اینجاست؛ شمارهٔ داوطلبی را پوشانده‌ام.
        </p>
        <div className="owner-results">
          {ownerResults.map((item) => (
            <article className="owner-result" key={item.id}>
              <small>{item.subject}{item.year !== "—" ? ` · ${item.year}` : ""}</small>
              <strong>{item.metric}</strong>
              <p>{item.description}</p>
              <EvidenceFigures images={item.images} />
            </article>
          ))}
        </div>
      </section>

      <section aria-label="مستندات تطبیق کلاس با کنکور">
        <div className="about-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
          {evidenceStats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} tone={stat.tone} />
          ))}
        </div>
      </section>

      <div className="trust-layout about-grid">
        <section className="surface-card about-card about-card-dark">
          <span className="eyebrow eyebrow-dark">چطور درس می‌دهم</span>
          <h2>اول می‌فهمی، بعد تست می‌زنی</h2>
          <p>
            در کلاس‌هایم اول ایده را باز می‌کنم که چرا یک روش جواب می‌دهد، بعد سراغ تست می‌رویم. تستی که فقط با
            حفظ کردن فرمول زده شود، با کوچک‌ترین تغییر در صورت سؤال از دست می‌رود؛ تستی که ایده‌اش را فهمیده باشی،
            نه.
          </p>
          <p>
            قول قبولی نمی‌دهم، چون هیچ‌کس نمی‌تواند صادقانه بدهد. نتیجهٔ هر داوطلب به تلاش و شرایط خودش و مقررات همان
            سال بستگی دارد. چیزی که می‌توانم قول بدهم این است که آنچه درس می‌دهم دقیق باشد و مسیر را روشن کند.
          </p>
        </section>

        <section className="surface-card about-card">
          <span className="eyebrow">با من چه کار می‌توانی بکنی</span>
          <h2>سه راه برای شروع</h2>
          <ul className="about-list">
            <li>
              <span>۰۱</span>
              <div>
                <strong><Link href="/courses">دوره‌ها</Link></strong>
                <small>سرفصل کامل {EXAM_DATES.master1406.label}، از مباحث پایه تا حل تست. دوره‌ها به‌زودی روی همین سایت منتشر می‌شوند؛ تا آن موقع ویدیوی چند جلسه از کلاس‌هایم رایگان در کانال تلگرام هست تا ببینی با روش من کنار می‌آیی یا نه.</small>
              </div>
            </li>
            <li>
              <span>۰۲</span>
              <div>
                <strong><Link href="/consultations">مشاوره</Link></strong>
                <small>اگر نمی‌دانی از کجا شروع کنی، کدام مجموعه به تو می‌خورد یا برنامه‌ات کجا می‌لنگد.</small>
              </div>
            </li>
            <li>
              <span>۰۳</span>
              <div>
                <strong><Link href="/articles">راهنماهای رایگان</Link></strong>
                <small>انتخاب رشته، برنامه‌ریزی، منابع و تحلیل آزمون؛ هرکدام با منبع رسمی.</small>
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section className="surface-card about-proof">
        <div><span className="eyebrow">قاعده‌هایی که رعایت می‌کنم</span><h2>چرا می‌توانی به این محتوا اعتماد کنی</h2></div>
        <div className="proof-steps">
          <div><strong>۱</strong><p>هر عدد رسمی، از تاریخ آزمون تا ضریب درس، به سند اصلی‌اش لینک دارد.</p></div>
          <div><strong>۲</strong><p>جایی که نظر خودم است، صریح می‌گویم نظر است، نه خبر.</p></div>
          <div><strong>۳</strong><p>اگر اشتباه کنم، اصلاحش می‌کنم و می‌نویسم چه چیزی عوض شد.</p></div>
        </div>
      </section>

      <section className="about-cta">
        <div>
          <span className="eyebrow">سند، نه ادعا</span>
          <h2>نتایج دانشجوها و سؤال‌هایی که درست پیش‌بینی شد</h2>
          <p>
            از جمله سؤالی که خودم تألیف کرده بودم و در کنکور ۱۴۰۱ آمد. همه با تصویر سند اصلی، تا خودت
            ببینی و قضاوت کنی.
          </p>
        </div>
        <Link className="button button-light" href="/evidence">دیدن مستندات ←</Link>
      </section>

      <p className="about-footnote" style={{ fontSize: "var(--text-sm)", color: "var(--muted)", textAlign: "center" }}>
        پایان‌نامهٔ کارشناسی ارشدم، «مسایل بهینه‌سازی شبکه روی منابع افرازشده»، در{" "}
        <a className="text-link" href={thesisUrl} target="_blank" rel="noreferrer">کتابخانهٔ دانشگاه شریف</a> ثبت است.
        کانال رسمی:{" "}
        <a className="text-link" href={telegramUrl} target="_blank" rel="noreferrer">‎@konkurcom</a>
        {" · "}
        <Link className="text-link" href="/editorial-policy">روش تولید محتوا</Link>
      </p>
    </main>
  );
}
