import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = await readFile(new URL("../src/lib/telegram-links.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const lib = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

assert.equal(lib.startParamPath("budget"), "/budget");
assert.equal(lib.startParamPath("Keys"), "/articles/master-computer-answer-keys");
assert.equal(lib.startParamPath("articles--konkur-1405-computer-engineering-solutions"), "/articles/konkur-1405-computer-engineering-solutions");
assert.equal(lib.startParamPath("questions--1277"), "/questions/1277");
for (const bad of [null, "", "unknown", "--budget", "a---b", "a--", "x--y_z", "a--b-", "http:--evil.com"]) {
  assert.equal(lib.startParamPath(bad), null, String(bad));
}
// Every page a link names stays a same-site path.
for (const path of Object.values(lib.START_PARAM_PAGES)) assert.match(path, /^\/[a-z0-9/-]+$/);
// Building and reading a link round-trip, and use the short name when there is one.
assert.equal(lib.pathStartParam("/budget"), "budget");
assert.equal(lib.pathStartParam("/articles/hashing-tests/"), "articles--hashing-tests");
for (const path of ["/budget", "/articles/hashing-tests", "/report-cards/1404"]) {
  assert.equal(lib.startParamPath(lib.pathStartParam(path)), path);
}
console.log("telegram-links: ok");
