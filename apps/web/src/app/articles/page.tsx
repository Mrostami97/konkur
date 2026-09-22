import Link from "next/link";
import type { Metadata } from "next";
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
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">کتابخانهٔ kunkur01</p>
          <h1>مقاله‌های کاربردی، نه محتوای پُرکننده</h1>
          <p className="pg-lede">
            فقط مطالب منتشرشدهٔ تحریریه نمایش داده می‌شوند؛ هر مطلب تاریخ اعتبار، منبع و وضعیت
            انتساب روشن دارد.
          </p>
        </div>
      </div>

      {apiUnavailable && (
        <div className="pg-shell pg-band">
          <div className="ds-alert ds-alert-warning">
            <span>
              <strong>نسخهٔ آفلاین.</strong> سرویس محتوا در دسترس نیست؛ مطالب پایهٔ سایت نمایش داده
              می‌شوند و ممکن است تازه‌ترین ویرایش تحریریه هنوز در دسترس نباشد.
            </span>
          </div>
        </div>
      )}

      <section className="pg-shell pg-sec">
        <div className="pg-grid pg-grid-wide">
          {apiArticles.map((article) => (
            <Link className="pg-card" key={article.slug} href={`/articles/${article.slug}`}>
              <span className="pg-badge">{contentTypeLabel(article.contentType)}</span>
              <b>{article.title}</b>
              <small>{article.summary}</small>
              <span className="pg-card-action pg-card-meta">
                {article.authorProfile?.displayName ?? "تحریریهٔ کنکورصفریک"}
                {article.publishedAt ? ` · ${formatPublicDate(article.publishedAt)}` : ""}
              </span>
            </Link>
          ))}
          {legacyOnly.map((article) => (
            <Link className="pg-card" key={article.slug} href={`/articles/${article.slug}`}>
              <span className="pg-badge">{article.category}</span>
              <b>{article.title}</b>
              <small>{article.description}</small>
              <span className="pg-card-action pg-card-meta">
                {article.degree} · {toPersianDigits(article.readingMinutes)} دقیقه
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
