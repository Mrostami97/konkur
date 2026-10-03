import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// The production web build is exercised against a loopback-only fixture API.
// This test does not start the real API, open a database, or use account data.
const require = createRequire(import.meta.url);
const appDir = fileURLToPath(new URL("..", import.meta.url));
const canonical = "https://kunkurcomputer.ir";
let title = "نمونهٔ آزمایش مهاجرت";
let articlesAvailable = true;
let checks = 0;
const record = (contentType = "ARTICLE") => ({
  slug: contentType === "GUIDE" ? "dependency-guide" : "dependency-smoke",
  title, summary: "محتوای مصنوعی و محلی برای بررسی مهاجرت فنی", contentType,
  quickAnswer: null, contentBlocks: [{ type: "text", text: title }], assets: [],
  taxonomyMajor: [], taxonomyTags: [], taxonomyDegrees: [], taxonomyFields: [],
  subjectCodes: [], topicCodes: [], seoTitle: null, seoDescription: null,
  validForYear: null, sourceValidatedAt: null, reviewDueAt: null,
  reviewedAt: "2026-10-01T00:00:00.000Z", publishedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z", sources: [], authorProfile: null, reviewerProfile: null,
});
const course = {
  id: "fixture-course", slug: "dependency-course", title: "دورهٔ آزمایش محلی",
  description: "این دوره فقط در محیط آزمایش وجود دارد.", accessMode: "PUBLIC", updatedAt: "2026-10-01T00:00:00.000Z",
  modules: [{ id: "fixture-module", title: "فصل آزمایش", order: 1, lessons: [{ id: "fixture-lesson", title: "درس آزمایش", order: 1, isPreview: true }] }],
};
const listPaths = new Set(["/subjects", "/topics", "/resources", "/programs", "/universities", "/products", "/instructors", "/consultations", "/exams", "/achievements"]);
const fixture = createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  let data;
  let status = 200;
  if (url.pathname === "/articles") { data = [record(), record("GUIDE")]; if (!articlesAvailable) status = 503; }
  else if (url.pathname === "/articles/dependency-smoke") data = record();
  else if (url.pathname === "/articles/dependency-guide") data = record("GUIDE");
  else if (url.pathname === "/courses") data = [course];
  else if (url.pathname === "/courses/dependency-course") data = course;
  else if (url.pathname === "/site/availability") data = { courses: 1, paidCourses: 0, questions: 0, exams: 0, freeVideos: 0, resources: 0, consultations: 0, instructors: 0, results: 0, reportCards: 0, programs: 0, smsLogin: false, otpLogin: false };
  else if (url.pathname === "/achievements/summary") data = { total: 0, years: [] };
  else if (url.pathname === "/report-cards") data = { items: [], page: 1, limit: 12, total: 0, totalPages: 0, cohort: { sampleSize: 0, minimumSampleSize: 5, dataYears: [], aggregate: null, limitations: [] } };
  else if (url.pathname === "/content/search") data = { items: [], page: 1, limit: 12, total: 0, totalPages: 0 };
  else if (listPaths.has(url.pathname)) data = [];
  else { status = 404; data = { message: "Fixture route not found" }; }
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
});
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const fixtureOrigin = `http://127.0.0.1:${fixture.address().port}`;
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const web = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: appDir,
  env: { ...process.env, NODE_ENV: "production", INTERNAL_API_URL: fixtureOrigin, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
web.stdout.on("data", (chunk) => { serverLog += chunk; });
web.stderr.on("data", (chunk) => { serverLog += chunk; });

async function read(path, options = {}) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000), ...options });
  return { response, body: await response.text() };
}
function metadata(body, path, noindex = false) {
  assert.equal(body.match(/<link rel="canonical" href="([^"]+)"/)?.[1], `${canonical}${path}`);
  const robots = body.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
  assert.equal(robots.includes("noindex"), noindex, `${path} robots must preserve query indexing rules`);
  checks++;
}

try {
  let ready = false;
  for (let index = 0; index < 80; index++) {
    if (web.exitCode !== null) throw new Error(`Next exited before starting: ${serverLog}`);
    try { ready = (await read("/robots.txt")).response.ok; } catch { /* waiting for the loopback server */ }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, "isolated Next production server must become ready");

  const article = await read("/articles/dependency-smoke");
  assert.equal(article.response.status, 200);
  assert.match(article.body, /نمونهٔ آزمایش مهاجرت/);
  metadata(article.body, "/articles/dependency-smoke");
  title = "عنوان جدید آزمایش محلی";
  const refreshed = await read("/articles/dependency-smoke");
  assert.match(refreshed.body, /عنوان جدید آزمایش محلی/, "public no-store reads must observe updated API content");
  checks++;

  const redirected = await read("/articles/dependency-guide", { redirect: "manual" });
  assert.equal(redirected.response.status, 308);
  assert.equal(redirected.response.headers.get("location"), "/guides/dependency-guide");
  checks++;
  const guide = await read("/guides/dependency-guide");
  assert.equal(guide.response.status, 200);
  metadata(guide.body, "/guides/dependency-guide");
  const coursePage = await read("/courses/dependency-course");
  assert.equal(coursePage.response.status, 200);
  assert.match(coursePage.body, /"@type":"Course"/);
  metadata(coursePage.body, "/courses/dependency-course");

  for (const route of ["/articles?subject=cpu", "/guides?subject=cpu", "/subjects?subject=cpu", "/resources?kind=PDF", "/programs?degree=phd", "/results?year=1405", "/report-cards?page=2", "/search?q=cpu"]) {
    const page = await read(route);
    assert.equal(page.response.status, 200, route);
    metadata(page.body, route.split("?")[0], true);
  }
  const bank = await read("/questions?subject=operating-systems");
  assert.equal(bank.response.status, 200);
  assert.match(bank.body, /initialSubject[^<]*operating-systems/);
  checks++;
  for (const route of ["/lessons/fixture-lesson", "/attempts/fixture-attempt", "/attempts/fixture-attempt/report", "/account/orders/fixture-order", "/account/library/fixture-resource", "/admin/import/fixture-job", "/admin/crm/leads/fixture-lead", "/instructor/students/fixture-student"]) {
    const page = await read(route);
    assert.equal(page.response.status, 200, `${route} client use(params) must render its anonymous shell`);
    assert.doesNotMatch(page.body, /Application error: a (?:client|server)-side exception/);
    checks++;
  }

  const index = await read("/sitemap.xml");
  assert.equal(index.response.status, 200);
  assert.match(index.body, /<sitemapindex/);
  const locations = [...index.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  assert.equal(locations.length, 9);
  for (const route of locations) {
    const sitemap = await read(route);
    assert.equal(sitemap.response.status, 200, route);
    assert.match(sitemap.response.headers.get("content-type"), /application\/xml/);
    assert.match(sitemap.body, /<urlset/);
    checks++;
  }
  const articleMap = await read("/sitemaps/articles.xml");
  assert.match(articleMap.body, /\/articles\/dependency-smoke/);
  articlesAvailable = false;
  const unavailableMap = await read("/sitemaps/articles.xml");
  assert.equal(unavailableMap.response.status, 503, "an unavailable API must not become a successful cached sitemap");
  assert.equal(unavailableMap.response.headers.get("cache-control"), "no-store");
  checks++;
  articlesAvailable = true;
  const recoveredMap = await read("/sitemaps/articles.xml");
  assert.equal(recoveredMap.response.status, 200);
  assert.match(recoveredMap.body, /\/articles\/dependency-smoke/);
  checks++;

  for (const route of ["/rss.xml", "/llms.txt"]) {
    const feed = await read(route);
    assert.equal(feed.response.status, 200, route);
    assert.match(feed.body, /dependency-smoke/);
    checks++;
  }
  const image = await fetch(`${base}/_next/image?url=%2Fbrand%2Fkonkurcom-logo.png&w=64&q=75`, { signal: AbortSignal.timeout(15000) });
  assert.equal(image.status, 200, "the patched native image optimizer must serve a normal local PNG");
  assert.match(image.headers.get("content-type"), /image\//);
  checks++;
  console.log(`Next 15 request props, SEO, cache freshness, sitemaps and image optimizer: ${checks} checks passed (isolated fixture; no database).`);
} catch (error) {
  console.error(serverLog.slice(-12000));
  throw error;
} finally {
  web.kill();
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
