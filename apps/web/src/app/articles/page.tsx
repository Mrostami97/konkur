import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "../../components/ui";
import {
  contentTypeLabel,
  formatPublicDate,
  type PublicArticleRecord,
} from "../../components/PublicContent";
import { articles as legacyArticles } from "../../content/editorial";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  return pageMetadata({
    title: "مقاله‌ها و راهنماهای کنکور کامپیوتر",
    description: "مقاله‌های منبع‌دار دربارهٔ برنامه‌ریزی، منابع، کارنامه و تغییرات کنکور ارشد و دکتری کامپیوتر.",
    path: "/articles",
    noIndex: Object.keys(searchParams).length > 0,
  });
}

export default async function ArticlesPage() {
  let apiUnavailable = false;
  let published: PublicArticleRecord[] = [];
  try {
    published = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
  } catch {
    apiUnavailable = true;
  }
  const apiArticles = published.filter((item) => item.contentType !== "GUIDE");
  const publishedSlugs = new Set(published.map((article) => article.slug));
  const legacyOnly = legacyArticles.filter((article) => !publishedSlugs.has(article.slug));

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="کتابخانهٔ kunkur01"
        title="مقاله‌های کاربردی، نه محتوای پُرکننده"
        description="فقط مطالب منتشرشدهٔ تحریریه نمایش داده می‌شوند؛ هر مطلب تاریخ اعتبار، منبع و وضعیت انتساب روشن دارد."
      />
      <div className="content-filter-row" aria-label="نوع مطالب">
        <span className="active">مقاله‌های منتشرشده</span>
        <span>تحلیل</span>
        <span>خبر</span>
        <span>مطالعهٔ موردی</span>
      </div>

      {apiUnavailable && (
        <aside className="official-disclaimer">
          <strong>نسخهٔ آفلاین</strong>
          <p>سرویس محتوا در دسترس نیست؛ مطالب پایهٔ سایت نمایش داده می‌شوند و ممکن است تازه‌ترین ویرایش تحریریه هنوز در دسترس نباشد.</p>
        </aside>
      )}
      <div className="article-grid editorial-card-grid">
        {apiArticles.map((article) => (
          <Link className="article-card editorial-card" key={article.slug} href={`/articles/${article.slug}`}>
            <div className="article-card-top">
              <span className="article-meta">{contentTypeLabel(article.contentType)}</span>
              {article.publishedAt && <span>{formatPublicDate(article.publishedAt)}</span>}
            </div>
            <h2>{article.title}</h2>
            <p>{article.summary}</p>
            <div className="article-card-footer">
              <span>{article.authorProfile?.displayName ?? "تحریریهٔ کنکورصفریک"}</span>
              <span>مطالعه ←</span>
            </div>
          </Link>
        ))}
        {legacyOnly.map((article) => (
          <Link className="article-card editorial-card" key={article.slug} href={`/articles/${article.slug}`}>
            <div className="article-card-top"><span className="article-meta">{article.category}</span><span>{article.degree}</span></div>
            <h2>{article.title}</h2>
            <p>{article.description}</p>
            <div className="article-card-footer"><span>{article.category}</span><span>{toPersianDigits(article.readingMinutes)} دقیقه ←</span></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
