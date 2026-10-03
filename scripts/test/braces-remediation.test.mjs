import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { bracesRemediation, verifyBracesRemediation } from "../check-braces-remediation.mjs";

const require = createRequire(new URL("../../node_modules/.pnpm/micromatch@4.0.8/node_modules/micromatch/index.js", import.meta.url));
const braces = require("braces");
const micromatch = require("micromatch");
function ast(depth) {
  let node = { type: "text", value: "a" };
  for (let i = 0; i < depth; i++) node = { type: "brace", nodes: [node] };
  return { type: "root", nodes: [node] };
}
const exceedsDepth = /exceeds max depth/;

test("deep string inputs reject at a safe bound in all brace APIs", () => {
  for (const depth of [101, 4500]) {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      const input = open.repeat(depth) + "a,b" + close.repeat(depth);
      for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => operation(input), exceedsDepth);
        assert.throws(() => operation(input, { maxDepth: 1000000 }), exceedsDepth);
      }
    }
  }
});
test("direct ASTs and cyclic ASTs cannot bypass the depth bound", () => {
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    for (const depth of [101, 4500]) assert.throws(() => operation(ast(depth)), exceedsDepth);
    const cyclic = { type: "root", nodes: [] }; cyclic.nodes.push(cyclic);
    assert.throws(() => operation(cyclic), exceedsDepth);
  }
});
test("boundary, stricter limits, escapes and ordinary glob consumers remain usable", () => {
  const boundary = "{".repeat(100) + "a" + "}".repeat(100);
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) assert.doesNotThrow(() => operation(boundary));
  assert.throws(() => braces.parse("{{a,b},c}", { maxDepth: 1 }), exceedsDepth);
  assert.doesNotThrow(() => braces.parse("{{a,b},c}", { maxDepth: 2 }));
  assert.deepEqual(braces.expand("foo/{a,b}/bar"), ["foo/a/bar", "foo/b/bar"]);
  assert.equal(braces.compile("{1..3}"), "([1-3])");
  assert.equal(braces.stringify("foo/{a,b}/bar"), "foo/{a,b}/bar");
  assert.deepEqual(braces.expand("\\{literal\\}"), ["{literal}"]);
  assert.deepEqual(micromatch.braces("foo/{a,b}/bar", { expand: true }), ["foo/a/bar", "foo/b/bar"]);
  assert.deepEqual(micromatch(["a.test.ts", "a.ts", "b.spec.ts", "x.js"], "*.{test,spec}.ts"), ["a.test.ts", "b.spec.ts"]);
});

test("patch, declaration, snapshot, installed version and code tampering fail closed", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const tempPrefix = path.resolve(tmpdir(), "konkur-braces-proof-");
  const fixture = await mkdtemp(tempPrefix);
  // The fixture has its own patch and installed braces files; only the benign
  // fill-range dependency points at the existing install. Production files are untouched.
  try {
    for (const file of ["package.json", "pnpm-lock.yaml", bracesRemediation.patchPath]) {
      await mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
      await copyFile(path.join(root, file), path.join(fixture, file));
    }
    const store = path.join(fixture, "node_modules", ".pnpm", `braces@3.0.3_patch_hash=${bracesRemediation.lockHash}`, "node_modules");
    const ownBraces = path.join(store, "braces");
    await cp(path.dirname(require.resolve("braces")), ownBraces, { recursive: true });
    const bracesRequire = createRequire(require.resolve("braces"));
    await symlink(path.dirname(bracesRequire.resolve("fill-range/package.json")), path.join(store, "fill-range"), "junction");
    for (const consumer of ["micromatch@4.0.8", "chokidar@3.6.0"]) {
      const consumerModules = path.join(fixture, "node_modules", ".pnpm", consumer, "node_modules");
      await mkdir(path.join(consumerModules, consumer.split("@")[0]), { recursive: true });
      await writeFile(path.join(consumerModules, consumer.split("@")[0], "index.js"), "");
      await symlink(ownBraces, path.join(consumerModules, "braces"), "junction");
    }
    assert.equal((await verifyBracesRemediation(fixture)).verified, true);
    const mutations = [
      [bracesRemediation.patchPath, (text) => text + "\n", /patch SHA256/],
      ["package.json", (text) => { const manifest = JSON.parse(text); delete manifest.pnpm.patchedDependencies; return JSON.stringify(manifest); }, /declaration/],
      ["pnpm-lock.yaml", (text) => text.replace(`braces@3.0.3(patch_hash=${bracesRemediation.lockHash}):`, "braces@3.0.3:"), /snapshot/],
      [path.relative(fixture, path.join(ownBraces, "package.json")), (text) => text.replace('"version": "3.0.3"', '"version": "3.0.4"'), /identity/],
      [path.relative(fixture, path.join(ownBraces, "lib", "parse.js")), (text) => text + "\n// unreviewed change\n", /SHA256/],
    ];
    for (const [file, change, expected] of mutations) {
      const target = path.join(fixture, file); const original = await readFile(target, "utf8");
      await writeFile(target, change(original));
      const result = await verifyBracesRemediation(fixture);
      assert.equal(result.verified, false, file);
      assert.match(result.failures.join("; "), expected, file);
      await writeFile(target, original);
    }
    await rm(path.join(fixture, bracesRemediation.patchPath));
    assert.equal((await verifyBracesRemediation(fixture)).verified, false);
  } finally {
    assert.ok(path.resolve(fixture).startsWith(tempPrefix), "cleanup remains inside the dedicated fixture prefix");
    await rm(fixture, { recursive: true, force: true });
  }
});
