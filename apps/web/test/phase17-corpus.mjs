import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(await readFile(new URL("../src/content/phase17-corpus.json", import.meta.url), "utf8"));
const phase11 = JSON.parse(await readFile(new URL("../src/content/phase11-corpus.json", import.meta.url), "utf8"));
const staticSeed = JSON.parse(await readFile(new URL("../../api/src/seed-data/editorial-drafts.json", import.meta.url), "utf8"));
const legacyPhase17Drafts = JSON.parse(await readFile(new URL("../../api/src/seed-data/phase17-legacy-editorial-drafts.json", import.meta.url), "utf8"));
const legacyEditorial = await readFile(new URL("../src/content/editorial.ts", import.meta.url), "utf8");

const expectedSlugs = [
  "phd-computer-engineering-1406",
  "phd-information-technology-1406",
  "phd-computer-science-1406",
  "phd-computer-engineering-subjects-1406",
  "phd-information-technology-subjects-1406",
  "phd-computer-science-subjects-1406",
  "phd-computer-architecture-study-guide",
  "phd-software-algorithms-study-guide",
  "phd-artificial-intelligence-study-guide",
  "phd-networks-secure-computing-study-guide",
  "phd-information-technology-study-guide",
  "phd-computer-science-research-path",
  "phd-written-exam-study-plan",
  "phd-english-study-guide",
  "phd-research-cv-guide",
  "phd-interview-preparation",
];

const expectedStages = [
  "BOTH", "BOTH", "BOTH",
  "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN", "WRITTEN",
  "POST_WRITTEN", "POST_WRITTEN",
];
const knownSubjectSlugs = new Set(phase11.subjectSlugs);
const knownTopLevelPaths = new Set(["/corrections", "/exams", "/today"]);

const sourceExternalId = (source) => "editorial-source-" + createHash("sha256")
  .update([source.publisher, source.title, source.url].join("\n"))
  .digest("hex")
  .slice(0, 20);
const stableJson = (value) => JSON.stringify(stableValue(value));
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

assert.equal(corpus.phase, 17);
assert.equal(corpus.publicationStatus, "DRAFT");
assert.equal(corpus.humanReviewRequired, true);
assert.equal(corpus.preparedAt, "۱۴۰۵/۰۶/۲۲");
assert.equal(corpus.officialSnapshot.sourceId, "sanjeshPhd1406");
assert.match(corpus.officialSnapshot.warning, /دفترچهٔ ثبت‌نام.*اصلاحیه/);
assert.deepEqual(corpus.pages.map((page) => page.slug), expectedSlugs);
assert.deepEqual(corpus.pages.map((page) => page.stage), expectedStages);
assert.deepEqual(corpus.pages.map((page) => page.phaseItemId), expectedSlugs.map((_, index) => `P17-${String(index + 1).padStart(2, "0")}`));
assert.deepEqual(corpus.pages.map((page) => page.sequence), expectedSlugs.map((_, index) => index + 1));
assert.equal(new Set(corpus.pages.map((page) => page.title)).size, 16, "Phase 17 titles must be unique");

const sanjeshSource = corpus.sources.sanjeshPhd1406;
assert.equal(sanjeshSource.url, "https://sanjesh.org/_sanjesh/documents/1406/regphd1406.pdf");
assert.equal(sanjeshSource.checkedAt, "۲۲ شهریور ۱۴۰۵");
assert.match(sanjeshSource.supportedClaim, /۲۳۵۴.*۲۳۵۸.*ضریب ۱.*ضریب ۵/);
assert.ok(corpus.sources.graduateAdmissionsLaw.publisher.includes("سامانه ملی قوانین"));

for (const page of corpus.pages) {
  assert.equal(page.degree, "دکتری", `${page.slug} must remain in the PhD taxonomy`);
  assert.equal(page.examYear, 1406, `${page.slug} must declare the target exam year`);
  assert.match(page.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(page.title.length >= 20, `${page.slug} needs a useful title`);
  assert.ok(page.description.length >= 60, `${page.slug} needs a useful description`);
  assert.ok(page.quickAnswer.length >= 100, `${page.slug} needs an answer-first summary`);
  assert.ok(page.sections.length >= 3, `${page.slug} needs at least three sections`);
  assert.ok(page.sourceIds.length > 0, `${page.slug} needs provenance`);
  assert.ok(page.internalLinks.length >= 3, `${page.slug} needs at least three next steps`);
  for (const subjectCode of page.relatedSubjectCodes) {
    assert.ok(knownSubjectSlugs.has(subjectCode), `${page.slug} references unknown subject ${subjectCode}`);
  }
  for (const sourceId of page.sourceIds) {
    const source = corpus.sources[sourceId];
    assert.ok(source, `${page.slug} references unknown source ${sourceId}`);
    assert.match(source.url, /^https:\/\//, `${sourceId} must use HTTPS`);
    assert.ok(source.checkedAt && source.supportedClaim, `${sourceId} needs a checked date and supported claim`);
  }
  for (const link of page.internalLinks) {
    assert.match(link.href, /^\/(?!\/)/, `${page.slug} has a non-internal CTA`);
    assert.ok(link.title && link.label, `${page.slug} has an incomplete CTA`);
    const guideMatch = link.href.match(/^\/guides\/([^/?#]+)$/);
    const subjectMatch = link.href.match(/^\/subjects\/([^/?#]+)$/);
    if (guideMatch) assert.ok(expectedSlugs.includes(guideMatch[1]), `${page.slug} links to unknown Phase 17 guide ${guideMatch[1]}`);
    else if (subjectMatch) assert.ok(knownSubjectSlugs.has(subjectMatch[1]), `${page.slug} links to unknown subject ${subjectMatch[1]}`);
    else assert.ok(knownTopLevelPaths.has(link.href), `${page.slug} links to an unknown public route ${link.href}`);
  }
}

const engineeringOfficial = corpus.pages.find((page) => page.phaseItemId === "P17-04");
const itOfficial = corpus.pages.find((page) => page.phaseItemId === "P17-05");
const scienceOfficial = corpus.pages.find((page) => page.phaseItemId === "P17-06");
assert.equal(engineeringOfficial.officialSetCode, "2354");
assert.equal(itOfficial.officialSetCode, "2358");
assert.equal(scienceOfficial.officialSetCode, "2354");
for (const page of [engineeringOfficial, itOfficial, scienceOfficial]) {
  assert.match(JSON.stringify(page), /ضریب ۱/);
  assert.match(JSON.stringify(page), /ضریب ۵/);
  assert.ok(page.sourceIds.includes("sanjeshPhd1406"));
}
assert.match(JSON.stringify(engineeringOfficial), /مبانی کامپیوتر و برنامه‌سازی/);
assert.match(JSON.stringify(engineeringOfficial), /مدارهای منطقی/);
assert.match(JSON.stringify(itOfficial), /شبکه‌های کامپیوتری/);
assert.match(JSON.stringify(itOfficial), /طراحی پایگاه داده‌ها/);
assert.doesNotMatch(JSON.stringify(itOfficial.sections[0].table), /مهندسی اطلاعات|خدمات IT/);
assert.match(JSON.stringify(itOfficial.sections.slice(1)), /نباید به جدول آزمون کتبی افزوده شوند/);
assert.match(JSON.stringify(scienceOfficial), /مجموعهٔ رسمی جداگانه|مجموعهٔ رسمی تازه‌ای نمی‌سازد/);
assert.match(JSON.stringify(corpus.pages.find((page) => page.phaseItemId === "P17-10")), /امنیت شبکه.*عنوان جداگانه ندارد/);

const fullCorpusText = JSON.stringify(corpus);
assert.doesNotMatch(fullCorpusText, /"author"\s*:\s*"محمد رستمی"/, "AI-assisted drafts cannot claim human authorship");
assert.match(JSON.stringify(corpus.pages.slice(14)), /مرحلهٔ پس از آزمون کتبی|پس از آزمون کتبی/);

for (const slug of expectedSlugs.slice(0, 3)) {
  assert.doesNotMatch(legacyEditorial, new RegExp(`slug:\\s*["']${slug}["']`), `${slug} must not leak through the public static fallback`);
}

assert.deepEqual(legacyPhase17Drafts.articles.map((article) => article.slug), expectedSlugs.slice(0, 3));
assert.deepEqual(
  legacyPhase17Drafts.articles.map((article) => createHash("sha256").update(stableJson(article)).digest("hex")),
  [
    "732579a71237b82052a1840308c6803e96494e92f870d8c2dc6641584d774a31",
    "3338ff361baf36ed57587907fb83a0f3945f2a7f4b9fe5dcfc016a911a67db59",
    "70997c7217882f9f17fa76662e2e51aeea56ea6221ff9ade4957f24f2604fd33",
  ],
  "legacy guards must remain byte-semantically equal to the Phase 16 seed payloads",
);

const seededPhase17 = staticSeed.articles.filter((article) =>
  article.provenance.source_artifact.startsWith("apps/web/src/content/phase17-corpus.json:"),
);
assert.equal(seededPhase17.length, 16, "all Phase 17 pages must enter the review workflow");
assert.deepEqual(seededPhase17.map((article) => article.slug), expectedSlugs);
for (const [index, article] of seededPhase17.entries()) {
  const page = corpus.pages[index];
  assert.equal(article.content_type, "guide");
  assert.equal(article.review_status, "draft");
  assert.equal(article.provenance.producer_type, "external_ai");
  assert.deepEqual(article.taxonomy.degrees, ["phd"]);
  assert.deepEqual(article.taxonomy.subject_codes, page.relatedSubjectCodes);
  assert.equal(article.validity.exam_year, 1406);
  assert.equal(article.validity.time_sensitive, true);
  assert.equal(article.validity.source_checked_at, "2026-09-13T00:00:00.000Z");
  assert.ok(article.validity.review_due_at);
  assert.deepEqual(
    article.sources.map((source) => source.source_external_id),
    page.sourceIds.map((sourceId) => sourceExternalId(corpus.sources[sourceId])),
  );
}

console.log("Phase 17 corpus tests passed: 16 source-backed PhD drafts and the written/interview boundary were verified.");
