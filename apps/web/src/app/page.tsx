import type { Metadata } from "next";
import Link from "next/link";
import { guides, subjects } from "../content/editorial";
import { apiGetPublic } from "../lib/api";
import { pageMetadata } from "../lib/seo";

interface Product { slug: string; title: string; description: string; prices?: { amountRial: number }[]; }
interface Exam { id: string; title: string; description: string; durationMinutes: number; }

export const metadata: Metadata = pageMetadata({ title: "مرجع کنکور ارشد و دکتری کامپیوتر", description: "راهنمای به‌روز ۱۴۰۶، درس‌ها، منابع رایگان، برنامه‌ریزی و تحلیل برای مهندسی کامپیوتر، IT و علوم کامپیوتر.", path: "/" });

async function safePublic<T>(path: string): Promise<T | null> { try { return await apiGetPublic<T>(path); } catch { return null; } }

export default async function HomePage() {
  const [products, exams] = await Promise.all([safePublic<Product[]>("/products"), safePublic<Exam[]>("/exams")]);
  return <main>
    <section className="home-hero-wrap"><div className="home-hero page-shell">
      <div className="home-hero-copy">
        <div className="home-trust-line"><span>به‌روزرسانی ۱۵ شهریور ۱۴۰۵</span><strong>تغییرات آزمون ۱۴۰۶ اعمال شد</strong></div>
        <h1>کنکور کامپیوتر را<br/><em>یکپارچه</em> جلو ببر.</h1>
        <p>راهنمای دقیق، نقشهٔ درس‌ها، برنامهٔ شخصی و تحلیل عملکرد برای ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر.</p>
        <div className="hero-actions"><Link className="button button-primary button-large" href="/guides">دیدن راهنمای ۱۴۰۶ ←</Link><Link className="button button-secondary button-large" href="/today">ساخت برنامهٔ شخصی</Link></div>
        <div className="hero-proof"><span><strong>۶</strong> مسیر آزمون</span><span><strong>{subjects.length}</strong> هاب درسی</span><span><strong>۲</strong> آرشیو رسمی</span></div>
      </div>
      <div className="hero-command" aria-label="نمای نقشهٔ آمادگی آزمون">
        <div className="command-top"><span><i></i> نقشهٔ آمادگی من</span><strong>۱۴۰۶</strong></div>
        <div className="command-goal"><span>هدف انتخاب‌شده</span><h2>ارشد مهندسی کامپیوتر</h2><p>ساختار جدید دروس و ضرایب</p></div>
        <div className="command-subjects"><div><span>تخصصی</span><strong>ضریب ۴</strong><small>بستهٔ یکپارچه</small></div><div><span>ریاضیات</span><strong>ضریب ۲</strong><small>۳ درس</small></div><div><span>زبان</span><strong>ضریب ۱</strong><small>پیوسته</small></div></div>
        <div className="command-alert"><span>جدید</span><p><strong>جبر خطی و مبانی برنامه‌سازی</strong> به برنامهٔ ۱۴۰۶ اضافه شده‌اند.</p></div>
        <Link href="/guides/master-computer-engineering-1406">مشاهده جزئیات رسمی <span>←</span></Link>
      </div>
    </div></section>

    <section className="home-signal-strip page-shell" aria-label="خلاصهٔ مسیر kunkur01">
      <article className="signal-card signal-card-accent"><span className="signal-index">۰۱</span><div><small>تصمیم اول</small><h2>مقطع و مجموعه‌ات را دقیق انتخاب کن</h2><p>برای ارشد مهندسی، IT، علوم کامپیوتر و دکتری مسیرهای جدا و قابل مقایسه داری.</p><Link href="/guides">مقایسهٔ مسیرها ←</Link></div></article>
      <article className="signal-card"><span className="signal-index">۰۲</span><div><small>تصمیم دوم</small><h2>سرفصل را به برنامه تبدیل کن</h2><p>هر درس با پیش‌نیاز، فصل‌های کلیدی و گام بعدی در یک صفحه قرار گرفته است.</p><Link href="/subjects">رفتن به نقشهٔ درس‌ها ←</Link></div></article>
      <article className="signal-card"><span className="signal-index">۰۳</span><div><small>تصمیم سوم</small><h2>هر هفته با داده جلو برو</h2><p>برنامهٔ امروز، مرور و تحلیل عملکرد برای مرحلهٔ بعدی آماده‌اند.</p><Link href="/today">ساخت برنامهٔ شخصی ←</Link></div></article>
    </section>

    <section className="home-section page-shell" aria-labelledby="paths-title"><div className="section-heading home-heading"><div><span className="section-index">۰۱</span><h2 id="paths-title">اول مسیر درست را انتخاب کن</h2><p>یک آزمون واحد نیست؛ هر مقطع و مجموعه مواد و اولویت خودش را دارد.</p></div><Link className="text-link" href="/guides">همهٔ راهنماها ←</Link></div>
      <div className="path-grid">{guides.map((guide) => <Link className={`path-card ${guide.featured ? "path-card-featured" : ""}`} href={`/guides/${guide.slug}`} key={guide.slug}><div><span>{guide.degree}</span><strong>{guide.field}</strong></div><p>{guide.description}</p><span className="path-arrow">←</span></Link>)}</div>
    </section>

    <section className="change-band"><div className="page-shell change-band-grid"><div><span className="eyebrow eyebrow-dark">مهم‌ترین تغییر ۱۴۰۶</span><h2>برنامهٔ پارسال را ادامه نده.</h2><p>ساختار ارشد مهندسی کامپیوتر تغییر جدی کرده؛ شش درس حذف و دو درس اضافه شده‌اند.</p><Link className="button button-light" href="/articles/computer-exam-changes-1406">دیدن همهٔ تغییرات</Link></div><div className="change-list"><div><span className="change-plus">+</span><strong>جبر خطی</strong><small>بستهٔ ریاضیات</small></div><div><span className="change-plus">+</span><strong>مبانی برنامه‌سازی</strong><small>بستهٔ تخصصی</small></div><div className="change-removed"><span>−</span><strong>۶ درس قدیمی</strong><small>از مجموعه مهندسی کامپیوتر</small></div></div></div></section>

    <section className="home-section page-shell" aria-labelledby="subjects-title"><div className="section-heading home-heading"><div><span className="section-index">۰۲</span><h2 id="subjects-title">نقشهٔ درس‌ها، با وضعیت ۱۴۰۶</h2><p>پیش‌نیاز، مبحث کلیدی و مسیر مرتبط هر درس را یکجا ببین.</p></div><Link className="text-link" href="/subjects">همهٔ درس‌ها ←</Link></div>
      <div className="subject-rail">{subjects.slice(0, 8).map((subject) => <Link href={`/subjects/${subject.slug}`} key={subject.slug}><span>{subject.accent}</span><strong>{subject.shortTitle}</strong><small>{subject.status1406}</small></Link>)}</div>
    </section>

    <section className="ecosystem-section"><div className="page-shell"><div className="section-heading home-heading"><div><span className="section-index">۰۳</span><h2>از مطالعه تا تصمیم نهایی، یک تجربه</h2><p>زیرساخت امروز کاربردی است و برای بانک‌ها و آزمون‌ساز آینده آماده می‌ماند.</p></div></div><div className="ecosystem-grid">
      <Link className="ecosystem-card ecosystem-primary" href="/today"><span>◷</span><h3>برنامهٔ امروز</h3><p>هدف، تسک و پیشرفت هفتگی در یک نمای آرام.</p><strong>شروع برنامه ←</strong></Link>
      <Link className="ecosystem-card" href="/courses"><span>◈</span><h3>یادگیری</h3><p>دوره‌ها و محتوای آموزشی واقعی پلتفرم.</p><strong>مشاهده دوره‌ها ←</strong></Link>
      <Link className="ecosystem-card" href="/exams"><span>✓</span><h3>آزمون</h3><p>{exams?.length ? `${exams.length} آزمون منتشرشده برای سنجش آمادگی.` : "آزمون‌های منتشرشده بدون دادهٔ نمایشی."}</p><strong>ورود به آزمون ←</strong></Link>
      <Link className="ecosystem-card" href="/rank-estimate"><span>↗</span><h3>تحلیل و رتبه</h3><p>برآورد شفاف با بازهٔ اطمینان، نه یک عدد جادویی.</p><strong>تحلیل عملکرد ←</strong></Link>
    </div></div></section>

    <section className="home-section page-shell channel-section"><div><span className="eyebrow">جامعهٔ kunkur01</span><h2>محتوا از کانال گم نمی‌شود؛ به دانش قابل جست‌وجو تبدیل می‌شود.</h2><p>پست‌ها، نمونه تدریس‌ها و پاسخ‌های متعلق به kunkur01 با حفظ لینک اصلی، به منابع ساختاریافته و قابل استناد تبدیل می‌شوند.</p><div className="hero-actions"><a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">کانال اصلی @konkurcom</a><a className="button button-secondary" href="https://t.me/Konkur_answer" target="_blank" rel="noreferrer">آرشیو @Konkur_answer</a></div></div><div className="channel-stack"><div><span>خبر و مسیر</span><strong>@konkurcom</strong><small>کانال اصلی</small></div><div><span>پاسخ و فایل</span><strong>@Konkur_answer</strong><small>آرشیو آموزشی</small></div></div></section>

    {products && products.length > 0 && <section className="home-section page-shell"><div className="section-heading"><div><h2>دوره‌های منتشرشده</h2><p>دادهٔ واقعی از پلتفرم</p></div><Link className="text-link" href="/courses">همه دوره‌ها ←</Link></div><div className="article-grid">{products.slice(0, 3).map((product) => <Link className="article-card" href={`/courses/${product.slug}`} key={product.slug}><span className="article-meta">دورهٔ آموزشی</span><h3>{product.title}</h3><p>{product.description}</p></Link>)}</div></section>}
  </main>;
}
