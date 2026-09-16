import { readFile } from "node:fs/promises";

const site = new URL(process.env.SITE_URL ?? "https://kunkur01.ir");
const siteOrigin = site.origin;
const fetchOrigin = new URL(process.env.SITE_FETCH_URL ?? siteOrigin).origin;
const key = (await readFile(new URL("../apps/web/public/indexnow-key.txt", import.meta.url), "utf8")).trim();
const keyLocation = new URL("/indexnow-key.txt", siteOrigin).href;
const endpoint = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");

if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
  throw new Error("The IndexNow key must contain 8-128 letters, numbers, or dashes.");
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function locations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeXml(match[1]));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "kunkur01-indexnow/1.0" } });
  if (!response.ok) throw new Error(`Unable to read ${url}: HTTP ${response.status}`);
  return response.text();
}

const sitemapIndexUrl = new URL("/sitemap.xml", fetchOrigin).href;
const sitemapIndex = await fetchText(sitemapIndexUrl);
const sitemapUrls = locations(sitemapIndex);
if (sitemapUrls.length === 0) throw new Error(`No child sitemaps found in ${sitemapIndexUrl}`);

const discovered = new Set([new URL("/", siteOrigin).href]);
for (const sitemapUrl of sitemapUrls) {
  const parsedSitemap = new URL(sitemapUrl);
  if (parsedSitemap.origin !== siteOrigin) {
    throw new Error(`Refusing a cross-origin sitemap URL: ${sitemapUrl}`);
  }
  const sitemapFetchUrl = new URL(`${parsedSitemap.pathname}${parsedSitemap.search}`, fetchOrigin).href;
  for (const location of locations(await fetchText(sitemapFetchUrl))) {
    const parsed = new URL(location);
    if (parsed.origin === siteOrigin) discovered.add(parsed.href);
  }
}

const urlList = [...discovered].slice(0, 10_000);
if (dryRun) {
  console.log(`IndexNow dry run: ${urlList.length} canonical URLs discovered for ${site.host}.`);
} else {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: site.host,
      key,
      keyLocation,
      urlList,
    }),
  });

  if (![200, 202].includes(response.status)) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`IndexNow rejected the submission: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
  }

  console.log(`IndexNow accepted ${urlList.length} URLs for ${site.host} with HTTP ${response.status}.`);
}
