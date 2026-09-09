import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "apps/web/src/content/phase14-resource-corpus.json");
const outputPath = resolve(projectRoot, "apps/api/src/seed-data/resource-drafts.json");
const corpus = JSON.parse(await readFile(sourcePath, "utf8"));

if (corpus.schemaVersion !== "phase14.resource-corpus.v1") throw new Error("Unsupported Phase 14 corpus schema");
if (corpus.officialChannel?.handle !== "@konkurcom" || corpus.officialChannel?.url !== "https://t.me/konkurcom") {
  throw new Error("The only official channel must be @konkurcom");
}

const sourceEntries = Object.entries(corpus.sources);
const sourceIds = new Set();
const sourceUrls = new Set();
for (const [key, source] of sourceEntries) {
  if (!source.externalId || sourceIds.has(source.externalId)) throw new Error(`Duplicate or missing source externalId: ${key}`);
  if (!source.canonicalUrl?.startsWith("https://t.me/")) throw new Error(`Phase 14 source must be an exact Telegram URL: ${key}`);
  if (sourceUrls.has(source.canonicalUrl)) throw new Error(`Duplicate source URL: ${source.canonicalUrl}`);
  if (source.rightsBasis !== "LINK_ONLY" || source.mayLink !== true) throw new Error(`Source must be link-only with mayLink: ${key}`);
  for (const right of ["mayEmbed", "mayQuote", "mayReproduce", "mayAdapt", "mayTranslate", "mayHost", "commercialUseAllowed"]) {
    if (source[right] !== false) throw new Error(`Unsafe right ${right} on ${key}`);
  }
  sourceIds.add(source.externalId);
  sourceUrls.add(source.canonicalUrl);
}

const heldUrls = new Set(corpus.heldForReview.map((item) => item.url));
const resourceSlugs = new Set();
const resources = corpus.resources.map((resource) => {
  const source = corpus.sources[resource.sourceId];
  if (!source) throw new Error(`Unknown source ${resource.sourceId} for ${resource.slug}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.slug) || resourceSlugs.has(resource.slug)) {
    throw new Error(`Invalid or duplicate resource slug: ${resource.slug}`);
  }
  if (resource.kind !== "TELEGRAM_POST" || resource.accessMode !== "PUBLIC" || resource.hostingMode !== "EXTERNAL_LINK") {
    throw new Error(`Phase 14 archive item must remain a public external Telegram post: ${resource.slug}`);
  }
  if (resource.externalUrl !== source.canonicalUrl) throw new Error(`Resource/source URL mismatch: ${resource.slug}`);
  if (heldUrls.has(resource.externalUrl)) throw new Error(`Held URL cannot become a resource: ${resource.externalUrl}`);
  if (!resource.metadata?.catalog?.learningType) throw new Error(`Missing learning type: ${resource.slug}`);
  resourceSlugs.add(resource.slug);
  return {
    ...resource,
    sourceExternalId: source.externalId,
    reviewStatus: "DRAFT",
    provenance: {
      producer_type: "external_ai",
      producer_name: "kunkur01 Phase 14 assisted draft",
      source_artifact: `apps/web/src/content/phase14-resource-corpus.json:${resource.slug}`
    }
  };
});

if (resources.length !== 8) throw new Error(`Expected exactly 8 reviewed candidates, got ${resources.length}`);

const output = {
  schemaVersion: "resource-seed.v1",
  generatedFrom: "apps/web/src/content/phase14-resource-corpus.json",
  generatedAt: corpus.reviewedAt,
  sources: sourceEntries.map(([, source]) => source),
  resources
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Generated ${resources.length} Phase 14 Resource Drafts at ${outputPath}`);
