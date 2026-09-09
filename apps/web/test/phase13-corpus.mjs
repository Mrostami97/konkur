import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpus = JSON.parse(
  await readFile(new URL("../src/content/phase13-corpus.json", import.meta.url), "utf8"),
);
const phase11 = JSON.parse(
  await readFile(new URL("../src/content/phase11-corpus.json", import.meta.url), "utf8"),
);
const phase12 = JSON.parse(
  await readFile(new URL("../src/content/phase12-corpus.json", import.meta.url), "utf8"),
);
const generatedSeed = JSON.parse(
  await readFile(new URL("../../api/src/seed-data/editorial-drafts.json", import.meta.url), "utf8"),
);

const expectedDecisionSlugs = [
  "computer-it-cs-comparison",
  "computer-engineering-master-specializations",
  "information-technology-specializations-careers",
  "computer-science-specializations-research",
  "how-to-read-master-scorecard",
  "percent-rank-scenarios",
  "compare-computer-universities",
  "master-field-selection-guide",
];

const expectedCaseStudySlugs = [
  "case-study-automata-100-percent",
  "case-study-data-structures-10-of-11",
  "case-study-data-structures-9-correct",
  "case-study-course-alignment-9-of-12",
  "case-study-phd-16-of-19",
  "case-study-question-design-1401",
];

const expectedTelegramSources = {
  evidenceTheory100: "https://t.me/Konkur_answer/4666",
  evidenceData10: "https://t.me/Konkur_answer/3609",
  evidenceData9: "https://t.me/Konkur_answer/4767",
  evidenceTheoryStudents: "https://t.me/Konkur_answer/4751",
  evidencePhd: "https://t.me/Konkur_answer/4753",
  evidenceQuestionDesign: "https://t.me/Konkur_answer/3922",
};

const expectedEvidenceClaims = [
  {
    slug: "case-study-automata-100-percent",
    metric: "۱۰۰٪",
    sourceId: "evidenceTheory100",
    telegramUrl: "https://t.me/Konkur_answer/4666",
  },
  {
    slug: "case-study-data-structures-10-of-11",
    metric: "۱۰ از ۱۱",
    sourceId: "evidenceData10",
    telegramUrl: "https://t.me/Konkur_answer/3609",
  },
  {
    slug: "case-study-data-structures-9-correct",
    metric: "۹ تست صحیح",
    sourceId: "evidenceData9",
    telegramUrl: "https://t.me/Konkur_answer/4767",
  },
  {
    slug: "case-study-course-alignment-9-of-12",
    metric: "۹ از ۱۲",
    sourceId: "evidenceData9",
    telegramUrl: "https://t.me/Konkur_answer/4767",
  },
  {
    slug: "case-study-phd-16-of-19",
    metric: "۱۶ از ۱۹",
    sourceId: "evidencePhd",
    telegramUrl: "https://t.me/Konkur_answer/4753",
  },
  {
    slug: "case-study-question-design-1401",
    metric: "نمونهٔ سال ۱۴۰۱",
    sourceId: "evidenceQuestionDesign",
    telegramUrl: "https://t.me/Konkur_answer/3922",
  },
];

function assertNonEmpty(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

assert.deepEqual(corpus.decisionPages.map((page) => page.slug), expectedDecisionSlugs);
assert.deepEqual(corpus.caseStudies.map((page) => page.slug), expectedCaseStudySlugs);
assert.equal(corpus.decisionPages.length, 8, "Phase 13 must contain exactly 8 decision guides");
assert.equal(corpus.caseStudies.length, 6, "Phase 13 must contain exactly 6 evidence case studies");

const pages = [...corpus.decisionPages, ...corpus.caseStudies];
assert.equal(pages.length, 14, "Phase 13 editorial corpus must contain exactly 14 pages");
assertUnique(pages.map((page) => page.slug), "Phase 13 slugs");
assertUnique(pages.map((page) => page.title), "Phase 13 titles");
assert.ok(corpus.decisionPages.every((page) => page.kind === "DECISION"));
assert.ok(corpus.caseStudies.every((page) => page.kind === "CASE_STUDY"));

const telegramSources = Object.fromEntries(
  Object.entries(corpus.sources)
    .filter(([, source]) => source.url.startsWith("https://t.me/"))
    .map(([sourceId, source]) => [sourceId, source.url]),
);
assert.deepEqual(
  telegramSources,
  expectedTelegramSources,
  "the six supplied Telegram evidence sources and their original URLs must remain exact",
);

for (const [sourceId, source] of Object.entries(corpus.sources)) {
  assertNonEmpty(source.title, `${sourceId}.title`);
  assertNonEmpty(source.publisher, `${sourceId}.publisher`);
  assertNonEmpty(source.checkedAt, `${sourceId}.checkedAt`);
  assert.match(source.url, /^https:\/\//, `${sourceId}.url must be an HTTPS URL`);
  assert.doesNotThrow(() => new URL(source.url), `${sourceId}.url must be absolute`);
  assertNonEmpty(source.supportedClaim, `${sourceId}.supportedClaim`);
}

assert.equal(
  corpus.sources.cseCurriculum.url,
  "https://www.syllab.ir/_media/programs/grad-cse.pdf",
  "the master's-specialization guide must use the graduate CSE curriculum",
);
const exactThesisUrl = "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";
assert.equal(corpus.sources.thesis.title, "مسایل بهینه‌سازی شبکه روی منابع افرازشده");
assert.equal(corpus.sources.thesis.url, exactThesisUrl, "the supplied Sharif thesis URL must remain exact");

const knownGuideSlugs = new Set([
  ...phase11.guideSlugs,
  ...phase12.planningPages.map((page) => page.slug),
  ...phase12.officialPages.map((page) => page.slug),
  ...expectedDecisionSlugs,
  "phd-computer-engineering-1406",
]);
const knownSubjectSlugs = new Set(phase11.subjectSlugs);
const knownTopLevelPaths = new Set([
  "/about",
  "/admissions",
  "/choices",
  "/editorial-policy",
  "/evidence",
  "/rank-estimate",
  "/report-cards",
]);

for (const page of pages) {
  assert.match(page.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${page.slug} must be URL-safe`);
  assert.ok(page.title.length >= 20, `${page.slug} needs a useful title`);
  assert.ok(page.description.length >= 60, `${page.slug} needs a useful description`);
  assert.ok(page.quickAnswer.length >= 100, `${page.slug} needs a substantial answer-first summary`);
  assert.ok(Number.isInteger(page.readingMinutes) && page.readingMinutes > 0, `${page.slug} needs reading time`);
  assert.ok(Array.isArray(page.sections) && page.sections.length >= 3, `${page.slug} needs at least three sections`);
  assertUnique(page.sections.map((section) => section.title), `${page.slug} section titles`);

  for (const [index, section] of page.sections.entries()) {
    const label = `${page.slug}.sections[${index}]`;
    assertNonEmpty(section.title, `${label}.title`);
    const paragraphs = section.paragraphs ?? [];
    const bullets = section.bullets ?? [];
    const hasTable = Boolean(section.table);
    assert.ok(
      paragraphs.length > 0 || bullets.length > 0 || hasTable || Boolean(section.note?.trim()),
      `${label} must contain paragraphs, bullets, a table, or a note`,
    );
    paragraphs.forEach((paragraph, paragraphIndex) =>
      assertNonEmpty(paragraph, `${label}.paragraphs[${paragraphIndex}]`),
    );
    bullets.forEach((bullet, bulletIndex) => assertNonEmpty(bullet, `${label}.bullets[${bulletIndex}]`));
    if (section.table) {
      assert.ok(section.table.headers.length >= 2, `${label}.table needs at least two columns`);
      assert.ok(section.table.rows.length > 0, `${label}.table needs at least one row`);
      section.table.headers.forEach((header, headerIndex) => assertNonEmpty(header, `${label}.table.headers[${headerIndex}]`));
      for (const [rowIndex, row] of section.table.rows.entries()) {
        assert.equal(row.length, section.table.headers.length, `${label}.table.rows[${rowIndex}] has the wrong width`);
        row.forEach((cell, cellIndex) => assertNonEmpty(cell, `${label}.table.rows[${rowIndex}][${cellIndex}]`));
      }
    }
  }

  assert.ok(Array.isArray(page.sourceIds) && page.sourceIds.length > 0, `${page.slug} needs a source`);
  assertUnique(page.sourceIds, `${page.slug} sourceIds`);
  for (const sourceId of page.sourceIds) {
    assert.ok(corpus.sources[sourceId], `${page.slug} references unknown source ${sourceId}`);
  }

  assert.ok(page.internalLinks.length >= 3, `${page.slug} needs at least three related internal links`);
  assertUnique(page.internalLinks.map((link) => link.href), `${page.slug} internal links`);
  for (const [index, link] of page.internalLinks.entries()) {
    const label = `${page.slug}.internalLinks[${index}]`;
    assert.match(link.href, /^\/(?!\/)/, `${label}.href must be an internal path`);
    assertNonEmpty(link.title, `${label}.title`);
    assertNonEmpty(link.label, `${label}.label`);
    assertNonEmpty(link.description, `${label}.description`);
    const guideMatch = link.href.match(/^\/guides\/([^/?#]+)$/);
    const subjectMatch = link.href.match(/^\/subjects\/([^/?#]+)$/);
    if (guideMatch) assert.ok(knownGuideSlugs.has(guideMatch[1]), `${page.slug} links to unknown guide ${guideMatch[1]}`);
    else if (subjectMatch) assert.ok(knownSubjectSlugs.has(subjectMatch[1]), `${page.slug} links to unknown subject ${subjectMatch[1]}`);
    else assert.ok(knownTopLevelPaths.has(link.href), `${page.slug} links to unknown public route ${link.href}`);
  }
}

const actualEvidenceClaims = corpus.caseStudies.map((page) => {
  assert.equal(page.sourceIds.length, 1, `${page.slug} must make its evidence claim against one unambiguous source`);
  const sourceId = page.sourceIds[0];
  return { slug: page.slug, metric: page.metric, sourceId, telegramUrl: corpus.sources[sourceId]?.url };
});
assert.deepEqual(
  actualEvidenceClaims,
  expectedEvidenceClaims,
  "the six case-study claims must retain their exact metric and Telegram evidence URL",
);
assert.deepEqual(
  corpus.caseStudies.map((page) => page.examYear),
  [1405, 1405, 1405, 1405, 1405, 1401],
  "historical case studies must retain their actual exam year",
);

const limitationLanguage = /(?:فقط.{0,40}نمونه|نمی‌توان|چیزی ثابت نمی‌کند|کافی نیست|تضمین|پیش‌بینی|تعمیم|ادعای عمومی|اطلاعات کامل.{0,30}نیست)/;
for (const page of corpus.caseStudies) {
  assert.match(
    `${page.description} ${page.quickAnswer} ${JSON.stringify(page.sections)}`,
    limitationLanguage,
    `${page.slug} must state the limits of its single-case evidence`,
  );
}

const allCopy = JSON.stringify(pages);
assert.doesNotMatch(allCopy, /(?:قبولی|نتیجه) را تضمین می‌کن(?:د|یم)|تضمین صددرصد|حتماً قبول/,
  "Phase 13 must not promise admission or results");

const generatedPhase13 = generatedSeed.articles.filter((article) =>
  article.provenance.source_artifact.startsWith("apps/web/src/content/phase13-corpus.json:"),
);
assert.equal(generatedPhase13.length, 14, "the seed must contain all 14 Phase 13 Drafts");
assert.equal(generatedPhase13.filter((article) => article.content_type === "guide").length, 8);
assert.equal(generatedPhase13.filter((article) => article.content_type === "case_study").length, 6);
for (const article of generatedPhase13) {
  assert.equal(article.review_status, "draft", `${article.slug} must not bypass human publication review`);
  assert.equal(article.provenance.producer_type, "external_ai", `${article.slug} must retain honest provenance`);
  assert.ok(article.sources.length > 0, `${article.slug} needs a generated source link`);
  article.sources.forEach((source, index) => assertNonEmpty(source.claim, `${article.slug}.sources[${index}].claim`));
}

for (const article of generatedPhase13.filter((item) => item.content_type === "case_study")) {
  assert.match(JSON.stringify(article.content_blocks), /افشای تعارض منافع/,
    `${article.slug} must disclose the first-party commercial interest`);
  assert.match(JSON.stringify(article.content_blocks), /رضایت صریح/,
    `${article.slug} must state the consent gate`);
  const expectedYear = article.slug.endsWith("1401") ? 1401 : 1405;
  assert.equal(article.validity.exam_year, expectedYear, `${article.slug} must preserve its historical year`);
}

const phase13SourceIds = new Set(generatedPhase13.flatMap((article) =>
  article.sources.map((source) => source.source_external_id),
));
for (const source of generatedSeed.sources.filter((item) => phase13SourceIds.has(item.externalId))) {
  assert.equal(source.rightsBasis, "LINK_ONLY", `${source.externalId} must not infer reuse rights from publication ownership`);
  assert.equal(source.mayAdapt, false, `${source.externalId} must not permit adaptation without recorded rights`);
  assert.equal(source.commercialUseAllowed, false, `${source.externalId} must not infer commercial reuse rights`);
}

console.log("Phase 13 corpus tests passed: 8 decision guides, 6 bounded evidence claims, sources and internal links were verified.");
