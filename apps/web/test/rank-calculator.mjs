import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// CI runs Node 20, which cannot import .ts directly; transpile the module the
// same way test/faq-schema.mjs does.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/lib/rank-model.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const lib = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const model = JSON.parse(await readFile(new URL("../src/content/rank-model-1277.json", import.meta.url), "utf8"));

// The file must stay aggregates only: no card-level fields anywhere.
const text = JSON.stringify(model);
for (const field of ["fingerprint", "card_id", "\"gpa\":", "\"language\":", "candidate", "name"]) {
  assert.ok(!text.includes(field), `model must not carry ${field}`);
}
for (const pair of model.admissions) assert.ok(pair.cards >= 10, `${pair.program} ${pair.university}: fewer than 10 cards`);
for (const year of model.years) assert.ok(year.cards >= 40, `${year.year} ${year.quota}: fewer than 40 cards`);

// Owner-confirmed weights: 1 network, 2 AI, 3 architecture, 4 software; each sums to 15.
assert.deepEqual(model.weights["1"], [1, 2, 2, 3, 3, 4]);
assert.deepEqual(model.weights["2"], [1, 2, 3, 4, 2, 3]);
assert.deepEqual(model.weights["3"], [1, 2, 2, 3, 4, 3]);
assert.deepEqual(model.weights["4"], [1, 2, 2, 4, 3, 3]);
assert.equal(lib.CODE_LABELS["2"].title, "هوش مصنوعی");
assert.equal(lib.weightedAverage(model, "4", [100, 100, 100, 100, 100, 100]), 100);
assert.equal(lib.weightedAverage(model, "2", [15, 0, 0, 0, 0, 0]), 1);

// Konkur percent: three wrong answers cancel one right one.
assert.equal(lib.percentFromAnswers(10, 0, 20), 50);
assert.equal(lib.percentFromAnswers(3, 9, 20), 0);
assert.ok(Math.abs(lib.percentFromAnswers(0, 20, 20) - lib.PERCENT_MIN) < 1e-9);

// Every curve is non-increasing: more percent never means a worse rank.
for (const year of model.years) {
  for (const [code, curve] of Object.entries(year.codes)) {
    for (let i = 1; i < curve.lnRank.length; i += 1) {
      assert.ok(curve.lnRank[i] <= curve.lnRank[i - 1] + 1e-9, `${year.year} ${year.quota} code ${code} rises at ${i}`);
    }
  }
}

const free1404 = model.years.find((year) => year.year === 1404 && year.quota === "free");
const mid = [56, 21, 30, 47, 42, 35];
const estimate = lib.estimateCode(model, free1404, "2", mid, 17.8);
assert.equal(estimate.edge, "inside");
assert.ok(estimate.low80 <= estimate.low50 && estimate.low50 <= estimate.rank && estimate.rank <= estimate.high50 && estimate.high50 <= estimate.high80);
// A better GPA and more percent both improve the rank.
assert.ok(lib.estimateCode(model, free1404, "2", mid, 19).rank < estimate.rank);
assert.ok(lib.rankWithMore(model, free1404, "2", mid, 17.8, 3, 10) < estimate.rank);
// Outside the data the edge is reported, not extrapolated.
assert.equal(lib.estimateCode(model, free1404, "2", [100, 100, 100, 100, 100, 100], 20).edge, "better");
assert.equal(lib.estimateCode(model, free1404, "2", [-30, -30, -30, -30, -30, -30], 10).edge, "worse");

// The page's claim: at a fixed average, 1404 gave a worse rank than every earlier year.
const at = (year, x) => {
  const curve = year.codes["2"];
  return Math.exp(curve.lnRank[Math.round((x - curve.start) / model.step)]);
};
for (const x of [15, 25, 35]) {
  for (const earlier of model.years.filter((year) => year.quota === "free" && year.year < 1404)) {
    assert.ok(at(free1404, x) > at(earlier, x), `1404 vs ${earlier.year} at ${x}`);
  }
}

// Admissions fit follows the admitted ranks.
const pair = { p25: 50, p75: 100, highestRecent: 140, median: 70 };
assert.equal(lib.admissionFit(pair, 40), "strong");
assert.equal(lib.admissionFit(pair, 90), "within");
assert.equal(lib.admissionFit(pair, 130), "edge");
assert.equal(lib.admissionFit(pair, 200), "far");

assert.equal(lib.roundRank(0.6), 1);
assert.equal(lib.roundRank(87.4), 87);
assert.equal(lib.roundRank(452), 450);
assert.equal(lib.roundRank(1234), 1230);

console.log("rank calculator: ok");
