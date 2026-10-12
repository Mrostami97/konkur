import type { Metadata } from "next";
import {
  formatPublicDate,
  type PublicArticleRecord,
} from "../../components/PublicContent";
import { articles as legacyArticles } from "../../content/editorial";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";
import { OWNER_NAME } from "../../components/OwnerByline";
import { ArticlesExplorer, type ArticleRow } from "./ArticlesExplorer";
import { shelvesOf } from "./shelves";
import "./articles.css";

export async function generateMetadata({ searchParams: pendingSearchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const searchParams = await pendingSearchParams;
  return pageMetadata({
    title: "مقاله‌ها و راهنماهای کنکور کامپیوتر",
    description: "مقاله‌های منبع‌دار دربارهٔ برنامه‌ریزی، منابع، کارنامه و تغییرات کنکور ارشد و دکتری کامپیوتر.",
    path: "/articles",
    noIndex: Object.keys(searchParams).length > 0,
  });
}

/** Every string in the content blocks, for a word count. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => key !== "type" && key !== "media_key" && key !== "href")
      .map(([, inner]) => textOf(inner))
      .join(" ");
  }
  return "";
}

/** Persian prose reads at about 200 words a minute; tables slow it a little. */
function readingMinutes(article: PublicArticleRecord) {
  const words = textOf(article.contentBlocks).split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}

export default async function ArticlesPage() {
  let apiUnavailable = false;
  let published: PublicArticleRecord[] = [];
  try {
    published = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
  } catch {
    apiUnavailable = true;
  }
  const apiArticles = published
    .filter((item) => item.contentType !== "GUIDE")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const publishedSlugs = new Set(published.map((article) => article.slug));
  const legacyOnly = legacyArticles.filter((article) => !publishedSlugs.has(article.slug));

  // Only what a card shows goes to the browser, not each article's body.
  const rows: ArticleRow[] = [
    ...apiArticles.map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      tags: article.taxonomyTags.slice(0, 3),
      shelves: shelvesOf(article.taxonomyTags, article.subjectCodes),
      byline: article.authorProfile?.displayName ?? OWNER_NAME,
      date: article.publishedAt ? formatPublicDate(article.publishedAt) : null,
      minutes: readingMinutes(article),
    })),
    ...legacyOnly.map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.description,
      tags: [article.category],
      shelves: shelvesOf([article.category]),
      byline: article.degree,
      date: null,
      minutes: article.readingMinutes,
    })),
  ];

  return (
    <main className="al">
      <header className="al-hero">
        <div className="al-wrap">
          <p className="al-kicker">کتابخانهٔ کنکور کامپیوتر</p>
          <h1>مقاله‌های کاربردی، نه محتوای پُرکننده</h1>
          <p className="al-lede">
            تحلیل کارنامه‌ها و رتبه‌ها، راهنمای دانشگاه و انتخاب رشته، درس‌نامه‌ها و برنامه‌ریزی؛ هر مطلب با تاریخ، منبع و نام نویسنده.
          </p>
          {rows.length > 0 && <p className="al-total">{toPersianDigits(rows.length)} مقاله</p>}
        </div>
      </header>

      {apiUnavailable && (
        <div className="al-wrap al-offline">
          <div className="ds-alert ds-alert-warning">
            <span>
              <strong>بخشی از مطالب الان باز نمی‌شود.</strong> فعلاً مطالب اصلی را می‌بینی؛ چند دقیقهٔ دیگر دوباره سر بزن.
            </span>
          </div>
        </div>
      )}

      <ArticlesExplorer rows={rows} />
    </main>
  );
}
