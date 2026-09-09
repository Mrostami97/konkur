import { absoluteUrl } from "../../lib/seo";

const sitemapPaths = [
  "/sitemaps/pages.xml",
  "/sitemaps/guides.xml",
  "/sitemaps/articles.xml",
  "/sitemaps/subjects.xml",
  "/sitemaps/topics.xml",
  "/sitemaps/resources.xml",
  "/sitemaps/report-cards.xml",
  "/sitemaps/admissions.xml",
] as const;

function xml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '\"': "&quot;",
  })[character] ?? character);
}

export function GET() {
  const entries = sitemapPaths.map((path) => `<sitemap><loc>${xml(absoluteUrl(path))}</loc></sitemap>`).join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
