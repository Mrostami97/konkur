import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = (process.env.WEB_TEST_BASE_URL ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const canonicalOrigin = (process.env.WEB_TEST_CANONICAL_ORIGIN ?? "https://kunkur01.ir").replace(/\/$/, "");
const corpus = JSON.parse(
  await readFile(new URL("../src/content/phase13-corpus.json", import.meta.url), "utf8"),
);

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

function decodeHtmlAttribute(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&#x26;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function hrefsOf(html) {
  return [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => decodeHtmlAttribute(match[1]));
}

function robotsOf(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
}

function assertSuccessfulSitemap(result, label) {
  assert.ok(
    result.response.status === 200 || result.response.status === 503,
    `${label} must return 200, or an explicit 503 while its API dependency is unavailable`,
  );
  assert.match(result.response.headers.get("content-type") ?? "", /application\/xml/);
  assert.match(result.body, /<urlset/);
  if (result.response.status === 503) {
    assert.ok(result.response.headers.get("retry-after"), `${label} must include Retry-After on a 503 response`);
  }
}

const decisionRoutes = corpus.decisionPages.map((page) => ({
  page,
  route: `/guides/${page.slug}`,
  marker: 'data-phase13="verified-decision-guide"',
}));
const caseStudyRoutes = corpus.caseStudies.map((page) => ({
  page,
  route: `/articles/${page.slug}`,
  marker: 'data-phase13="verified-case-study"',
}));
const phase13Routes = [...decisionRoutes, ...caseStudyRoutes];
assert.equal(decisionRoutes.length, 8, "the publication gate must cover exactly 8 Phase 13 decision guides");
assert.equal(caseStudyRoutes.length, 6, "the publication gate must cover exactly 6 Phase 13 case studies");
assert.equal(phase13Routes.length, 14, "the publication gate must cover exactly 14 Phase 13 routes");

// The generated Phase 13 records are DRAFT. Public API endpoints do not return
// them, and the web app must not replace that publication decision with static
// external-AI fallback content.
for (const { page, route, marker } of phase13Routes) {
  const result = await read(route);
  assert.ok(
    result.response.status === 404 || result.response.status === 200,
    `${route} must use the not-found boundary until an API record is PUBLISHED`,
  );
  if (result.response.status === 200) {
    // Next.js returns HTTP 200 after a streamed response has started, while
    // `notFound()` still injects noindex and renders the not-found boundary.
    assert.match(robotsOf(result.body), /noindex/, `${route} streamed not-found response must be noindex`);
  }
  assert.ok(!result.body.includes(marker), `${route} must not expose a Phase 13 publication marker while unpublished`);
  assert.ok(!result.body.includes(page.title), `${route} must not expose the Draft title`);
  assert.ok(!result.body.includes(page.quickAnswer), `${route} must not expose the Draft body`);
}

const guideIndex = await read("/guides");
assert.equal(guideIndex.response.status, 200, "the guide index must remain public");
assert.equal(canonicalOf(guideIndex.body), `${canonicalOrigin}/guides`);
const guideIndexHrefs = hrefsOf(guideIndex.body);
for (const { route } of decisionRoutes) {
  assert.ok(!guideIndexHrefs.includes(route), `the guide index must not advertise unpublished route ${route}`);
}

const articleIndex = await read("/articles");
assert.equal(articleIndex.response.status, 200, "the article index must remain public");
assert.equal(canonicalOf(articleIndex.body), `${canonicalOrigin}/articles`);
const articleIndexHrefs = hrefsOf(articleIndex.body);
for (const { route } of caseStudyRoutes) {
  assert.ok(!articleIndexHrefs.includes(route), `the article index must not advertise unpublished route ${route}`);
}

for (const { page, route } of phase13Routes) {
  const search = await read(`/search?q=${encodeURIComponent(page.title)}`);
  assert.equal(search.response.status, 200, `search must remain available for ${page.slug}`);
  assert.equal(canonicalOf(search.body), `${canonicalOrigin}/search`);
  assert.match(robotsOf(search.body), /noindex/, "search result URLs must remain noindex");
  assert.ok(!hrefsOf(search.body).includes(route), `search must not reveal unpublished route ${route}`);
}

const guideSitemap = await read("/sitemaps/guides.xml");
assertSuccessfulSitemap(guideSitemap, "the guide sitemap");
const guideLocations = [...guideSitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(guideLocations).size, guideLocations.length, "guide sitemap URLs must be unique");
for (const { route } of decisionRoutes) {
  assert.ok(!guideLocations.includes(`${canonicalOrigin}${route}`), `the guide sitemap must omit ${route}`);
}

const articleSitemap = await read("/sitemaps/articles.xml");
assertSuccessfulSitemap(articleSitemap, "the article sitemap");
const articleLocations = [...articleSitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(new Set(articleLocations).size, articleLocations.length, "article sitemap URLs must be unique");
for (const { route } of caseStudyRoutes) {
  assert.ok(!articleLocations.includes(`${canonicalOrigin}${route}`), `the article sitemap must omit ${route}`);
}

const rss = await read("/rss.xml");
assert.equal(rss.response.status, 200, "RSS must remain public");
assert.match(rss.response.headers.get("content-type") ?? "", /application\/rss\+xml/);
for (const { route } of phase13Routes) {
  assert.doesNotMatch(rss.body, new RegExp(escapedRegExp(`${canonicalOrigin}${route}`)), `RSS must omit ${route}`);
}

const llms = await read("/llms.txt");
assert.equal(llms.response.status, 200, "llms.txt must remain public");
for (const { route } of phase13Routes) {
  assert.doesNotMatch(llms.body, new RegExp(escapedRegExp(`${canonicalOrigin}${route}`)), `llms.txt must omit ${route}`);
}

const evidenceClaims = [
  { claim: "۱۰۰٪", source: "https://t.me/Konkur_answer/4666" },
  { claim: "۱۰ پاسخ صحیح از ۱۱ سؤال معتبر", source: "https://t.me/Konkur_answer/3609" },
  { claim: "۹ تست صحیح", source: "https://t.me/Konkur_answer/4767" },
  { claim: "۹ سؤال از ۱۲ سؤال مشابه یا منطبق با مطالب تدریس‌شده", source: "https://t.me/Konkur_answer/4767" },
  { claim: "۱۶ پاسخ صحیح از ۱۹ تست", source: "https://t.me/Konkur_answer/4753" },
  { claim: "نمونه سؤال طراحی‌شده توسط مدرس که در کنکور مطرح شده است", source: "https://t.me/Konkur_answer/3922" },
];
const evidence = await read("/evidence");
assert.equal(evidence.response.status, 200, "the existing evidence hub must remain public");
assert.equal(canonicalOf(evidence.body), `${canonicalOrigin}/evidence`);
assert.equal(h1Count(evidence.body), 1, "the evidence hub must render exactly one h1");
assert.match(evidence.body, /شفافیت منبع و تعارض منافع/, "the evidence hub must disclose its first-party commercial interest");
assert.match(evidence.body, /تأیید مستقل محسوب نمی‌شوند/, "the evidence hub must disclose the lack of independent verification");
assert.match(evidence.body, /رضایت صریح/, "the evidence hub must explain its consent boundary");
assert.doesNotMatch(evidence.body, /آقای کریمی|شیوا خوش‌نام/, "identifiable student names must stay private without recorded consent");
assert.match(evidence.body, /\"@type\":\"ItemList\"/, "evidence structured data must describe a bounded item list, not verified outcome data");
const evidenceHrefs = hrefsOf(evidence.body);
const exactThesisUrl = "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";
assert.ok(evidenceHrefs.includes(exactThesisUrl), "the evidence hub must use the exact supplied Sharif thesis record");
for (const { route } of caseStudyRoutes) {
  assert.ok(!evidenceHrefs.includes(route), `the evidence hub must not link to unpublished case study ${route}`);
}
for (const { claim, source } of evidenceClaims) {
  assert.match(evidence.body, new RegExp(escapedRegExp(claim)), `the evidence hub must retain claim “${claim}”`);
  assert.ok(evidenceHrefs.includes(source), `the evidence hub must retain source ${source}`);
}

const trustRoutes = [
  "/about",
  "/editorial-policy",
  "/source-policy",
  "/corrections",
];
for (const route of trustRoutes) {
  const result = await read(route);
  assert.equal(result.response.status, 200, `${route} must remain public`);
  assert.equal(canonicalOf(result.body), `${canonicalOrigin}${route}`, `${route} must have its exact canonical URL`);
  assert.equal(h1Count(result.body), 1, `${route} must render exactly one h1`);
  assert.match(llms.body, new RegExp(escapedRegExp(`${canonicalOrigin}${route}`)), `llms.txt must retain ${route}`);
}

const pagesSitemap = await read("/sitemaps/pages.xml");
assertSuccessfulSitemap(pagesSitemap, "the public-pages sitemap");
for (const route of [...trustRoutes, "/evidence"]) {
  assert.match(
    pagesSitemap.body,
    new RegExp(escapedRegExp(`${canonicalOrigin}${route}`)),
    `the pages sitemap must retain ${route}`,
  );
}

console.log("Phase 13 publication-gate SSR tests passed: 14 drafts stayed private and trust/evidence surfaces remained public.");
