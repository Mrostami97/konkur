import { articles, editorialDateIso, guides } from "../../content/editorial";
import { absoluteUrl, SITE_DESCRIPTION } from "../../lib/seo";

function xml(value: string) { return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character); }

export function GET() {
  const items = [...guides, ...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((item) => {
    const base = guides.includes(item) ? "/guides" : "/articles";
    return `<item><title>${xml(item.title)}</title><link>${xml(absoluteUrl(`${base}/${item.slug}`))}</link><guid>${xml(absoluteUrl(`${base}/${item.slug}`))}</guid><description>${xml(item.description)}</description><pubDate>${new Date(editorialDateIso(item.publishedAt)).toUTCString()}</pubDate></item>`;
  }).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>kunkur01</title><link>${absoluteUrl("/")}</link><description>${xml(SITE_DESCRIPTION)}</description><language>fa-IR</language>${items}</channel></rss>`, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
