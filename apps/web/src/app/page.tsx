import Link from "next/link";
import { apiGetPublic } from "../lib/api";

interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export default async function HomePage() {
  const articles = await apiGetPublic<Article[]>("/articles");

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
            <Link className="button button-primary" href="/courses">شروع مسیر یادگیری ←</Link>
            <Link className="button button-secondary" href="/exams">یک آزمون آزمایشی</Link>
          </div>
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
              <div className="mini-stat"><strong>۷۲٪</strong><span>پیشرفت</span></div>
              <div className="mini-stat"><strong>۱۲</strong><span>جلسه مطالعه</span></div>
              <div className="mini-stat"><strong>۸۴</strong><span>امتیاز تمرکز</span></div>
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

      <section aria-labelledby="articles-title" style={{ marginTop: "3.5rem" }}>
        <div className="section-heading">
          <div><h2 id="articles-title">تازه‌های مسیر</h2><p>مقاله‌ها و نکته‌های کوتاه برای مطالعه بهتر</p></div>
          <span className="text-link">مطالب منتخب ←</span>
        </div>
        <div className="article-grid">
          {!articles || articles.length === 0 ? <div className="empty-state">هنوز مقاله‌ای منتشر نشده است؛ به‌زودی مطالب تازه اینجا قرار می‌گیرد.</div> : articles.slice(0, 3).map((article) => (
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
