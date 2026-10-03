import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// No patched npm release exists as of 2026-10-03. This is a reviewed local
// backport of upstream PR #72, not an audit exception or a renamed package.
// Only the depth fix is backported; unrelated changes since npm 3.0.3 are omitted.
export const bracesRemediation = Object.freeze({
  advisoryId: "GHSA-vfj7-8cjw-p6xm", version: "3.0.3", severity: "high",
  source: "https://github.com/micromatch/braces/pull/72",
  upstreamCommit: "d0d575e55e74a4e0218e5248fafb79efc3e54ebb",
  expiresOn: "2026-11-01",
  patchPath: "patches/braces@3.0.3.patch",
  patchSha256: "37f95f7d660c05bfd44d4b429ca49ceeede99dcff68389f81ee9b995a8ea24d2",
  lockHash: "oul7lxlbdwgx6xtwkfbomsujje",
});
const fileHashes = Object.freeze({
  "index.js": "332ea07c7b006361aad12aa994ca75dc1db8e8382b884909e2f38f10b85c88a4",
  "lib/compile.js": "b651f7715e6db8942ce61d3394357b4d81c8ece88240aa31a458ea1165edd195",
  "lib/constants.js": "f9fb688959232eee3e6ad7906a5b0e3234815db49ee857ef86983d65b917dc7c",
  "lib/expand.js": "2974d5b8763a358d81dfa5b4b804329f525239f34429c396b93a540219504809",
  "lib/parse.js": "ef9b3851f848460daaf91ff248222a43e266f97c4f2df7010cb7858e1e39a107",
  "lib/stringify.js": "645f13c68af685148e9fe8eca449ee2ebb88eee0f27de7b2125fbfc175b1584d",
  "lib/utils.js": "b5a7596aa67730412b3c029ef09e84e6b67b8e445cffd35d1d295549c89066c7",
});
const consumers = ["micromatch@4.0.8", "chokidar@3.6.0"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function requireValid(condition, message) { if (!condition) throw new Error(message); }
function nestedAst(depth) {
  let node = { type: "text", value: "a" };
  for (let index = 0; index < depth; index++) node = { type: "brace", nodes: [node] };
  return { type: "root", nodes: [node] };
}
function verifyDepthBehavior(braces) {
  const bounded = /exceeds max depth/;
  // Character-bounded real exploit payload, parser bypass through AST APIs,
  // and attempts to relax maxDepth all require the deliberate depth error.
  for (const depth of [101, 4500]) {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      const input = open.repeat(depth) + "a,b" + close.repeat(depth);
      for (const operation of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => operation(input), bounded);
        assert.throws(() => operation(input, { maxDepth: 1000000 }), bounded);
      }
    }
    for (const operation of [braces.compile, braces.expand, braces.stringify]) assert.throws(() => operation(nestedAst(depth)), bounded);
  }
  const boundary = "{".repeat(100) + "a" + "}".repeat(100);
  for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) assert.doesNotThrow(() => operation(boundary));
  assert.deepEqual(braces.expand("foo/{a,b}/bar"), ["foo/a/bar", "foo/b/bar"]);
  assert.equal(braces.compile("{1..3}"), "([1-3])");
}

export async function verifyBracesRemediation(root) {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    requireValid(manifest.pnpm?.patchedDependencies?.["braces@3.0.3"] === bracesRemediation.patchPath, "braces patch declaration is missing or changed");
    const patch = await readFile(path.join(root, bracesRemediation.patchPath));
    requireValid(digest(patch) === bracesRemediation.patchSha256, "braces patch SHA256 differs from the reviewed backport");
    const lock = (await readFile(path.join(root, "pnpm-lock.yaml"), "utf8")).replaceAll("\r\n", "\n");
    const declaration = `patchedDependencies:\n  braces@3.0.3:\n    hash: ${bracesRemediation.lockHash}\n    path: ${bracesRemediation.patchPath}\n`;
    requireValid(lock.includes(declaration), "braces lockfile patch identity is missing or changed");
    const snapshots = lock.split("\nsnapshots:\n")[1];
    requireValid(typeof snapshots === "string", "lockfile dependency snapshots are missing");
    const identities = [...snapshots.matchAll(/^  braces@([^:]+):$/gm)].map((match) => match[1]);
    requireValid(identities.length === 1 && identities[0] === `3.0.3(patch_hash=${bracesRemediation.lockHash})`, "lockfile contains an unreviewed braces snapshot");
    const references = [...snapshots.matchAll(/^      braces: (.+)$/gm)].map((match) => match[1]);
    requireValid(references.length === 2 && references.every((value) => value === identities[0]), "lockfile contains an unreviewed or unpatched braces consumer");
    const checkedDirectories = new Set();
    for (const consumer of consumers) {
      const consumerName = consumer.split("@")[0];
      const consumerRequire = createRequire(path.join(root, "node_modules", ".pnpm", consumer, "node_modules", consumerName, "index.js"));
      const entry = await realpath(consumerRequire.resolve("braces"));
      const normalized = entry.replaceAll("\\", "/");
      requireValid(normalized.endsWith(`/braces@3.0.3_patch_hash=${bracesRemediation.lockHash}/node_modules/braces/index.js`), "active braces consumer resolves outside the reviewed patched snapshot");
      const directory = path.dirname(entry);
      if (checkedDirectories.has(directory)) continue;
      checkedDirectories.add(directory);
      const installed = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      requireValid(installed.name === "braces" && installed.version === bracesRemediation.version, "installed braces package identity differs from the reviewed version");
      for (const [file, hash] of Object.entries(fileHashes)) requireValid(digest(await readFile(path.join(directory, file))) === hash, `installed braces ${file} SHA256 differs from the reviewed code`);
      verifyDepthBehavior(consumerRequire("braces"));
    }
    return { verified: true, ...bracesRemediation, failures: [] };
  } catch (error) {
    return { verified: false, ...bracesRemediation, failures: [error.message] };
  }
}

export function isReviewedBracesFinding(record) {
  return record.github_advisory_id === bracesRemediation.advisoryId && record.module_name === "braces" && record.severity === "high"
    && record.findings.every((finding) => finding.version === "3.0.3" && finding.paths.every((value) => {
      const parts = value.replaceAll("\\", "/").split(" > ");
      return ["apps/api", "apps/web", "contracts"].includes(parts[0]) && parts.at(-1) === "braces@3.0.3" && ["micromatch@4.0.8", "chokidar@3.6.0"].includes(parts.at(-2));
    }));
}
