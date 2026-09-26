import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The browser-side subject name list must match the editorial subjects
// exactly, in the same order, or admin tables would show stale names. Both
// are read as source text: CI's Node cannot import .ts files directly.
const editorial = await readFile(new URL("../src/content/editorial.ts", import.meta.url), "utf8");
const names = await readFile(new URL("../src/content/subject-names.ts", import.meta.url), "utf8");

/** The `{ slug|code: "…", title: "…" }` pairs inside one exported array literal. */
function pairs(source, arrayStart, key) {
  const start = source.indexOf(arrayStart);
  assert.ok(start >= 0, `missing ${arrayStart}`);
  const body = source.slice(start, source.indexOf("\n];", start));
  return [...body.matchAll(new RegExp(`${key}: "([^"]+)", title: "([^"]+)"`, "g"))].map((match) => ({ code: match[1], title: match[2] }));
}

const expected = pairs(editorial, "export const subjects: SubjectPage[] = [", "slug");
const actual = pairs(names, "export const SUBJECT_NAMES", "code");
assert.ok(expected.length > 10, "the editorial subject list should be found");
assert.deepEqual(actual, expected, "content/subject-names.ts must list exactly the subjects in content/editorial.ts");

console.log(`Subject name tests passed: ${actual.length} subjects match the editorial list.`);
