import type { Metadata } from "next";
import { publicArticlePath, type PublicArticleRecord } from "../../components/PublicContent";
import { apiGetPublic } from "../../lib/api";
import { PRIVATE_PAGE_METADATA } from "../../lib/seo";
import { TelegramHome, type FreshItem } from "./TelegramHome";
import "./tg.css";

export const metadata: Metadata = { ...PRIVATE_PAGE_METADATA, title: { absolute: "کنکور کامپیوتر" } };

async function freshReads(): Promise<FreshItem[]> {
  try {
    const articles = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
    return [...articles]
      .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
      .slice(0, 5)
      .map((article) => ({ href: publicArticlePath(article), title: article.title, summary: article.summary }));
  } catch {
    return [];
  }
}

/** The Telegram mini app's home. */
export default async function TelegramHomePage() {
  return <TelegramHome fresh={await freshReads()} />;
}
