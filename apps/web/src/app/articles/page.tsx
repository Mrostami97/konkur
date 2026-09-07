import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../../components/ui";
import { articles as editorialArticles } from "../../content/editorial";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export const metadata: Metadata = pageMetadata({ title: "مقاله‌ها و راهنماهای کنکور کامپیوتر", description: "مقاله‌های منبع‌دار دربارهٔ برنامه‌ریزی، منابع، کارنامه و تغییرات کنکور ارشد و دکتری کامپیوتر.", path: "/articles" });

export default async function ArticlesPage() {
  let apiArticles: Article[] = [];
  try {
    apiArticles = (await apiGetPublic<Article[]>("/articles")) ?? [];
  } catch {
    apiArticles = [];
  }

  return (
    <main className="page-container">
      <PageHeader eyebrow="کتابخانهٔ kunkur01" title="مقاله‌های کاربردی، نه محتوای پُرکننده" description="هر مطلب یک پاسخ کوتاه، تاریخ اعتبار و منبع مشخص دارد؛ انتساب نویسنده و بازبین فقط پس از تأیید تحریریه نمایش داده می‌شود." />
      <div className="content-filter-row" aria-label="دسته‌بندی مطالب"><span className="active">همه مطالب</span><span>تغییرات ۱۴۰۶</span><span>برنامه‌ریزی</span><span>منابع</span><span>کارنامه و رتبه</span></div>
      <div className="article-grid editorial-card-grid">
        {editorialArticles.map((article) => (
          <Link className="article-card editorial-card" key={article.slug} href={`/articles/${article.slug}`}>
            <div className="article-card-top"><span className="article-meta">{article.category}</span><span>{article.degree}</span></div>
            <h2>{article.title}</h2><p>{article.description}</p>
            <div className="article-card-footer"><span>{article.category}</span><span>{toPersianDigits(article.readingMinutes)} دقیقه ←</span></div>
          </Link>
        ))}
        {apiArticles.filter((article) => !editorialArticles.some((local) => local.slug === article.slug)).map((article) => (
          <Link className="article-card editorial-card" key={article.slug} href={`/articles/${article.slug}`}><span className="article-meta">مطلب منتشرشده</span><h2>{article.title}</h2><p>{article.summary}</p><div className="article-card-footer"><span>مطلب منبع‌دار</span><span>مطالعه ←</span></div></Link>
        ))}
      </div>
    </main>
  );
}
