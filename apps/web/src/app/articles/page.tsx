import type { Metadata } from "next";
import {
  formatPublicDate,
  type PublicArticleRecord,
} from "../../components/PublicContent";
import { articles as allLegacyArticles } from "../../content/editorial";
import { withoutMergedArticles } from "../../lib/merged-pages";

const legacyArticles = withoutMergedArticles(allLegacyArticles);
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";
import { OWNER_NAME } from "../../components/OwnerByline";
import { ArticlesExplorer, type ArticleRow } from "./ArticlesExplorer";
import { shelvesOf } from "./shelves";
import Link from "next/link";
import { isLessonNote, LESSON_NOTES_PATH, readingMinutes } from "../../lib/lesson-notes";
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

export default async function ArticlesPage() {
  let apiUnavailable = false;
  let published: PublicArticleRecord[] = [];
  try {
    published = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
  } catch {
    apiUnavailable = true;
  }
  // Lesson notes have their own page (/lesson-notes), grouped by subject.
  const lessonNotes = published.filter(isLessonNote).length;
  const apiArticles = published
    .filter((item) => item.contentType !== "GUIDE" && !isLessonNote(item))
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
      shelves: shelvesOf(article.taxonomyTags),
      byline: article.authorProfile?.displayName ?? OWNER_NAME,
      date: article.publishedAt ? formatPublicDate(article.publishedAt) : null,
      minutes: readingMinutes(article.contentBlocks),
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
            تحلیل کارنامه‌ها و رتبه‌ها، راهنمای دانشگاه و انتخاب رشته و برنامه‌ریزی؛ هر مطلب با تاریخ، منبع و نام نویسنده.
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

      <ArticlesExplorer
        rows={rows}
        notice={lessonNotes > 0 ? (
          <Link href={LESSON_NOTES_PATH} className="al-notes-link">
            <span>
              <strong>دنبال درس‌نامه‌ای؟</strong> درس‌نامه‌ها صفحهٔ خودشان را دارند، درس‌به‌درس و مبحث‌به‌مبحث.
            </span>
            <span className="al-notes-cta">{toPersianDigits(lessonNotes)} درس‌نامه ←</span>
          </Link>
        ) : null}
      />
    </main>
  );
}
