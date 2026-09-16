import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const webDirectory = fileURLToPath(new URL("..", import.meta.url));
const canonicalOrigin = "https://kunkur01.ir";

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
    subjectCodes: [],
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

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
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
  if (path === "/articles/mock-guide") {
    response.end(JSON.stringify(article("mock-guide", "GUIDE")));
    return;
  }
  if (path === "/articles/mock-article") {
    response.end(JSON.stringify(article("mock-article", "ARTICLE")));
    return;
  }
  if (path === "/subjects" || path === "/topics") {
    response.end("[]");
    return;
  }
  if (path === "/articles/mock-unavailable" || path === "/courses/mock-unavailable") {
    response.statusCode = 503;
    response.end(JSON.stringify({ statusCode: 503, message: "Service Unavailable" }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ statusCode: 404, message: "Not Found" }));
});

const apiPort = await listen(api);
const webPort = await freePort();
const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const commandArguments = isWindows
  ? ["/d", "/s", "/c", `pnpm exec next dev --hostname 127.0.0.1 --port ${webPort}`]
  : ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(webPort)];
const nextEnvironment = { ...process.env };
delete nextEnvironment.NEXT_PUBLIC_API_URL;
let output = "";
const web = spawn(
  command,
  commandArguments,
  {
    cwd: webDirectory,
    env: {
      ...nextEnvironment,
      INTERNAL_API_URL: `http://127.0.0.1:${apiPort}`,
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

  for (const path of [
    "/articles/slug-does-not-exist",
    "/guides/slug-does-not-exist",
    "/courses/slug-does-not-exist",
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

  for (const path of [
    "/articles/mock-unavailable",
    "/guides/mock-unavailable",
    "/courses/mock-unavailable",
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
    "Phase 18 routing tests passed: same-origin API, hard 404 pages, permanent redirects, and outage handling are verified.",
  );
} finally {
  stopProcess(web);
  await new Promise((resolve) => api.close(resolve));
}
