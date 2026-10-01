import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = (process.env.WEB_TEST_BASE_URL ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const canonicalOrigin = (process.env.WEB_TEST_CANONICAL_ORIGIN ?? "https://kunkurcomputer.ir").replace(/\/$/, "");
const corpus = JSON.parse(await readFile(new URL("../src/content/phase12-corpus.json", import.meta.url), "utf8"));
const allPages = [...corpus.planningPages, ...corpus.officialPages];
// Owner-approved merges (src/content/merged-pages.json): these guides now 301 to
// their article twin and leave every discovery surface.
const merged = JSON.parse(await readFile(new URL("../src/content/merged-pages.json", import.meta.url), "utf8")).redirects;
const mergedTarget = new Map(merged.map((entry) => [entry.from, entry.to]));
const canonicalHref = (href) => mergedTarget.get(href) ?? href;
const pages = allPages.filter((page) => !mergedTarget.has(`/guides/${page.slug}`));
const mergedPages = allPages.filter((page) => mergedTarget.has(`/guides/${page.slug}`));

async function read(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  return { response, body };
}

function canonicalOf(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
}

function h1Count(html) {
  return [...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length;
}

function escapedRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

assert.equal(allPages.length, 22);
assert.equal(mergedPages.length, merged.length, "every merged guide must be a Phase 12 guide");
for (const page of mergedPages) {
  const route = `/guides/${page.slug}`;
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  assert.equal(response.status, 301, `${route} must permanently redirect to its merged page`);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, mergedTarget.get(route), `${route} must redirect to ${mergedTarget.get(route)}`);
}
for (const page of pages) {
  const route = `/guides/${page.slug}`;
  const result = await read(route);
  assert.equal(result.response.status, 200, `${route} must render successfully`);
  assert.equal(canonicalOf(result.body), `${canonicalOrigin}${route}`, `${route} must have an exact canonical`);
  assert.equal(h1Count(result.body), 1, `${route} must render exactly one h1`);
  assert.match(result.body, /data-phase12="verified-guide"/, `${route} must expose the Phase 12 marker`);
  assert.match(result.body, /پاسخ سریع/, `${route} must render its answer-first block`);
  assert.match(result.body, /منابع و اعتبارسنجی/, `${route} must render sources`);
  assert.match(result.body, /تاریخ ثبت/, `${route} must show the date recorded for the unreviewed fallback`);
  assert.match(result.body, /بازبینی انسانی: در انتظار تأیید/, `${route} must disclose its pending review`);
  const schemas = [...result.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(match => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
  const articleSchema = schemas.find(item => item["@type"] === "Article");
  assert.equal(articleSchema?.author?.["@type"], "Organization", `${route} must retain editorial attribution`);
  assert.equal(articleSchema.author.name, "تحریریه کنکور کامپیوتر");
  assert.ok(!("dateModified" in articleSchema), `${route} must not turn pending review into a modification date`);
  if (page.kind === "OFFICIAL") {
    assert.match(result.body, /ملاک نهایی/, `${route} must carry the official-source warning`);
  }
  for (const item of page.internalLinks) {
    const href = canonicalHref(item.href);
    assert.match(result.body, new RegExp(`href="${escapedRegExp(href)}"`), `${route} must link to ${href}`);
  }
}

const guideIndex = await read("/guides");
assert.equal(guideIndex.response.status, 200);
for (const page of pages) {
  assert.match(guideIndex.body, new RegExp(`href="/guides/${escapedRegExp(page.slug)}"`));
}
for (const page of mergedPages) {
  assert.doesNotMatch(guideIndex.body, new RegExp(`href="/guides/${escapedRegExp(page.slug)}"`), `the guide index must not list merged guide ${page.slug}`);
}

const guideSitemap = await read("/sitemaps/guides.xml");
assert.ok(guideSitemap.response.status === 200 || guideSitemap.response.status === 503);
assert.match(guideSitemap.response.headers.get("content-type") ?? "", /application\/xml/);
const locations = [...guideSitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(locations).size, locations.length, "guide sitemap URLs must be unique");
for (const page of pages) {
  const canonical = `${canonicalOrigin}/guides/${page.slug}`;
  assert.equal(locations.filter((location) => location === canonical).length, 1, `${canonical} must occur once`);
}
for (const page of mergedPages) {
  assert.ok(!locations.includes(`${canonicalOrigin}/guides/${page.slug}`), `the guide sitemap must omit merged guide ${page.slug}`);
}

const search = await read("/search?q=دفترچه+خطا");
assert.equal(search.response.status, 200);
assert.match(search.body, /href="\/guides\/error-log"/, "fallback search must discover Phase 12 guides");

const llms = await read("/llms.txt");
assert.equal(llms.response.status, 200);
for (const page of pages) assert.match(llms.body, new RegExp(`/guides/${escapedRegExp(page.slug)}`));
for (const page of mergedPages) assert.doesNotMatch(llms.body, new RegExp(`/guides/${escapedRegExp(page.slug)}[)\\s]`), `llms.txt must omit merged guide ${page.slug}`);

console.log(`Phase 12 SSR smoke tests passed: ${pages.length} canonical guides, ${mergedPages.length} merged redirects, discovery surfaces and warnings were verified.`);
