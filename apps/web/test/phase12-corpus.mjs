import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpusUrl = new URL("../src/content/phase12-corpus.json", import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, "utf8"));
const phase11 = JSON.parse(await readFile(new URL("../src/content/phase11-corpus.json", import.meta.url), "utf8"));

const expectedPlanningSlugs = [
  "start-from-zero",
  "twelve-month-study-plan",
  "six-month-study-plan",
  "three-month-study-plan",
  "working-candidate-study-plan",
  "switch-to-computer-science",
  "weekly-study-plan",
  "active-review",
  "error-log",
  "final-month-review",
  "exam-time-management",
  "choose-study-resources",
];

const expectedOfficialSlugs = [
  "master-exam-changes-1406",
  "master-computer-engineering-subjects-1406",
  "master-information-technology-subjects-1406",
  "master-computer-science-subjects-1406",
  "registration-calendar-1406",
  "official-notices-and-corrections",
  "historical-budget-computer-engineering",
  "historical-budget-information-technology",
  "historical-budget-computer-science",
  "booklets-and-answer-keys",
];

assert.deepEqual(corpus.planningPages.map((page) => page.slug), expectedPlanningSlugs);
assert.deepEqual(corpus.officialPages.map((page) => page.slug), expectedOfficialSlugs);

const pages = [...corpus.planningPages, ...corpus.officialPages];
const knownGuideSlugs = new Set([...expectedPlanningSlugs, ...expectedOfficialSlugs, ...phase11.guideSlugs]);
const knownSubjectSlugs = new Set(phase11.subjectSlugs);
const knownTopLevelPaths = new Set(["/corrections", "/courses", "/exams", "/resources", "/subjects", "/today"]);
assert.equal(pages.length, 22, "Phase 12 must contain exactly 22 guides");
assert.equal(new Set(pages.map((page) => page.slug)).size, pages.length, "guide slugs must be unique");
assert.equal(new Set(pages.map((page) => page.title)).size, pages.length, "guide titles must be unique");

for (const page of pages) {
  assert.match(page.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(page.title.length >= 20, `${page.slug} needs a useful title`);
  assert.ok(page.description.length >= 60, `${page.slug} needs a useful description`);
  assert.ok(page.quickAnswer.length >= 100, `${page.slug} needs an answer-first summary`);
  assert.ok(page.sections.length >= 3, `${page.slug} needs at least three content sections`);
  assert.ok(page.sourceIds.length > 0, `${page.slug} needs at least one source`);
  assert.ok(page.internalLinks.length >= 3, `${page.slug} needs at least three internal next steps`);
  for (const sourceId of page.sourceIds) {
    const source = corpus.sources[sourceId];
    assert.ok(source, `${page.slug} references unknown source ${sourceId}`);
    assert.match(source.url, /^https:\/\//, `${sourceId} must use a real HTTPS URL`);
    assert.ok(source.checkedAt, `${sourceId} must expose a review date`);
  }
  for (const link of page.internalLinks) {
    assert.match(link.href, /^\/(?!\/)/, `${page.slug} has a non-internal CTA`);
    assert.ok(link.title && link.label, `${page.slug} has an incomplete internal CTA`);
    const guideMatch = link.href.match(/^\/guides\/([^/?#]+)$/);
    const subjectMatch = link.href.match(/^\/subjects\/([^/?#]+)$/);
    if (guideMatch) assert.ok(knownGuideSlugs.has(guideMatch[1]), `${page.slug} links to unknown guide ${guideMatch[1]}`);
    else if (subjectMatch) assert.ok(knownSubjectSlugs.has(subjectMatch[1]), `${page.slug} links to unknown subject ${subjectMatch[1]}`);
    else assert.ok(knownTopLevelPaths.has(link.href), `${page.slug} links to an unknown public route ${link.href}`);
  }
  for (const record of page.historicalData ?? []) {
    assert.match(record.sourceUrl, /^https:\/\//, `${page.slug} historical rows require provenance`);
  }
}

assert.ok(corpus.planningPages.every((page) => page.kind === "PLANNING"));
assert.ok(corpus.officialPages.every((page) => page.kind === "OFFICIAL"));
assert.ok(
  corpus.officialPages.every((page) => page.sourceIds.some((sourceId) => corpus.sources[sourceId].publisher.includes("سنجش"))),
  "every official guide must point to a Sanjesh source",
);

const engineering = corpus.officialPages.find((page) => page.slug === "master-computer-engineering-subjects-1406");
const informationTechnology = corpus.officialPages.find((page) => page.slug === "master-information-technology-subjects-1406");
const computerScience = corpus.officialPages.find((page) => page.slug === "master-computer-science-subjects-1406");
const engineeringText = JSON.stringify(engineering);
const informationTechnologyText = JSON.stringify(informationTechnology);
const computerScienceText = JSON.stringify(computerScience);
assert.match(engineeringText, /داده‌ساختارها و الگوریتم‌ها/);
assert.match(informationTechnologyText, /داده‌ساختارها و الگوریتم‌ها/);
assert.match(computerScienceText, /ساختمان داده‌ها/);
assert.match(computerScienceText, /طراحی الگوریتم‌ها/);
assert.match(computerScienceText, /"۰"/, "coefficient code 2 must preserve the zero coefficient");

const historicalPages = corpus.officialPages.filter((page) => page.slug.startsWith("historical-budget-"));
assert.equal(historicalPages.length, 3);
assert.ok(
  historicalPages.every((page) => page.historicalData.length === 0 && /(پیش‌بینی|تضمین|قطعی)/.test(JSON.stringify(page))),
  "historical pages must not invent numeric rows before source-backed coding",
);

const calendar = corpus.officialPages.find((page) => page.slug === "registration-calendar-1406");
assert.match(JSON.stringify(calendar), /۳ تا ۹ آبان ۱۴۰۵/);
assert.match(JSON.stringify(calendar), /۱۶ تا ۲۲ آذر ۱۴۰۵/);
assert.match(JSON.stringify(calendar), /۱۶ و ۱۷ اردیبهشت ۱۴۰۶/);

console.log("Phase 12 corpus tests passed: 12 planning guides and 10 source-aware official guides were verified.");
