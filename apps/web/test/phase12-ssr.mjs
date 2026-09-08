import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = (process.env.WEB_TEST_BASE_URL ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const canonicalOrigin = (process.env.WEB_TEST_CANONICAL_ORIGIN ?? "https://kunkur01.ir").replace(/\/$/, "");
const corpus = JSON.parse(await readFile(new URL("../src/content/phase12-corpus.json", import.meta.url), "utf8"));
const pages = [...corpus.planningPages, ...corpus.officialPages];

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

assert.equal(pages.length, 22);
for (const page of pages) {
  const route = `/guides/${page.slug}`;
  const result = await read(route);
  assert.equal(result.response.status, 200, `${route} must render successfully`);
  assert.equal(canonicalOf(result.body), `${canonicalOrigin}${route}`, `${route} must have an exact canonical`);
  assert.equal(h1Count(result.body), 1, `${route} must render exactly one h1`);
  assert.match(result.body, /data-phase12="verified-guide"/, `${route} must expose the Phase 12 marker`);
  assert.match(result.body, /پاسخ سریع/, `${route} must render its answer-first block`);
  assert.match(result.body, /منابع و اعتبارسنجی/, `${route} must render sources`);
  assert.match(result.body, /آخرین بررسی/, `${route} must render its review date`);
  if (page.kind === "OFFICIAL") {
    assert.match(result.body, /ملاک نهایی/, `${route} must carry the official-source warning`);
  }
  for (const item of page.internalLinks) {
    assert.match(result.body, new RegExp(`href="${escapedRegExp(item.href)}"`), `${route} must link to ${item.href}`);
  }
}

const guideIndex = await read("/guides");
assert.equal(guideIndex.response.status, 200);
for (const page of pages) {
  assert.match(guideIndex.body, new RegExp(`href="/guides/${escapedRegExp(page.slug)}"`));
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

const search = await read("/search?q=دفترچه+خطا");
assert.equal(search.response.status, 200);
assert.match(search.body, /href="\/guides\/error-log"/, "fallback search must discover Phase 12 guides");

const llms = await read("/llms.txt");
assert.equal(llms.response.status, 200);
for (const page of pages) assert.match(llms.body, new RegExp(`/guides/${escapedRegExp(page.slug)}`));

console.log("Phase 12 SSR smoke tests passed: 22 canonical guides, discovery surfaces and warnings were verified.");
