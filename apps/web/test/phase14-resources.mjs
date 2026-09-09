import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(
  await readFile(new URL("../src/content/phase14-resource-corpus.json", import.meta.url), "utf8"),
);
const generated = JSON.parse(
  await readFile(new URL("../../api/src/seed-data/resource-drafts.json", import.meta.url), "utf8"),
);

const expectedResourceUrls = [
  "https://t.me/konkurcom/138",
  "https://t.me/Konkur_answer/4014",
  "https://t.me/Konkur_answer/4050",
  "https://t.me/Konkur_answer/4049",
  "https://t.me/Konkur_answer/4544",
  "https://t.me/Konkur_answer/4976",
  "https://t.me/Konkur_answer/4978",
  "https://t.me/Konkur_answer/4979",
];
const forbiddenResultUrls = new Set([
  "https://t.me/Konkur_answer/4666",
  "https://t.me/Konkur_answer/3609",
  "https://t.me/Konkur_answer/4767",
  "https://t.me/Konkur_answer/4751",
  "https://t.me/Konkur_answer/4753",
  "https://t.me/Konkur_answer/3922",
]);
const heldUrls = [
  "https://t.me/Konkur_answer/4980",
  "https://t.me/Konkur_answer/4981",
  "https://t.me/Konkur_answer/4986",
];
const allowedCatalogKeys = new Set([
  "learningType",
  "startLevel",
  "coverage",
  "volume",
  "sampleLabel",
  "costLabel",
  "relatedGuideSlugs",
]);
const knownGuides = new Set(["choose-study-resources", "start-from-zero"]);

assert.equal(corpus.schemaVersion, "phase14.resource-corpus.v1");
assert.deepEqual(corpus.officialChannel, { handle: "@konkurcom", url: "https://t.me/konkurcom" });
assert.equal(corpus.resources.length, 8, "only the eight reviewed educational candidates may become Drafts");
assert.equal(Object.keys(corpus.sources).length, 8, "every Draft must have one exact source record");
assert.deepEqual(corpus.resources.map((item) => item.externalUrl), expectedResourceUrls);
assert.deepEqual(corpus.heldForReview.map((item) => item.url), heldUrls);

const seenSlugs = new Set();
for (const resource of corpus.resources) {
  assert.match(resource.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(!seenSlugs.has(resource.slug), `duplicate resource slug ${resource.slug}`);
  seenSlugs.add(resource.slug);
  const source = corpus.sources[resource.sourceId];
  assert.ok(source, `${resource.slug} must reference a known source`);
  assert.equal(resource.externalUrl, source.canonicalUrl, `${resource.slug} must preserve the exact original URL`);
  assert.equal(resource.kind, "TELEGRAM_POST", `${resource.slug} must not guess an unverified physical media kind`);
  assert.equal(resource.accessMode, "PUBLIC");
  assert.equal(resource.hostingMode, "EXTERNAL_LINK");
  assert.ok(resource.metadata.catalog.learningType, `${resource.slug} needs its pedagogical type`);
  assert.ok(resource.metadata.catalog.coverage, `${resource.slug} needs a bounded coverage label`);
  assert.deepEqual(
    Object.keys(resource.metadata.catalog).sort(),
    [...allowedCatalogKeys].sort(),
    `${resource.slug} catalog metadata must stay on the public allowlist`,
  );
  for (const slug of resource.metadata.catalog.relatedGuideSlugs) {
    assert.ok(knownGuides.has(slug), `${resource.slug} links to unknown guide ${slug}`);
  }
  assert.ok(!forbiddenResultUrls.has(resource.externalUrl), `${resource.slug} must not turn a result claim into a learning resource`);
  assert.ok(!heldUrls.includes(resource.externalUrl), `${resource.slug} must not publish a held-for-review URL`);
}

for (const source of Object.values(corpus.sources)) {
  assert.equal(source.rightsBasis, "LINK_ONLY");
  assert.equal(source.mayLink, true);
  for (const right of ["mayEmbed", "mayQuote", "mayReproduce", "mayAdapt", "mayTranslate", "mayHost", "commercialUseAllowed"]) {
    assert.equal(source[right], false, `${source.externalId}.${right} must stay disabled`);
  }
  assert.match(source.canonicalUrl, /^https:\/\/t\.me\//);
  if (source.canonicalUrl.includes("/Konkur_answer/")) {
    assert.equal(source.publisher, "آرشیو پیشین متعلق به محمد رستمی");
    assert.equal(source.metadata.channelRole, "LEGACY_EVIDENCE");
    assert.doesNotMatch(source.publisher, /کانال رسمی/);
  } else {
    assert.equal(source.metadata.channelRole, "OFFICIAL");
    assert.match(source.publisher, /@konkurcom/);
  }
}

assert.equal(generated.schemaVersion, "resource-seed.v1");
assert.equal(generated.generatedFrom, "apps/web/src/content/phase14-resource-corpus.json");
assert.equal(generated.resources.length, corpus.resources.length);
assert.deepEqual(generated.resources.map((item) => item.slug), corpus.resources.map((item) => item.slug));
for (const resource of generated.resources) {
  assert.equal(resource.reviewStatus, "DRAFT", `${resource.slug} must not bypass human review`);
  assert.equal(resource.provenance.producer_type, "external_ai", `${resource.slug} must retain honest provenance`);
  assert.equal(resource.externalUrl, generated.sources.find((source) => source.externalId === resource.sourceExternalId)?.canonicalUrl);
  assert.equal(resource.sourceArtifactId, undefined, `${resource.slug} must not seed a hosted artifact`);
}

console.log("Phase 14 resource corpus tests passed: 8 link-only Drafts, exact provenance, rights and taxonomy were verified.");
