import Link from "next/link";
import { apiGetPublic } from "../lib/api";
import { EmptyState, SectionHeader } from "../components/ui";

interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

interface Product {
  slug: string;
  title: string;
  description: string;
  prices?: { amountRial: number }[];
}

interface Exam {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

async function safePublic<T>(path: string): Promise<T | null> {
  try {
    return await apiGetPublic<T>(path);
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [articles, products, exams] = await Promise.all([
    safePublic<Article[]>("/articles"),
    safePublic<Product[]>("/products"),
    safePublic<Exam[]>("/exams"),
  ]);

  return (
    <main className="page-shell">
      <section className="hero">
          <div>
          <span className="eyebrow">پلتفرم یکپارچه کنکور تحصیلات تکمیلی</span>
          <h1>هر روز، یک قدم نزدیک‌تر به <em>رتبه‌ای که می‌خواهی</em></h1>
          <p className="hero-lead">
            برنامه‌ریزی، یادگیری، آزمون و تحلیل عملکرد در یک مسیر منسجم؛ برای اینکه به‌جای پراکنده‌خوانی، دقیق و با اعتمادبه‌نفس جلو بروی.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/today">ساخت برنامهٔ شخصی ←</Link>
            <Link className="button button-secondary" href="/exams">مشاهده آزمون‌ها</Link>
          </div>
          <div className="hero-degree"><span>مقطع هدف:</span><div className="degree-switcher"><Link className="active" href="/today?degree=MASTER">ارشد</Link><Link href="/today?degree=PHD">دکتری</Link></div></div>
        </div>
        <div className="hero-visual" aria-label="نمایی از داشبورد پیشرفت">
          <div className="dashboard-card">
            <div className="dashboard-top"><span>داشبورد پیشرفت</span><strong>امروز</strong></div>
            <div className="progress-card">
              <p>پیشرفت برنامه این هفته</p>
              <h3>مسیرت عالی پیش می‌رود</h3>
              <div className="progress-track"><span /></div>
            </div>
            <div className="mini-stats">
              <div className="mini-stat"><strong>امروز</strong><span>برنامه شخصی</span></div>
              <div className="mini-stat"><strong>یادگیری</strong><span>دوره و درس</span></div>
              <div className="mini-stat"><strong>تحلیل</strong><span>تصمیم دقیق‌تر</span></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title">
        <div className="section-heading">
          <div><h2 id="features-title">همه‌چیز برای یک پیشرفت واقعی</h2><p>ابزارهایی که کنار هم، نتیجه می‌سازند.</p></div>
          <Link className="text-link" href="/account">مشاهده حساب من ←</Link>
        </div>
        <div className="feature-grid">
          <article className="feature-card"><div className="feature-icon">✦</div><h3>برنامه‌ریزی روزانه</h3><p>هدف‌هایت را به قدم‌های کوچک و قابل انجام تبدیل کن.</p></article>
          <article className="feature-card"><div className="feature-icon">◈</div><h3>یادگیری هدفمند</h3><p>دوره‌ها و درس‌های منتخب، دقیقاً متناسب با مسیر تو.</p></article>
          <article className="feature-card"><div className="feature-icon">↗</div><h3>تحلیل هوشمند</h3><p>عملکردت را ببین، نقاط ضعف را پیدا کن و بهتر تصمیم بگیر.</p></article>
        </div>
      </section>

      <section className="home-catalog" aria-labelledby="catalog-title">
        <SectionHeader title="مسیرهای واقعی برای پیشرفت" description="محتوای منتشرشدهٔ پلتفرم را بر اساس نیازت انتخاب کن." action={<Link className="text-link" href="/courses">همه یادگیری‌ها ←</Link>} />
        <div className="content-grid-wide">
          <div className="surface-card surface-card-muted">
            <span className="eyebrow">یادگیری</span>
            <h3>دوره‌های تخصصی</h3>
            <p>مسیرهای آموزشی ارشد و دکتری کامپیوتر، هر زمان که آماده‌ای.</p>
            {products && products.length > 0 && <ul className="quick-links home-preview-list">{products.slice(0, 2).map((product) => <li key={product.slug}><Link href={`/courses/${product.slug}`}>{product.title}<span>←</span></Link></li>)}</ul>}
            <Link className="button button-secondary" href="/courses">ورود به یادگیری</Link>
            {!products && <small className="api-note">در حال حاضر اتصال به فهرست دوره‌ها برقرار نیست.</small>}
          </div>
          <div className="surface-card surface-card-muted">
            <span className="eyebrow">آزمون</span>
            <h3>سنجش آمادگی</h3>
            <p>با آزمون‌های موجود، وضعیت فعلی‌ات را دقیق‌تر ببین.</p>
            {exams && exams.length > 0 && <ul className="quick-links home-preview-list">{exams.slice(0, 2).map((exam) => <li key={exam.id}><Link href="/exams">{exam.title}<span>{exam.durationMinutes} دقیقه</span></Link></li>)}</ul>}
            <Link className="button button-secondary" href="/exams">مشاهده آزمون‌ها</Link>
            {!exams && <small className="api-note">آزمون‌های منتشرشده در دسترس نیستند.</small>}
          </div>
          <div className="surface-card surface-card-muted">
            <span className="eyebrow">مطالب</span>
            <h3>مقاله و راهنما</h3>
            <p>نکته‌های کاربردی برای مطالعه و تصمیم‌گیری بهتر.</p>
            <Link className="button button-secondary" href="/articles">مطالعه مطالب</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="articles-title" className="home-articles">
        <SectionHeader title="تازه‌های مسیر" description="مقاله‌ها و نکته‌های کوتاه برای مطالعه بهتر" action={<Link className="text-link" href="/articles">همه مطالب ←</Link>} />
        <div className="article-grid">
          {!articles || articles.length === 0 ? <EmptyState title="هنوز مقاله‌ای منتشر نشده است" description="وقتی مطلب جدیدی منتشر شود، اینجا نمایش داده می‌شود." /> : articles.slice(0, 3).map((article) => (
            <Link className="article-card" key={article.slug} href={`/articles/${article.slug}`}>
              <span className="article-meta">یادگیری • مقاله منتخب</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
