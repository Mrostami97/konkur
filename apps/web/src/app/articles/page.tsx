import Link from "next/link";
import { EmptyState, PageHeader } from "../../components/ui";
import { apiGetPublic } from "../../lib/api";

interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export default async function ArticlesPage() {
  let articles: Article[] | null = null;
  try {
    articles = await apiGetPublic<Article[]>("/articles");
  } catch {
    articles = null;
  }

  return (
    <main className="page-container">
      <PageHeader eyebrow="دانش و راهنما" title="مقاله‌ها" description="راهنماهای کوتاه و کاربردی برای مطالعهٔ بهتر و تصمیم‌گیری دقیق‌تر." />
      {!articles ? (
        <EmptyState title="فهرست مطالب در دسترس نیست" description="اتصال به سرویس محتوا برقرار نشد؛ بعداً دوباره امتحان کن." />
      ) : articles.length === 0 ? (
        <EmptyState title="هنوز مطلبی منتشر نشده است" description="مقاله‌های جدید بعد از انتشار اینجا قرار می‌گیرند." />
      ) : (
        <div className="article-grid">
          {articles.map((article) => (
            <Link className="article-card" key={article.slug} href={`/articles/${article.slug}`}>
              <span className="article-meta">{new Date(article.publishedAt).toLocaleDateString("fa-IR")}</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
