import assert from "node:assert/strict";

const baseUrl = (process.env.WEB_TEST_BASE_URL ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const canonicalOrigin = (process.env.WEB_TEST_CANONICAL_ORIGIN ?? "https://kunkur01.ir").replace(/\/$/, "");

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  return { response, body };
}

function canonicalOf(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
}

function robotsOf(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
}

function structuredData(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      const value = JSON.parse(match[1]);
      return Array.isArray(value) ? value : [value];
    });
}

const sitemapIndex = await read("/sitemap.xml");
assert.equal(sitemapIndex.response.status, 200);
assert.match(sitemapIndex.response.headers.get("content-type") ?? "", /application\/xml/);
assert.match(sitemapIndex.body, /<sitemapindex/);
const sitemapLocations = [...sitemapIndex.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapLocations.length, 8);

for (const location of sitemapLocations) {
  const url = new URL(location);
  const sitemap = await read(`${url.pathname}${url.search}`);
  assert.equal(sitemap.response.status, 200, `${url.pathname} must be available while the API is healthy`);
  assert.match(sitemap.body, /<urlset/);
}

const pageSitemap = await read("/sitemaps/pages.xml");
assert.doesNotMatch(pageSitemap.body, /rank-estimate/);
assert.match(pageSitemap.body, /\/admissions/);

const admissionsSitemap = await read("/sitemaps/admissions.xml");
assert.equal(admissionsSitemap.response.status, 200);
assert.match(admissionsSitemap.body, /\/admissions/);
assert.match(admissionsSitemap.body, /\/programs/);

const rss = await read("/rss.xml");
assert.equal(rss.response.status, 200);
assert.match(rss.response.headers.get("content-type") ?? "", /application\/rss\+xml/);
assert.match(rss.body, /<rss/);
assert.match(rss.body, /<item>/);

const robots = await read("/robots.txt");
assert.equal(robots.response.status, 200);
assert.match(robots.body, /Disallow: \/admin/);
assert.match(robots.body, /Sitemap: .*\/sitemap\.xml/);
assert.match(robots.body, /Allow: \/universities\//);
assert.match(robots.body, /Allow: \/programs\//);

const llms = await read("/llms.txt");
assert.equal(llms.response.status, 200);
assert.match(llms.body, /# kunkur01/);
assert.match(llms.body, /سیاست اصلاح/);
assert.match(llms.body, /دانشگاه‌ها و رشته‌محل‌های دارای منبع رسمی/);

const admissions = await read("/admissions");
assert.equal(admissions.response.status, 200);
assert.equal(canonicalOf(admissions.body), `${canonicalOrigin}/admissions`);

const filteredArticles = await read("/articles?topic=algorithm");
assert.equal(filteredArticles.response.status, 200);
assert.equal(canonicalOf(filteredArticles.body), `${canonicalOrigin}/articles`);
assert.match(robotsOf(filteredArticles.body), /noindex/);

const search = await read("/search?q=%D8%AF%D8%A7%D8%AF%D9%87%E2%80%8C%D8%B3%D8%A7%D8%AE%D8%AA%D8%A7%D8%B1");
assert.equal(search.response.status, 200);
assert.equal(canonicalOf(search.body), `${canonicalOrigin}/search`);
assert.match(robotsOf(search.body), /noindex/);
assert.match(search.body, /نتایج|نتیجه‌ای پیدا نشد/);

const reportCards = await read("/report-cards?page=2");
assert.equal(reportCards.response.status, 200);
assert.equal(canonicalOf(reportCards.body), `${canonicalOrigin}/report-cards`);
assert.match(robotsOf(reportCards.body), /noindex/);
assert.ok(structuredData(reportCards.body).some((item) => item["@type"] === "Dataset"));

const rankEstimate = await read("/rank-estimate");
assert.equal(rankEstimate.response.status, 200);
assert.match(robotsOf(rankEstimate.body), /noindex/);
assert.notEqual(canonicalOf(rankEstimate.body), `${canonicalOrigin}/`);

const legacyGuide = await read("/guides/master-computer-engineering-1406");
assert.equal(legacyGuide.response.status, 200);
assert.equal(canonicalOf(legacyGuide.body), `${canonicalOrigin}/guides/master-computer-engineering-1406`);
assert.match(legacyGuide.body, /انتساب نویسنده و بازبین/);
const guideSchemas = structuredData(legacyGuide.body);
assert.ok(guideSchemas.some((item) => item["@type"] === "Article"));
assert.ok(guideSchemas.some((item) => item["@type"] === "BreadcrumbList"));

const font = await read("/fonts/IRANYekanWebRegular.woff2");
assert.equal(font.response.status, 200);
assert.ok(font.body.length > 0);

console.log("Phase 10 SEO smoke tests passed.");
