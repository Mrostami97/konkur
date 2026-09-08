import { articles, editorialDateIso, guides } from "../../content/editorial";
import { phase12EditorialPages } from "../../content/phase12";
import { apiGetPublic } from "../../lib/api";
import { absoluteUrl, SITE_DESCRIPTION } from "../../lib/seo";

function xml(value: string) { return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character); }

type FeedEntry = { title: string; description: string; path: string; publishedAt: string };
type PublicArticle = {
  slug: string;
  title: string;
  summary: string;
  contentType?: string | null;
  publishedAt?: string | null;
};

async function publishedArticles() {
  try {
    const value = await apiGetPublic<PublicArticle[]>("/articles");
    return { items: value ?? [], complete: Array.isArray(value) };
  } catch {
    return { items: [], complete: false };
  }
}

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export async function GET() {
  const apiResult = await publishedArticles();
  const apiArticles = apiResult.items;
  const publishedSlugs = new Set(apiArticles.map((item) => item.slug));
  const entries: FeedEntry[] = [
    ...[...guides, ...phase12EditorialPages].filter((item) => !publishedSlugs.has(item.slug)).map((item) => ({ title: item.title, description: item.description, path: `/guides/${item.slug}`, publishedAt: editorialDateIso(item.publishedAt) })),
    ...articles.filter((item) => !publishedSlugs.has(item.slug)).map((item) => ({ title: item.title, description: item.description, path: `/articles/${item.slug}`, publishedAt: editorialDateIso(item.publishedAt) })),
    ...apiArticles.map((item) => ({
      title: item.title,
      description: item.summary,
      path: `${item.contentType === "GUIDE" ? "/guides" : "/articles"}/${item.slug}`,
      publishedAt: item.publishedAt ?? new Date(0).toISOString(),
    })),
  ];
  const unique = new Map(entries.map((entry) => [entry.path, entry]));
  const sorted = [...unique.values()].sort((left, right) => validDate(right.publishedAt).getTime() - validDate(left.publishedAt).getTime());
  const items = sorted.map((item) => {
    const url = absoluteUrl(item.path);
    return `<item><title>${xml(item.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(item.description)}</description><pubDate>${validDate(item.publishedAt).toUTCString()}</pubDate></item>`;
  }).join("");
  const latest = sorted[0] ? validDate(sorted[0].publishedAt).toUTCString() : new Date(0).toUTCString();
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>کنکورصفریک</title><link>${absoluteUrl("/")}</link><atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/><description>${xml(SITE_DESCRIPTION)}</description><language>fa-IR</language><lastBuildDate>${latest}</lastBuildDate>${items}</channel></rss>`, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": apiResult.complete ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } });
}
