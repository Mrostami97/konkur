// Pulls articles that were edited on the live site back into the repo, so a later
// build never reverts the owner's edits: node sync-live.mjs <slug> [slug ...]
// Writes live-overrides/<slug>.json (text, SEO, taxonomy and sources as published).
// build.mjs lays the override over articles/<slug>.mjs. Sources are matched to their
// ContentSource external id by canonical URL or title; if one cannot be matched the
// override is marked importable:false and bundle-safe.mjs leaves the article out.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SITE = process.env.SITE_URL || "https://kunkurcomputer.ir";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const seed = JSON.parse(readFileSync(`${repo}apps/api/src/seed-data/editorial-drafts.json`, "utf8"));
const byUrl = new Map(seed.sources.map((s) => [s.canonicalUrl, s.externalId]));
const byTitle = new Map(seed.sources.map((s) => [s.title, s.externalId]));
mkdirSync("live-overrides", { recursive: true });

for (const slug of process.argv.slice(2)) {
  let live = null;
  for (const base of ["articles", "guides"]) {
    const r = await fetch(`${SITE}/api/${base}/${slug}?v=${Date.now()}`);
    if (r.ok) { live = await r.json(); break; }
  }
  if (!live) { console.error(slug, "not found on the site"); process.exitCode = 1; continue; }
  const unmatched = [];
  const sources = (live.sources || []).map((link, i) => {
    const id = byUrl.get(link.source.canonicalUrl) ?? byTitle.get(link.source.title);
    if (!id) unmatched.push(link.source.title);
    return { source_external_id: id ?? null, relation: link.relation, locator: link.locator, claim: link.claim, order: link.order ?? i };
  });
  const override = {
    slug,
    fetchedAt: new Date().toISOString(),
    liveVersion: live.version,
    importable: unmatched.length === 0,
    unmatchedSources: unmatched,
    title: live.title,
    summary: live.summary,
    quick_answer: live.quickAnswer,
    seo: { title: live.seoTitle, description: live.seoDescription },
    content_blocks: live.contentBlocks,
    taxonomy: { major: live.taxonomyMajor, tags: live.taxonomyTags, degrees: live.taxonomyDegrees, fields: live.taxonomyFields, subject_codes: live.subjectCodes, topic_codes: live.topicCodes },
    sources,
  };
  writeFileSync(`live-overrides/${slug}.json`, JSON.stringify(override, null, 1));
  console.log(slug, `v${live.version}`, unmatched.length ? `UNMATCHED SOURCES: ${unmatched.join(" | ")}` : "ok");
}
