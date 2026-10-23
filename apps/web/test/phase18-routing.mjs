import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const canonicalOrigin = "https://kunkurcomputer.ir";

function article(slug, contentType) {
  return {
    slug,
    title: contentType === "GUIDE" ? "راهنمای آزمایشی" : "مقالهٔ آزمایشی",
    summary: "رکورد کنترل‌شده برای آزمون مسیریابی.",
    contentType,
    quickAnswer: null,
    contentBlocks: [],
    assets: [],
    taxonomyMajor: [],
    taxonomyTags: [],
    taxonomyDegrees: [],
    taxonomyFields: [],
    subjectCodes: ["automata"],
    topicCodes: [],
    seoTitle: null,
    seoDescription: null,
    validForYear: null,
    sourceValidatedAt: null,
    reviewDueAt: null,
    reviewedAt: null,
    publishedAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
    sources: [],
    authorProfile: null,
    reviewerProfile: null,
  };
}

function topic(slug) {
  return {
    code: "MOCK_TOPIC",
    slug,
    title: "مبحث آزمایشی",
    description: "توضیح مبحث برای آزمون مسیریابی.",
    order: 1,
    metadata: {},
    subject: { code: "MOCK_SUBJECT", slug: "mock-subject", title: "درس آزمایشی", description: null },
    prerequisites: [],
    relatedContent: { articles: [], resources: [], courses: [] },
  };
}

async function listen(server, port = 0, hostname = "127.0.0.1") {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return address.port;
}

async function freePort() {
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForWeb(url, processOutput) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Next.js did not become ready. ${lastError ?? ""}\n${processOutput()}`);
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(-child.pid, "SIGTERM");
  }
}

function h1Count(html) {
  const renderedTags = [...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length;
  if (renderedTags > 0) return renderedTags;
  // A server-side notFound thrown after a dynamic lookup is serialized in the
  // React Flight payload. The browser hydrates this descriptor into the same
  // h1, while Next.js can still send the correct HTTP 404 before streaming.
  return [...html.matchAll(/\\"h1\\"/g)].length;
}

function robotsOf(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
}

function visibleMarkup(html) {
  // Next.js serializes route modules (including the not-found boundary) into
  // inline Flight scripts in development. Text found only in those scripts is
  // not rendered to the user and must not make an outage assertion flaky.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

const api = createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (path === "/article-kinds") {
    response.end(JSON.stringify([
      { slug: "mock-article", contentType: "ARTICLE" },
      { slug: "mock-guide", contentType: "GUIDE" },
      { slug: "mock-reviewed-before-publish", contentType: "ARTICLE" },
      { slug: "mock-reviewed-after-publish", contentType: "ARTICLE" },
    ]));
    return;
  }
  if (path === "/articles/mock-guide") {
    response.end(JSON.stringify(article("mock-guide", "GUIDE")));
    return;
  }
  if (path === "/articles/mock-article") {
    response.end(JSON.stringify(article("mock-article", "ARTICLE")));
    return;
  }
  if (path === "/articles") {
    response.end(JSON.stringify([
      { ...article("mock-reviewed-before-publish", "ARTICLE"), reviewedAt: "2026-09-15T00:00:00.000Z" },
      { ...article("mock-guide", "GUIDE"), reviewedAt: "2026-09-15T00:00:00.000Z" },
    ]));
    return;
  }
  if (path === "/articles/mock-reviewed-before-publish" || path === "/articles/mock-reviewed-after-publish") {
    const publishedAt = "2026-09-16T00:00:00.000Z";
    const reviewedAt = path.endsWith("before-publish") ? "2026-09-15T00:00:00.000Z" : "2026-09-17T00:00:00.000Z";
    response.end(JSON.stringify({
      ...article(path.slice("/articles/".length), "ARTICLE"),
      quickAnswer: "این پاسخ کوتاه و عمومی است.",
      publishedAt,
      reviewedAt,
    }));
    return;
  }
  if (path === "/topics/mock-topic") {
    response.end(JSON.stringify(topic("mock-topic")));
    return;
  }
  if (path === "/subjects" || path === "/topics") {
    response.end("[]");
    return;
  }
  if (path === "/articles/mock-unavailable" || path === "/courses/mock-unavailable" || path === "/topics/mock-unavailable") {
    response.statusCode = 503;
    response.end(JSON.stringify({ statusCode: 503, message: "Service Unavailable" }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ statusCode: 404, message: "Not Found" }));
});

const serverMode = process.env.WEB_ROUTING_MODE === "production" ? "start" : "dev";
// Next's proxy destination is baked into its production routes manifest at
// build time. Bind the mock at that loopback destination rather than pointing
// the runtime env at another port and accidentally testing the real service.
let apiOrigin;
if (serverMode === "start") {
  const manifest = JSON.parse(await readFile(new URL("../.next/routes-manifest.json", import.meta.url), "utf8"));
  const rewrites = Array.isArray(manifest.rewrites)
    ? manifest.rewrites
    : [...manifest.rewrites.beforeFiles, ...manifest.rewrites.afterFiles, ...manifest.rewrites.fallback];
  const gateway = rewrites.find((entry) => entry.source === "/api/:path*");
  assert.ok(gateway, "production build must contain the same-origin API gateway");
  const origin = new URL(gateway.destination);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "routing tests must never bind or call a non-local API");
  await listen(api, Number(origin.port || 80), origin.hostname.replace(/^\[|\]$/g, ""));
  apiOrigin = origin.origin;
} else {
  apiOrigin = `http://127.0.0.1:${await listen(api)}`;
}
const webPort = await freePort();
const isWindows = process.platform === "win32";
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const commandArguments = [nextCli, serverMode, "--hostname", "127.0.0.1", "--port", String(webPort)];
const nextEnvironment = { ...process.env };
delete nextEnvironment.NEXT_PUBLIC_API_URL;
let output = "";
const web = spawn(
  process.execPath,
  commandArguments,
  {
    cwd: webDirectory,
    env: {
      ...nextEnvironment,
      INTERNAL_API_URL: apiOrigin,
      NEXT_PUBLIC_SITE_URL: canonicalOrigin,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
web.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
web.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });

const baseUrl = `http://127.0.0.1:${webPort}`;

try {
  await waitForWeb(`${baseUrl}/articles/phase18-readiness-probe`, () => output);

  const gateway = await fetch(`${baseUrl}/api/articles/mock-article`);
  assert.equal(gateway.status, 200, "the same-origin /api gateway must proxy to the API");
  assert.equal(
    (await gateway.json()).slug,
    "mock-article",
    "the same-origin /api gateway must return the upstream payload",
  );

  const guideIndexHtml = visibleMarkup(await (await fetch(`${baseUrl}/guides`)).text());
  const pendingGuideCard = guideIndexHtml.match(/<a\b[^>]*href="\/guides\/weekly-study-plan"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(pendingGuideCard, "the pending weekly-plan guide must have a card on the guide index");
  assert.match(pendingGuideCard[1], /تاریخ ثبت/, "a pending guide card must label its date as recorded, not reviewed");
  assert.doesNotMatch(pendingGuideCard[1], /بررسی ۱۴۰۵/, "a pending guide card must not claim a completed review");

  for (const path of [
    "/articles/slug-does-not-exist",
    "/guides/slug-does-not-exist",
    "/courses/slug-does-not-exist",
    "/topics/slug-does-not-exist",
  ]) {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    const html = await response.text();
    assert.equal(response.status, 404, `${path} must return a real HTTP 404`);
    assert.equal(h1Count(html), 1, `${path} must render exactly one h1`);
    assert.match(html, /این صفحه پیدا نشد/, `${path} must render the Persian not-found message`);
    assert.match(robotsOf(html), /noindex/, `${path} must be noindex`);
  }

  const misplacedGuide = await fetch(`${baseUrl}/articles/mock-guide`, { redirect: "manual" });
  assert.equal(misplacedGuide.status, 308, "a guide requested under /articles must permanently redirect");
  assert.equal(misplacedGuide.headers.get("location"), "/guides/mock-guide");

  const misplacedArticle = await fetch(`${baseUrl}/guides/mock-article`, { redirect: "manual" });
  assert.equal(misplacedArticle.status, 308, "a non-guide requested under /guides must permanently redirect");
  assert.equal(misplacedArticle.headers.get("location"), "/articles/mock-article");

  const validTopic = await fetch(`${baseUrl}/topics/mock-topic`);
  const validTopicHtml = await validTopic.text();
  assert.equal(validTopic.status, 200, "a published topic must stay accessible");
  assert.equal(h1Count(validTopicHtml), 1, "a published topic must render one h1");
  assert.match(validTopicHtml, /مبحث آزمایشی/, "a published topic must render its title");
  assert.match(validTopicHtml, /<link rel="canonical" href="https:\/\/kunkurcomputer\.ir\/topics\/mock-topic"/, "a published topic must retain its canonical URL");

  for (const path of ["/articles/mock-article", "/guides/mock-guide"]) {
    const html = visibleMarkup(await (await fetch(`${baseUrl}${path}`)).text());
    assert.match(html, /href="\/subjects\/automata"/, "existing editorial subjects must remain linked when API taxonomy is empty");
  }
  for (const [collection, slug] of [["articles", "mock-reviewed-before-publish"], ["guides", "mock-guide"]]) {
    const xml = await (await fetch(`${baseUrl}/sitemaps/${collection}.xml`)).text();
    assert.match(xml, new RegExp(`<loc>${canonicalOrigin}/${collection}/${slug}</loc><lastmod>2026-09-16T00:00:00.000Z</lastmod>`), "sitemap lastmod must never use a review older than publication");
  }

  const datedBefore = await fetch(`${baseUrl}/articles/mock-reviewed-before-publish`);
  const datedBeforeHtml = await datedBefore.text();
  const beforeSchemas = [...datedBeforeHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
  const beforeArticle = beforeSchemas.find((item) => item["@type"] === "Article");
  const beforePage = beforeSchemas.find((item) => item["@type"] === "WebPage");
  assert.equal(beforeArticle?.datePublished, "2026-09-16T00:00:00.000Z");
  assert.ok(!("dateModified" in beforeArticle), "a review before publication must not be marked as a later modification");
  assert.ok(!("image" in beforeArticle), "the site logo must not be marked as the article's representative image");
  assert.ok(!("speakable" in beforePage), "Persian educational articles must not claim English-only speakable support");
  assert.doesNotMatch(datedBeforeHtml, /<meta property="article:modified_time"/, "OG modified time must not precede publication");

  const datedAfterHtml = await (await fetch(`${baseUrl}/articles/mock-reviewed-after-publish`)).text();
  const afterSchemas = [...datedAfterHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
  const afterArticle = afterSchemas.find((item) => item["@type"] === "Article");
  assert.equal(afterArticle?.dateModified, "2026-09-17T00:00:00.000Z", "a real post-publication review remains in Article schema");
  assert.match(datedAfterHtml, /<meta property="article:modified_time" content="2026-09-17T00:00:00.000Z"/, "OG must retain a genuine post-publication review date");

  const pendingHtml = await (await fetch(`${baseUrl}/guides/active-review`)).text();
  const pendingSchemas = [...pendingHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
  const pendingArticle = pendingSchemas.find((item) => item["@type"] === "Article");
  assert.equal(pendingArticle?.author?.["@type"], "Organization", "editorial attribution must not invent a personal author");
  assert.equal(pendingArticle.author.name, "تحریریه کنکور کامپیوتر");
  assert.ok(!("dateModified" in pendingArticle), "a pending human review must not become a modification date");
  assert.doesNotMatch(visibleMarkup(pendingHtml), / · بازبین: /, "a pending guide must not name a reviewer");
  assert.doesNotMatch(visibleMarkup(pendingHtml), /تهیه و بازبینی:/, "a pending guide must not claim the owner already reviewed it");

  const ownerHtml = await (await fetch(`${baseUrl}/guides/master-computer-engineering-1406`)).text();
  const ownerSchemas = [...ownerHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; });
  const ownerArticle = ownerSchemas.find((item) => item["@type"] === "Article");
  assert.equal(ownerArticle?.author?.["@type"], "Person");
  assert.equal(ownerArticle.author.name, "محمد رستمی", "an explicitly declared personal author must be retained");
  assert.match(visibleMarkup(ownerHtml), /نوشتهٔ/);
  assert.doesNotMatch(visibleMarkup(ownerHtml), /بازبین:/, "one writer is named, never a reviewer (owner, 2026-10-24)");

  for (const path of [
    "/articles/mock-unavailable",
    "/guides/mock-unavailable",
    "/courses/mock-unavailable",
    "/topics/mock-unavailable",
  ]) {
    const unavailable = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    const html = await unavailable.text();
    assert.equal(unavailable.status, 500, `${path} must not turn an upstream outage into a false 404`);
    assert.ok(
      !visibleMarkup(html).includes("این صفحه پیدا نشد"),
      `${path} must not render the not-found claim`,
    );
  }

  console.log(
    `Phase 18 routing tests passed (${serverMode}): status codes, article dates, source attribution, sitemaps and subject links verified.`,
  );
} finally {
  stopProcess(web);
  await new Promise((resolve) => api.close(resolve));
}
