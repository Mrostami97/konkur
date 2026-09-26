import assert from "node:assert/strict";

// The browser-side subject name list must match the editorial subjects
// exactly, in the same order, or admin tables would show stale names.
const { subjects } = await import("../src/content/editorial.ts");
const { SUBJECT_NAMES } = await import("../src/content/subject-names.ts");

assert.deepEqual(
  SUBJECT_NAMES.map((subject) => ({ code: subject.code, title: subject.title })),
  subjects.map((subject) => ({ code: subject.slug, title: subject.title })),
  "content/subject-names.ts must list exactly the subjects in content/editorial.ts",
);

console.log(`Subject name tests passed: ${SUBJECT_NAMES.length} subjects match the editorial list.`);
