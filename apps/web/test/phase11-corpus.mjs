import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpusUrl = new URL("../src/content/phase11-corpus.json", import.meta.url);
const corpus = JSON.parse(await readFile(corpusUrl, "utf8"));

const expectedGuideSlugs = [
  "master-computer-engineering-1406",
  "master-information-technology-1406",
  "master-computer-science-1406",
];

const expectedSubjectSlugs = [
  "english",
  "discrete-math",
  "statistics",
  "linear-algebra",
  "programming-fundamentals",
  "digital-logic",
  "computer-architecture",
  "data-structures-algorithms",
  "data-structures",
  "algorithms",
  "automata",
  "operating-systems",
  "artificial-intelligence",
  "computer-networks",
  "databases",
  "software-engineering",
  "it-management",
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function assertExactMembers(actual, expected, label) {
  assertUnique(actual, label);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label} must have the exact expected members`);
}

function assertNonEmpty(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

assertExactMembers(corpus.guideSlugs, expectedGuideSlugs, "guideSlugs");
assertExactMembers(Object.keys(corpus.tracks), expectedGuideSlugs, "tracks");
assertExactMembers(corpus.subjectSlugs, expectedSubjectSlugs, "subjectSlugs");
assertExactMembers(Object.keys(corpus.subjects), expectedSubjectSlugs, "subjects");

assertNonEmpty(corpus.officialSource?.url, "officialSource.url");
assert.match(corpus.officialSource.url, /^https:\/\/www\.sanjesh\.org\//, "the official source must be a Sanjesh URL");
assertNonEmpty(corpus.officialSource.checkedAt, "officialSource.checkedAt");

for (const [key, track] of Object.entries(corpus.tracks)) {
  assert.equal(track.guideSlug, key, `track key ${key} must equal guideSlug`);
  assertNonEmpty(track.collectionCode, `${key}.collectionCode`);
  assertNonEmpty(track.officialName, `${key}.officialName`);
  assertNonEmpty(track.quickAnswer, `${key}.quickAnswer`);
  assertNonEmpty(track.reviewedAt, `${key}.reviewedAt`);
  assert.ok(Array.isArray(track.bundles) && track.bundles.length > 0, `${key}.bundles must not be empty`);

  for (const bundle of track.bundles) {
    if (key === "master-computer-science-1406") {
      assert.deepEqual(
        Object.keys(bundle.coefficientsByCode ?? {}).sort(),
        ["1", "2"],
        `${key}/${bundle.key} must declare both official coefficient codes`,
      );
      assert.ok(Number.isInteger(bundle.coefficientsByCode["1"]), `${key}/${bundle.key} code 1 coefficient must be an integer`);
      assert.ok(Number.isInteger(bundle.coefficientsByCode["2"]), `${key}/${bundle.key} code 2 coefficient must be an integer`);
    } else {
      assert.ok(Number.isInteger(bundle.coefficient), `${key}/${bundle.key} must have an integer coefficient`);
    }
    assert.ok(Array.isArray(bundle.subjectSlugs), `${key}/${bundle.key}.subjectSlugs must be an array`);
    for (const slug of bundle.subjectSlugs) {
      assert.ok(expectedSubjectSlugs.includes(slug), `${key}/${bundle.key} refers to unknown subject ${slug}`);
    }
  }
}

for (const [key, subject] of Object.entries(corpus.subjects)) {
  assert.equal(subject.slug, key, `subject key ${key} must equal slug`);
  assertNonEmpty(subject.quickAnswer, `${key}.quickAnswer`);
  assertNonEmpty(subject.reviewedAt, `${key}.reviewedAt`);

  assert.ok(Array.isArray(subject.sources) && subject.sources.length > 0, `${key}.sources must not be empty`);
  for (const [index, source] of subject.sources.entries()) {
    assertNonEmpty(source.title, `${key}.sources[${index}].title`);
    assertNonEmpty(source.publisher, `${key}.sources[${index}].publisher`);
    assertNonEmpty(source.url, `${key}.sources[${index}].url`);
    assert.doesNotThrow(() => new URL(source.url), `${key}.sources[${index}].url must be absolute`);
    assertNonEmpty(source.checkedAt, `${key}.sources[${index}].checkedAt`);
  }

  assert.ok(
    Array.isArray(subject.learningPath) && subject.learningPath.length >= 3 && subject.learningPath.length <= 5,
    `${key}.learningPath must contain 3 to 5 steps`,
  );
  for (const [index, step] of subject.learningPath.entries()) {
    assertNonEmpty(step.title, `${key}.learningPath[${index}].title`);
    assertNonEmpty(step.detail, `${key}.learningPath[${index}].detail`);
  }

  assert.equal(subject.commonMistakes?.length, 3, `${key}.commonMistakes must contain exactly 3 items`);
  subject.commonMistakes.forEach((mistake, index) => assertNonEmpty(mistake, `${key}.commonMistakes[${index}]`));

  assertNonEmpty(subject.ctas?.internal?.label, `${key}.ctas.internal.label`);
  assert.match(subject.ctas.internal.href, /^\/(?!\/)/, `${key}.ctas.internal.href must be an internal path`);
  assertNonEmpty(subject.ctas?.resource?.label, `${key}.ctas.resource.label`);
  assert.match(subject.ctas.resource.href, /^\/(?!\/)/, `${key}.ctas.resource.href must be an internal path`);
  assert.equal(
    subject.ctas.resource.href,
    `/resources?subject=${key}`,
    `${key}.ctas.resource.href must target the supported subject filter`,
  );
}

function trackSubjectSlugs(guideSlug) {
  return corpus.tracks[guideSlug].bundles.flatMap((bundle) => bundle.subjectSlugs);
}

const combinedSlug = "data-structures-algorithms";
const splitSlugs = ["data-structures", "algorithms"];

for (const guideSlug of ["master-computer-engineering-1406", "master-information-technology-1406"]) {
  const slugs = trackSubjectSlugs(guideSlug);
  assert.ok(slugs.includes(combinedSlug), `${guideSlug} must use the unified data structures and algorithms subject`);
  for (const splitSlug of splitSlugs) {
    assert.ok(!slugs.includes(splitSlug), `${guideSlug} must not use the split ${splitSlug} subject`);
  }
}

const computerScienceSlugs = trackSubjectSlugs("master-computer-science-1406");
assert.ok(computerScienceSlugs.includes("data-structures"), "collection 1209 must include data-structures");
assert.ok(computerScienceSlugs.includes("algorithms"), "collection 1209 must include algorithms");
assert.ok(!computerScienceSlugs.includes(combinedSlug), "collection 1209 must not use the unified subject");

const computerScienceBundles = corpus.tracks["master-computer-science-1406"].bundles;
assert.deepEqual(
  computerScienceBundles.map((bundle) => bundle.coefficientsByCode?.["1"]),
  [2, 3, 4, 2, 2],
  "collection 1209 coefficient code 1 must match the official five-group matrix",
);
assert.deepEqual(
  computerScienceBundles.map((bundle) => bundle.coefficientsByCode?.["2"]),
  [2, 3, 4, 0, 4],
  "collection 1209 coefficient code 2 must match the official five-group matrix",
);

assert.equal(corpus.tracks["master-computer-engineering-1406"].collectionCode, "1277");
assert.equal(corpus.tracks["master-information-technology-1406"].collectionCode, "1276");
assert.equal(corpus.tracks["master-computer-science-1406"].collectionCode, "1209");

console.log("Phase 11 corpus tests passed: 3 guides and 17 subject hubs are internally consistent.");
