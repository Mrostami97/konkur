import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BuyButton } from "../../components/BuyButton";
import { StructuredData } from "../../components/StructuredData";
import { apiGetPublic } from "../../lib/api";
import { formatPersianNumber, formatToman } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import { TELEGRAM_URL } from "../../lib/site-nav";
import "./consult.css";

interface Offering {
  id: string;
  kind: "SINGLE_SESSION" | "PACKAGE";
  sessionQuota: number;
  durationMinutes: number;
  validUntil: string | null;
  headline: string;
  description: string;
  instructorProfile: { slug: string; displayName: string; roleTitle: string | null; avatarUrl: string | null };
  productId: string;
  amountRial: number | null;
}

/** The prices the owner set; the live offerings, once defined in admin, take over. */
const ANNUAL_PRICE_RIAL = 150_000_000;
const SESSION_PRICE_RIAL = 3_000_000;

async function loadOfferings() {
  try {
    return (await apiGetPublic<Offering[]>("/consultations")) ?? [];
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "مشاورهٔ کنکور کامپیوتر: طرح سالانه و جلسهٔ تکی",
    description:
      "طرح سالانهٔ مشاورهٔ کنکور کامپیوتر: جلسهٔ هفتگی، برنامهٔ هفتگی اختصاصی و بررسی گزارش هفتگی تا روز کنکور؛ یا یک جلسهٔ مشاورهٔ تکی.",
    path: "/consultations",
  });
}

const WEEK = [
  {
    step: "۱",
    title: "گزارش هفتگی را می‌نویسی",
    text: "آخر هفته در پنلت می‌نویسی چند تست زدی، حال و انرژی‌ات چطور بود، چه چیزی خوب پیش رفت، کجا گیر کردی و چه سؤالی داری. ساعت مطالعه، آزمون‌ها و کارهای برنامه‌ات را سایت خودش از آنچه ثبت کرده‌ای کنار گزارش می‌گذارد.",
  },
  {
    step: "۲",
    title: "جلسهٔ هفتگی",
    text: "مشاورت پیش از جلسه گزارشت را خوانده است. در جلسه وضعیتت را مرور می‌کنیم، مشکل هفته را حل می‌کنیم و برای هفتهٔ بعد تصمیم می‌گیریم؛ از ترتیب درس‌ها تا حجم تست و زمان آزمون‌ها.",
  },
  {
    step: "۳",
    title: "برنامهٔ هفتهٔ بعد در پنلت",
    text: "برنامهٔ روزبه‌روزِ هفتهٔ بعد در بخش «برنامهٔ مشاور» پنلت می‌آید: چه درسی، چه مبحثی، چند دقیقه یا چند تست. هر کار را که انجام دادی تیک می‌زنی و مشاورت پیشرفتت را می‌بیند.",
  },
  {
    step: "۴",
    title: "بازخورد مکتوب",
    text: "جمع‌بندی جلسه و نکته‌هایی که باید حواست باشد، زیر گزارش همان هفته در پنلت می‌ماند تا هر وقت خواستی برگردی و ببینی.",
  },
];

/** What else the site offers next to the consultation, and on what terms. */
const SERVICES = [
  { href: "/courses", title: "دوره‌ها", text: "درس‌نامه و ویدیوی درس‌ها، به ترتیب سرفصل.", tag: "خرید جداگانه" },
  { href: "/questions", title: "بانک سؤال", text: "تست‌های کنکورهای گذشته با پاسخ تشریحی.", tag: "خرید جداگانه" },
  { href: "/resources", title: "جزوه‌ها", text: "جزوه‌ها، در پنلت و به نام خودت.", tag: "خرید جداگانه" },
  { href: "/rank-calculator", title: "تخمین رتبه و انتخاب رشته", text: "از درصدهای آزمون‌هایت تا رتبه و رشته‌های محتمل.", tag: "رایگان" },
  { href: "/today", title: "برنامهٔ امروز و ثبت مطالعه", text: "کارهای هر روز و سابقهٔ مطالعه‌ات در پنلت.", tag: "رایگان" },
];

const START = [
  { title: "ثبت‌نام و پرداخت", text: "طرح را انتخاب می‌کنی و کارت‌به‌کارت پرداخت می‌کنی؛ بعد از تأیید پرداخت، مشاوره‌ات در پنلت فعال می‌شود." },
  { title: "پروفایل و سطح فعلی", text: "رشته، سال کنکور و وضعیت تحصیلی‌ات را در پروفایل کامل می‌کنی تا مشاورت از جای درست شروع کند." },
  { title: "اولین جلسه", text: "چند زمان پیشنهاد می‌دهی و مشاورت یکی را تأیید می‌کند. در جلسهٔ اول نقطهٔ شروع و برنامهٔ هفته‌های اول را می‌چینیم." },
  { title: "چرخهٔ هفتگی", text: "از آن به بعد هر هفته: گزارش، جلسه، برنامهٔ تازه و بازخورد؛ تا روز کنکور." },
];

const FAQ = [
  {
    q: "جلسه‌ها چطور برگزار می‌شوند؟",
    a: "آنلاین یا تلفنی. بعد از تأیید هر جلسه، لینک یا شیوهٔ تماس همان جلسه در پنلت نوشته می‌شود و فقط تو و مشاورت آن را می‌بینید.",
  },
  {
    q: "اگر نتوانم سر جلسه بیایم چه می‌شود؟",
    a: "پیش از زمان جلسه لغوش کن؛ جلسهٔ لغوشده به سهمیه‌ات برمی‌گردد و زمان دیگری انتخاب می‌کنی. جلسه‌ای که بدون خبر از دست برود، از سهمیه کم می‌شود.",
  },
  {
    q: "گزارش هفتگی واجب است؟",
    a: "بله؛ جلسهٔ هفتگی روی همین گزارش بنا می‌شود. بدون آن، جلسه صرف پرسیدن چیزهایی می‌شود که می‌شد از قبل دانست. نوشتنش چند دقیقه بیشتر طول نمی‌کشد.",
  },
  {
    q: "دوره‌ها، جزوه‌ها و بانک سؤال هم در طرح سالانه هست؟",
    a: "نه. طرح سالانه خودِ مشاوره است: جلسهٔ هفتگی، برنامهٔ هفتگی و بررسی گزارش هفتگی. دوره‌ها، جزوه‌ها و بانک سؤال هر کدام جداگانه تهیه می‌شوند؛ در جلسه با هم می‌سنجیم کدام‌ها واقعاً لازمت است تا چیزی اضافه نخری.",
  },
  {
    q: "فرق طرح سالانه با جلسهٔ تکی چیست؟",
    a: "جلسهٔ تکی یک گفت‌وگوی مستقل است برای بررسی وضعیت و مسیرت. طرح سالانه همراهی هفته‌به‌هفته است: جلسهٔ هفتگی، برنامهٔ هفتگی، بررسی گزارش و بازخورد مکتوب تا روز کنکور.",
  },
  {
    q: "پرداخت چطور است؟",
    a: "کارت‌به‌کارت. بعد از ثبت سفارش، شمارهٔ کارت و مبلغ دقیق را می‌بینی و رسید را همان‌جا ثبت می‌کنی؛ بعد از تأیید پرداخت، طرح فعال می‌شود.",
  },
];

function validity(offering: Offering | undefined) {
  if (!offering?.validUntil) return "تا روز کنکور";
  return `تا ${new Date(offering.validUntil).toLocaleDateString("fa-IR", { dateStyle: "long", timeZone: "Asia/Tehran" })}`;
}

export default async function ConsultationsPage() {
  const offerings = await loadOfferings();
  // The catalogue lists oldest first; the newest offering of each kind is the current one.
  const newest = [...(offerings ?? [])].reverse();
  const annual = newest.find((offering) => offering.kind === "PACKAGE");
  const single = newest.find((offering) => offering.kind === "SINGLE_SESSION");
  const consultant = (annual ?? single)?.instructorProfile;
  const annualPrice = annual?.amountRial ?? ANNUAL_PRICE_RIAL;
  const singlePrice = single?.amountRial ?? SESSION_PRICE_RIAL;
  const minutes = annual?.durationMinutes ?? single?.durationMinutes;

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "مشاورهٔ کنکور ارشد و دکتری کامپیوتر",
      provider: { "@id": absoluteUrl("/#organization") },
      url: absoluteUrl("/consultations"),
      offers: [
        { "@type": "Offer", name: "طرح سالانهٔ مشاوره", price: annualPrice, priceCurrency: "IRR" },
        { "@type": "Offer", name: "جلسهٔ مشاورهٔ تکی", price: singlePrice, priceCurrency: "IRR" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
    },
  ];

  return (
    <main className="cs">
      <StructuredData data={schemas} />

      <header className="cs-hero">
        <div className="pg-shell cs-hero-inner">
          <div className="cs-hero-text">
            <p className="pg-eyebrow">مشاورهٔ کنکور کامپیوتر</p>
            <h1>تا روز کنکور، هر هفته کنارت هستیم</h1>
            <p className="cs-lede">
              مشاوره یعنی کسی که هر هفته وضعیتت را می‌بیند، کمک می‌کند درست تصمیم بگیری و برنامهٔ هفتهٔ بعدت را با تو
              می‌چیند؛ از ترتیب درس‌ها و منابع تا حجم تست و زمان آزمون‌ها.
            </p>
            <div className="cs-hero-actions">
              <a className="ds-btn ds-btn-primary" href="#plans">دیدن طرح‌ها و قیمت</a>
              <a className="ds-btn ds-btn-ghost" href="#week">یک هفته در طرح سالانه</a>
            </div>
          </div>
          <Link href="/about" className="cs-consultant">
            <Image src="/brand/mohammad-rostami-avatar.webp" alt="" width={72} height={72} unoptimized />
            <span>
              <small>مشاور</small>
              <strong>{consultant?.displayName ?? "محمد رستمی"}</strong>
              <em>{consultant?.roleTitle ?? "مدرس و مؤلف کنکور کامپیوتر"}</em>
            </span>
          </Link>
        </div>
      </header>

      <section className="pg-shell cs-sec" id="plans" aria-labelledby="plans-title">
        <div className="cs-head">
          <h2 id="plans-title">طرح‌ها</h2>
          <p>یا همراهی هفته‌به‌هفته تا کنکور، یا یک جلسه برای اینکه مسیرت را بسنجی.</p>
        </div>
        {offerings === null && <p className="cs-note">اطلاعات خرید الان در دسترس نیست؛ کمی بعد دوباره سر بزن.</p>}
        <div className="cs-plans">
          <article className="cs-plan cs-plan-main" aria-labelledby="annual-title">
            <span className="cs-plan-flag">پیشنهاد ما</span>
            <h3 id="annual-title">طرح سالانه</h3>
            <p className="cs-plan-price">{formatToman(annualPrice)}</p>
            <p className="cs-plan-sub">{validity(annual)} · یک‌جا</p>
            <ul className="cs-list">
              <li><b>هر هفته یک جلسهٔ فردی</b>{minutes ? ` ${formatPersianNumber(minutes)} دقیقه‌ای` : ""} با مشاورت</li>
              <li><b>برنامهٔ هفتگی اختصاصی</b>، روزبه‌روز در پنلت</li>
              <li><b>بررسی گزارش هفتگی</b> پیش از هر جلسه و بازخورد مکتوب بعد از آن</li>
              <li><b>پیگیری آزمون‌ها و ساعت مطالعه‌ات</b> از آنچه در سایت ثبت می‌کنی</li>
              <li><b>کمک به انتخاب منابع</b>؛ فقط همان‌هایی که واقعاً لازم داری</li>
            </ul>
            <p className="cs-plan-fine">دوره‌ها، جزوه‌ها و بانک سؤال جزو طرح نیستند و جداگانه تهیه می‌شوند.</p>
            <div className="cs-plan-action">
              {annual ? (
                <BuyButton productId={annual.productId} label="ثبت‌نام در طرح سالانه" />
              ) : (
                <p className="cs-note">ثبت‌نام از همین صفحه به‌زودی باز می‌شود؛ تا آن موقع در <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">کانال @kunkurcomputer</a> پیام بده.</p>
              )}
            </div>
          </article>

          <article className="cs-plan" aria-labelledby="single-title">
            <h3 id="single-title">جلسهٔ تکی</h3>
            <p className="cs-plan-price">{formatToman(singlePrice)}</p>
            <p className="cs-plan-sub">یک جلسه{single ? ` · ${formatPersianNumber(single.durationMinutes)} دقیقه` : ""}</p>
            <ul className="cs-list">
              <li>بررسی وضعیت فعلی و نقطهٔ شروعت</li>
              <li>ترتیب درس‌ها و منابعی که به کارت می‌آید</li>
              <li>پاسخ به سؤال‌هایی که دربارهٔ مسیرت داری</li>
            </ul>
            <p className="cs-plan-fine">برای کسی که می‌خواهد مسیرش را یک بار با مشاور بسنجد. اگر بعداً طرح سالانه خواستی، از همین‌جا ثبت‌نام می‌کنی.</p>
            <div className="cs-plan-action">
              {single ? (
                <BuyButton productId={single.productId} label="رزرو جلسهٔ تکی" />
              ) : (
                <p className="cs-note">رزرو از همین صفحه به‌زودی باز می‌شود.</p>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="cs-band" id="week" aria-labelledby="week-title">
        <div className="pg-shell cs-sec">
          <div className="cs-head">
            <h2 id="week-title">یک هفته در طرح سالانه</h2>
            <p>هر هفته همین چرخه تکرار می‌شود؛ ساده، منظم و ثبت‌شده در پنلت.</p>
          </div>
          <ol className="cs-steps">
            {WEEK.map((item) => (
              <li key={item.step}>
                <span className="cs-step-n" aria-hidden="true">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pg-shell cs-sec" aria-labelledby="services-title">
        <div className="cs-head">
          <h2 id="services-title">کنار مشاوره، از سایت چه چیزی به کارت می‌آید</h2>
          <p>مشاوره خودِ مشاوره است. دوره‌ها، جزوه‌ها و بانک سؤال جداگانه تهیه می‌شوند و مشاورت کمک می‌کند فقط همان‌هایی را بگیری که لازم داری.</p>
        </div>
        <div className="cs-services">
          {SERVICES.map((item) => (
            <Link href={item.href} className="cs-service" key={item.href}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
              <em className="cs-service-tag" data-free={item.tag === "رایگان" || undefined}>{item.tag}</em>
            </Link>
          ))}
        </div>
      </section>

      <section className="cs-band" aria-labelledby="start-title">
        <div className="pg-shell cs-sec">
          <div className="cs-head">
            <h2 id="start-title">از ثبت‌نام تا اولین جلسه</h2>
          </div>
          <ol className="cs-start">
            {START.map((item, index) => (
              <li key={item.title}>
                <span aria-hidden="true">{formatPersianNumber(index + 1)}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pg-shell cs-sec" aria-labelledby="faq-title">
        <div className="cs-head">
          <h2 id="faq-title">پرسش‌های رایج</h2>
        </div>
        <div className="cs-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
