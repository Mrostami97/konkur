import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkAudit, guardFailures, loadFeatureState, parseAudit } from "../check-security-audit.mjs";

const policy = JSON.parse(await readFile(new URL("../security-audit-exceptions.json", import.meta.url), "utf8"));
const now = new Date("2026-10-06T12:00:00Z");
const cleanState = {
  minioVersion: "8.0.7",
  sources: [{ path: "apps/api/src/modules/ingestion/object-storage.service.ts", text: 'import { Client } from "minio"; class Storage { get() { return this.client.getObject("bucket", "key"); } }' }],
};
function audit(records = []) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const record of records) counts[record.severity]++;
  return { advisories: Object.fromEntries(records.map((record, index) => [index + 1, record])), metadata: { totalDependencies: 100, vulnerabilities: counts } };
}
const paths = {
  "file-type": "apps/api > @nestjs/common@10.4.22 > file-type@20.4.1",
  "@nestjs/core": "apps/api > @nestjs/core@10.4.22",
  "decode-uri-component": "apps/api > minio@8.0.7 > query-string@7.1.3 > decode-uri-component@0.2.2",
  "stream-json": "apps/api > minio@8.0.7 > stream-json@1.9.1",
  deepmerge: "contracts > jest@29.7.0 > jest-cli@29.7.0 > jest-config@29.7.0 > deepmerge@4.3.1",
};
function record(exception = policy.exceptions[0], changes = {}) {
  return { github_advisory_id: exception.advisoryId, module_name: exception.moduleName, severity: exception.severity, findings: [{ version: exception.versions[0], paths: [paths[exception.moduleName]] }], ...changes };
}
function check(feed, changes = {}, nextPolicy = policy) {
  return checkAudit(feed, nextPolicy, { now, auditStatus: Object.keys(feed.advisories).length ? 1 : 0, featureState: cleanState, ...changes });
}

test("accepts a clean full audit and the eight exact reviewed unused-feature exceptions", () => {
  assert.equal(check(audit()).passed, true);
  const result = check(audit(policy.exceptions.map((exception) => record(exception))));
  assert.equal(result.passed, true);
  assert.equal(result.accepted.length, 8);
});
test("deepmerge is accepted only through build and test tooling and only while application code does not import it", () => {
  const exception = policy.exceptions.find((item) => item.moduleName === "deepmerge");
  assert.equal(check(audit([record(exception)])).passed, true);
  const runtime = record(exception, { findings: [{ version: "4.3.1", paths: ["apps/api > some-runtime@1.0.0 > deepmerge@4.3.1"] }] });
  assert.equal(check(audit([runtime])).passed, false);
  const imported = { ...cleanState, sources: [...cleanState.sources, { path: "apps/api/src/x.ts", text: 'import merge from "deepmerge";' }] };
  assert.equal(check(audit([record(exception)]), { featureState: imported }).passed, false);
});
test("unknown advisories fail at every severity, including low and info", () => {
  for (const severity of ["info", "low", "moderate", "high", "critical"]) {
    const result = check(audit([record(undefined, { github_advisory_id: "GHSA-aaaa-bbbb-cccc", severity })]));
    assert.equal(result.passed, false);
    assert.match(result.failures[0], /unreviewed/);
  }
});
test("an exception cannot mask changed severity, package, version or a new dependency consumer", () => {
  for (const changes of [
    { severity: "high" }, { module_name: "other-module" },
    { findings: [{ version: "20.4.2", paths: [paths["file-type"]] }] },
    { findings: [{ version: "20.4.1", paths: ["apps/api > new-parser@1.0.0 > file-type@20.4.1"] }] },
  ]) assert.equal(check(audit([record(undefined, changes)])).passed, false);
});
test("Windows dependency path separators normalize without broadening allowed consumers", () => {
  const known = record(undefined, { findings: [{ version: "20.4.1", paths: [paths["file-type"].replace("apps/api", "apps\\api")] }] });
  assert.equal(check(audit([known])).passed, true);
});
test("exceptions expire at the start of the stated day and cannot be permanent", () => {
  assert.equal(check(audit([record()]), { now: new Date("2026-11-01T00:00:00Z") }).passed, false);
  const permanent = structuredClone(policy);
  permanent.exceptions[0].expiresOn = "2027-10-02";
  assert.throws(() => check(audit([record()]), {}, permanent), /31 days/);
});
test("empty, non-JSON, partial, inconsistent and failed audit results fail closed", () => {
  for (const text of ["", " ", "registry is unavailable", "{", "{} {}"] ) assert.throws(() => parseAudit(text));
  assert.throws(() => checkAudit({}, policy, { now, auditStatus: 1, featureState: cleanState }), /required result fields/);
  assert.throws(() => check(audit([record()]), { auditStatus: 2 }), /Audit command failed/);
  assert.throws(() => check(audit([record()]), { auditStatus: 0 }), /status does not match/);
  const mismatch = audit([record()]); mismatch.metadata.vulnerabilities.moderate = 0;
  assert.throws(() => check(mismatch), /totals do not match/);
  const invalid = audit([record()]); invalid.advisories[1].findings = [];
  assert.throws(() => check(invalid), /valid affected dependency paths/);
  const failed = audit(); failed.error = { code: "ECONNRESET" };
  assert.throws(() => check(failed), /reports an error/);
  const empty = audit(); empty.metadata.totalDependencies = 0;
  assert.throws(() => check(empty), /did not inspect/);
});
test("invalid, duplicated or unsupported policy entries cannot become broad exceptions", () => {
  for (const mutate of [
    (next) => next.exceptions.push(structuredClone(next.exceptions[0])),
    (next) => { next.exceptions[0].versions = ["*"]; },
    (next) => { next.exceptions[0].guard = "anything"; },
    (next) => { next.exceptions[0].severity = "high"; },
    (next) => { next.exceptions[0].expiresOn = "2026-02-30"; },
    (next) => { next.reviewedOn = "2026-10-07"; },
  ]) { const next = structuredClone(policy); mutate(next); assert.throws(() => check(audit([record()]), {}, next)); }
});
test("new file sniffing, SSE, decoder and stream operations invalidate their exceptions", () => {
  const cases = [
    ["unused-file-type", 'import { FileTypeValidator } from "@nestjs/common";'],
    ["unused-file-type", 'const parser = await import("file-type");'],
    ["unused-sse", "@Sse('events') events() {}"],
    ["unused-sse", 'res.setHeader("Content-Type", "text/event-stream");'],
    ["unused-minio-decoder", 'import query from "query-string";'],
    ["unused-stream-json-filters", 'import Pick from "stream-json/filters/Pick.js";'],
    ["unused-stream-json-filters", "client.listenBucketNotification('bucket');"],
  ];
  for (const [guard, text] of cases) {
    const state = structuredClone(cleanState);
    state.sources.push({ path: "apps/api/src/new-feature.ts", text });
    assert.ok(guardFailures(guard, state).length > 0, text);
  }
});
test("MinIO exceptions reject SDK drift, missing wrappers, new callsites and dynamic SDK methods", () => {
  for (const guard of ["unused-minio-decoder", "unused-stream-json-filters"]) {
    const states = [
      { ...cleanState, minioVersion: "8.0.8" },
      { ...cleanState, sources: [{ path: "apps/api/src/other.ts", text: "export {};" }] },
      { ...cleanState, sources: [...cleanState.sources, { path: "apps/api/src/other.ts", text: 'import { Client } from "minio";' }] },
      { ...cleanState, sources: [{ ...cleanState.sources[0], text: "this.client[operation](...args);" }] },
      { ...cleanState, sources: [{ ...cleanState.sources[0], text: "this.client.listenBucketNotification('bucket');" }] },
    ];
    for (const state of states) assert.ok(guardFailures(guard, state).length > 0);
  }
  assert.throws(() => check(audit([record()]), { featureState: { sources: [] } }), /inspection is unavailable/);
});
test("UTF-8 BOM is supported without tolerating trailing output", () => {
  assert.deepEqual(parseAudit(`\uFEFF${JSON.stringify(audit())}`), audit());
  assert.throws(() => parseAudit(`${JSON.stringify(audit())}\nregistry warning`), /not valid JSON/);
});

const locallyPatchedBraces = {
  github_advisory_id: "GHSA-vfj7-8cjw-p6xm", module_name: "braces", severity: "high",
  findings: [{ version: "3.0.3", paths: ["apps/api > @nestjs/cli@10.4.9 > chokidar@3.6.0 > braces@3.0.3", "contracts > jest@29.7.0 > micromatch@4.0.8 > braces@3.0.3"] }],
};
test("a high advisory remains visible and requires verified local remediation", async () => {
  assert.equal(check(audit([locallyPatchedBraces])).passed, false);
  const state = await loadFeatureState();
  const result = check(audit([locallyPatchedBraces]), { featureState: state });
  assert.equal(result.passed, true);
  assert.equal(result.advisories, 1);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.remediated.length, 1);
  assert.equal(result.remediated[0].severity, "high");
  assert.equal(result.remediated[0].advisoryId, locallyPatchedBraces.github_advisory_id);
  for (const changes of [
    { github_advisory_id: "GHSA-aaaa-bbbb-cccc" }, { severity: "critical" }, { module_name: "other" },
    { findings: [{ version: "3.0.4", paths: locallyPatchedBraces.findings[0].paths }] },
    { findings: [{ version: "3.0.3", paths: ["apps/api > new-parser@1.0.0 > braces@3.0.3"] }] },
  ]) assert.equal(check(audit([{ ...locallyPatchedBraces, ...changes }]), { featureState: state }).passed, false);
  assert.equal(check(audit([locallyPatchedBraces]), { featureState: { ...state, bracesRemediation: { verified: false, failures: ["missing patch"] } } }).passed, false);
  assert.equal(check(audit([locallyPatchedBraces]), { featureState: state, now: new Date("2026-11-01T00:00:00Z") }).passed, false);
});
