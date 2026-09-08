import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = (process.env.WEB_TEST_BASE_URL ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const canonicalOrigin = (process.env.WEB_TEST_CANONICAL_ORIGIN ?? "https://kunkur01.ir").replace(/\/$/, "");
const corpusUrl = new URL("../src/content/phase11-corpus.json", import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, "utf8"));

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

function robotsOf(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
}

function escapedRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const guideRoutes = corpus.guideSlugs.map((slug) => `/guides/${slug}`);
const subjectRoutes = corpus.subjectSlugs.map((slug) => `/subjects/${slug}`);
const allRoutes = [...guideRoutes, ...subjectRoutes];
assert.equal(allRoutes.length, 20, "Phase 11 SSR coverage must include exactly 20 routes");

for (const route of allRoutes) {
  const page = await read(route);
  assert.equal(page.response.status, 200, `${route} must render successfully`);
  assert.equal(canonicalOf(page.body), `${canonicalOrigin}${route}`, `${route} must have its exact canonical URL`);
  assert.equal(h1Count(page.body), 1, `${route} must render exactly one h1`);
}

for (const slug of corpus.subjectSlugs) {
  const route = `/subjects/${slug}`;
  const page = await read(route);
  assert.match(page.body, /data-phase11="verified-subject-hub"/, `${route} must expose the Phase 11 verification marker`);
  assert.match(page.body, /منابع این صفحه/, `${route} must render its source section`);
  assert.match(page.body, /بررسی/, `${route} must render its review date`);
  assert.match(page.body, /سازمان سنجش/, `${route} must cite the official Sanjesh source`);
}

for (const guideSlug of corpus.guideSlugs) {
  const route = `/guides/${guideSlug}`;
  const page = await read(route);
  const linkedSubjects = [...new Set(corpus.tracks[guideSlug].bundles.flatMap((bundle) => bundle.subjectSlugs))];
  for (const subjectSlug of linkedSubjects) {
    assert.match(
      page.body,
      new RegExp(`href="/subjects/${escapedRegExp(subjectSlug)}"`),
      `${route} must link to /subjects/${subjectSlug}`,
    );
  }
}

const filteredResources = await read("/resources?subject=data-structures-algorithms");
assert.equal(filteredResources.response.status, 200, "the subject-filtered resource destination must render");
assert.equal(canonicalOf(filteredResources.body), `${canonicalOrigin}/resources`);
assert.match(robotsOf(filteredResources.body), /noindex/, "filtered resource URLs must remain out of the search index");
assert.match(filteredResources.body, /منابع داده‌ساختار و الگوریتم/, "the resource destination must consume the subject filter");

const subjectSitemap = await read("/sitemaps/subjects.xml");
assert.ok(
  subjectSitemap.response.status === 200 || subjectSitemap.response.status === 503,
  "the subject sitemap must return 200, or an explicit 503 while its API dependency is unavailable",
);
assert.match(subjectSitemap.response.headers.get("content-type") ?? "", /application\/xml/);
assert.match(subjectSitemap.body, /<urlset/);
if (subjectSitemap.response.status === 503) {
  assert.ok(subjectSitemap.response.headers.get("retry-after"), "an API-outage sitemap response must include Retry-After");
  console.warn("Subject sitemap reported its API dependency unavailable (503); static Phase 11 URLs were still verified.");
}

const sitemapLocations = [...subjectSitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(sitemapLocations).size, sitemapLocations.length, "the subject sitemap must not contain duplicate URLs");
for (const slug of corpus.subjectSlugs) {
  const canonical = `${canonicalOrigin}/subjects/${slug}`;
  assert.equal(
    sitemapLocations.filter((location) => location === canonical).length,
    1,
    `${canonical} must occur exactly once in the subject sitemap`,
  );
}

console.log("Phase 11 SSR smoke tests passed: 20 canonical routes and the subject sitemap were verified.");
