import type { Metadata } from "next";
import { publicArticlePath, type PublicArticleRecord } from "../../components/PublicContent";
import { apiGetPublic } from "../../lib/api";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import { TelegramHome, type FeaturedItem, type FreshItem } from "./TelegramHome";
import "./tg.css";

export const metadata: Metadata = { ...PRIVATE_PAGE_METADATA, title: { absolute: "کنکور کامپیوتر" } };

/**
 * The pages a 1406 candidate needs most, first on the mini app's home. An
 * article joins the list only once it is published, so no tile leads nowhere.
 */
const FEATURED: (FeaturedItem & { slug?: string })[] = [
  { href: "/articles/konkur-1405-computer-engineering-solutions", slug: "konkur-1405-computer-engineering-solutions", title: "پاسخ تشریحی ۱۴۰۵", note: "حل همهٔ درس‌های ۱۴۰۶، سؤال به سؤال" },
  { href: "/articles/konkur-1404-computer-engineering-solutions", slug: "konkur-1404-computer-engineering-solutions", title: "پاسخ تشریحی ۱۴۰۴", note: "۸۴ تست ۱۴۰۴، با نکتهٔ تستی هر سؤال" },
  { href: "/budget", title: "بودجه‌بندی هوشمند", note: "هر درس چند تست، و رتبه کجا ساخته می‌شود" },
  { href: "/articles/master-computer-answer-keys", slug: "master-computer-answer-keys", title: "کلید کنکورها", note: "پاسخ همهٔ سؤال‌های ۱۴۰۰ تا ۱۴۰۵" },
  { href: "/lesson-notes", title: "درس‌نامه‌ها", note: "مبحث‌به‌مبحث، با تست کنکور" },
];

async function homeData(): Promise<{ fresh: FreshItem[]; featured: FeaturedItem[] }> {
  try {
    const articles = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
    const live = new Set(articles.map((a) => a.slug));
    const featured = FEATURED.filter((f) => !f.slug || live.has(f.slug)).map(({ href, title, note }) => ({ href, title, note }));
    const fresh = [...articles]
      .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
      .slice(0, 5)
      .map((article) => ({ href: publicArticlePath(article), title: article.title, summary: article.summary }));
    return { fresh, featured };
  } catch {
    return { fresh: [], featured: FEATURED.filter((f) => !f.slug).map(({ href, title, note }) => ({ href, title, note })) };
  }
}

/** The Telegram mini app's home. */
export default async function TelegramHomePage() {
  const { fresh, featured } = await homeData();
  return <TelegramHome fresh={fresh} featured={featured} />;
}
