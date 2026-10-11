import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bracesRemediation, isReviewedBracesFinding, verifyBracesRemediation } from "./check-braces-remediation.mjs";

const severityLevels = ["info", "low", "moderate", "high", "critical"];
const advisoryPattern = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
const guards = new Set(["unused-file-type", "unused-sse", "unused-minio-decoder", "unused-stream-json-filters"]);
const storageFile = "apps/api/src/modules/ingestion/object-storage.service.ts";
// listObjects (full backup) was reviewed against 8.0.7: it builds its query with its own uriEscape and
// parses XML with fast-xml-parser, so neither query-string decoding nor stream-json is reached.
const storageMethods = new Set(["bucketExists", "makeBucket", "putObject", "fPutObject", "getPartialObject", "statObject", "removeObject", "getObject", "listObjects"]);
const reviewedNestPackages = new Set(["@nestjs/common@10.4.22", "@nestjs/core@10.4.22", "@nestjs/platform-express@10.4.22", "@nestjs/schedule@4.1.2", "@nestjs/throttler@6.5.0", "@nestjs/testing@10.4.22"]);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}
export function parseAudit(text) {
  requireValid(typeof text === "string" && text.trim().length > 0, "Audit output is empty");
  try { return JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("Audit output is not valid JSON"); }
}
function day(value) {
  requireValid(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), "Exception date must use YYYY-MM-DD");
  const date = Date.parse(`${value}T00:00:00.000Z`);
  requireValid(Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value, "Exception date is invalid");
  return date;
}
function reviewExceptions(policy, now) {
  requireValid(object(policy) && policy.schemaVersion === 1 && Array.isArray(policy.exceptions), "Exception policy schema is invalid");
  const reviewed = day(policy.reviewedOn);
  requireValid(reviewed <= now.getTime(), "Exception review date is in the future");
  const entries = new Map();
  for (const exception of policy.exceptions) {
    requireValid(object(exception) && advisoryPattern.test(exception.advisoryId ?? ""), "Exception advisory ID is invalid");
    requireValid(!entries.has(exception.advisoryId), "Duplicate exception advisory ID");
    requireValid(typeof exception.moduleName === "string" && exception.moduleName.length > 0 && exception.severity === "moderate", "Only explicit moderate dependency exceptions are supported");
    requireValid(Array.isArray(exception.versions) && exception.versions.length > 0 && exception.versions.every((version) => typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)), "Exception versions must be explicit stable versions");
    requireValid(guards.has(exception.guard), "Exception feature guard is unknown");
    requireValid(typeof exception.reason === "string" && exception.reason.length >= 60 && typeof exception.source === "string" && exception.source.startsWith("https://github.com/"), "Exception needs a reason and primary advisory reference");
    const expires = day(exception.expiresOn);
    requireValid(expires > reviewed && expires - reviewed <= 31 * 86400000, "Exception review window exceeds 31 days");
    entries.set(exception.advisoryId, { ...exception, expires });
  }
  return entries;
}
function reviewedDependencyPath(moduleName, value) {
  const parts = value.replaceAll("\\", "/").split(" > ");
  if (parts.shift() !== "apps/api") return false;
  if (moduleName === "file-type") return parts.pop() === "file-type@20.4.1" && parts.length > 0 && parts.every((part) => reviewedNestPackages.has(part));
  if (moduleName === "@nestjs/core") return parts.pop() === "@nestjs/core@10.4.22" && parts.every((part) => reviewedNestPackages.has(part));
  if (moduleName === "decode-uri-component") return parts.join(" > ") === "minio@8.0.7 > query-string@7.1.3 > decode-uri-component@0.2.2";
  if (moduleName === "stream-json") return parts.join(" > ") === "minio@8.0.7 > stream-json@1.9.1";
  return false;
}

export async function loadFeatureState(root = repoRoot) {
  const sources = [];
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      requireValid(!entry.isSymbolicLink(), "Source symlinks require an explicit security review");
      if (entry.isDirectory()) await scan(file);
      else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) sources.push({ path: path.relative(root, file).replaceAll("\\", "/"), text: await readFile(file, "utf8") });
    }
  }
  for (const directory of ["apps/api/src", "apps/web/src", "contracts/src"]) await scan(path.join(root, directory));
  const require = createRequire(path.join(root, "apps/api/package.json"));
  const minioVersion = require("minio/package.json").version;
  return { sources, minioVersion, bracesRemediation: await verifyBracesRemediation(root) };
}
export function guardFailures(guard, state) {
  requireValid(object(state) && Array.isArray(state.sources) && state.sources.length > 0, "Feature inspection is unavailable");
  requireValid(state.sources.every((source) => object(source) && typeof source.path === "string" && typeof source.text === "string"), "Feature source data is malformed");
  const failures = [];
  const imports = (packages) => new RegExp(`["'](?:${packages.join("|")})(?:/[^"']*)?["']`);
  for (const source of state.sources) {
    const text = source.text;
    if (guard === "unused-file-type" && (/\b(?:FileTypeValidator|fileTypeFromBuffer|fileTypeFromStream|fileTypeStream)\b/.test(text) || imports(["file-type"]).test(text))) failures.push(`${source.path}: file-type parser or validator use requires a patched-library review`);
    if (guard === "unused-sse" && /\b(?:Sse|SseStream|EventSource)\b|text\/event-stream/.test(text)) failures.push(`${source.path}: SSE use invalidates the Nest exception`);
    if (guard === "unused-minio-decoder" && imports(["query-string", "decode-uri-component"]).test(text)) failures.push(`${source.path}: direct decoder/query-string use invalidates the exception`);
    if (guard === "unused-stream-json-filters" && (imports(["stream-json"]).test(text) || /\blistenBucketNotification\b/.test(text))) failures.push(`${source.path}: JSON stream or notification use requires a patched-library review`);
    if (guard.startsWith("unused-minio") || guard === "unused-stream-json-filters") {
      if (imports(["minio"]).test(text) && source.path !== storageFile) failures.push(`${source.path}: new MinIO callsite requires a dependency review`);
    }
  }
  if (guard.startsWith("unused-minio") || guard === "unused-stream-json-filters") {
    if (state.minioVersion !== "8.0.7") failures.push("MinIO version differs from the reviewed 8.0.7 SDK");
    const storage = state.sources.find((source) => source.path === storageFile);
    if (!storage) failures.push("Reviewed MinIO storage wrapper is missing");
    else {
      if (/this\.client\s*\[/.test(storage.text)) failures.push("Computed MinIO method dispatch requires a dependency review");
      for (const match of storage.text.matchAll(/this\.client\s*\.\s*(\w+)\s*\(/g)) {
        if (!storageMethods.has(match[1])) failures.push(`MinIO method ${match[1]} is outside the reviewed storage operations`);
      }
    }
  }
  return failures;
}

export function checkAudit(feed, policy, { auditStatus, now = new Date(), featureState } = {}) {
  requireValid(now instanceof Date && Number.isFinite(now.getTime()), "Current time is unavailable");
  requireValid(auditStatus === 0 || auditStatus === 1, "Audit command failed before a valid advisory result");
  requireValid(object(feed) && !Object.hasOwn(feed, "error") && object(feed.advisories) && object(feed.metadata) && object(feed.metadata.vulnerabilities), "Audit feed is missing required result fields or reports an error");
  requireValid(Number.isInteger(feed.metadata.totalDependencies) && feed.metadata.totalDependencies > 0, "Audit feed did not inspect dependencies");
  const counts = Object.fromEntries(severityLevels.map((severity) => [severity, 0]));
  const records = Object.values(feed.advisories);
  for (const record of records) {
    requireValid(object(record) && advisoryPattern.test(record.github_advisory_id ?? "") && typeof record.module_name === "string" && record.module_name.length > 0 && severityLevels.includes(record.severity), "Audit contains a malformed advisory");
    requireValid(Array.isArray(record.findings) && record.findings.length > 0 && record.findings.every((finding) => object(finding) && typeof finding.version === "string" && finding.version.length > 0 && Array.isArray(finding.paths) && finding.paths.length > 0 && finding.paths.every((value) => typeof value === "string" && value.length > 0)), "Audit advisory has no valid affected dependency paths");
    counts[record.severity]++;
  }
  for (const severity of severityLevels) requireValid(Number.isInteger(feed.metadata.vulnerabilities[severity]) && feed.metadata.vulnerabilities[severity] === counts[severity], "Audit severity totals do not match advisory records");
  requireValid(auditStatus === (records.length > 0 ? 1 : 0), "Audit command status does not match the reported advisories");
  const exceptions = reviewExceptions(policy, now);
  const failures = [];
  const accepted = [];
  const remediated = [];
  const patchProof = featureState?.bracesRemediation;
  if (patchProof && patchProof.verified !== true) failures.push(`Local braces remediation could not be verified: ${(patchProof.failures ?? []).join("; ")}`);
  const checkedGuards = new Map();
  for (const record of records) {
    const id = record.github_advisory_id;
    if (id === bracesRemediation.advisoryId) {
      if (!isReviewedBracesFinding(record) || patchProof?.verified !== true || patchProof.patchSha256 !== bracesRemediation.patchSha256 || now.getTime() >= day(bracesRemediation.expiresOn)) {
        failures.push(`${id}: high advisory requires the exact verified local patch, reviewed consumer paths and an unexpired review`);
      } else remediated.push({ advisoryId: id, severity: record.severity, source: bracesRemediation.source, expiresOn: bracesRemediation.expiresOn });
      continue;
    }
    const exception = exceptions.get(id);
    if (!exception) { failures.push(`${id}: unreviewed ${record.severity} advisory in ${record.module_name}`); continue; }
    if (exception.moduleName !== record.module_name || exception.severity !== record.severity || !record.findings.every((finding) => exception.versions.includes(finding.version) && finding.paths.every((value) => reviewedDependencyPath(record.module_name, value)))) {
      failures.push(`${id}: package, severity, affected version or dependency path differs from the reviewed exception`); continue;
    }
    if (now.getTime() >= exception.expires) { failures.push(`${id}: security exception expired on ${exception.expiresOn}`); continue; }
    if (!checkedGuards.has(exception.guard)) checkedGuards.set(exception.guard, guardFailures(exception.guard, featureState));
    const featureFailures = checkedGuards.get(exception.guard);
    if (featureFailures.length) { failures.push(`${id}: ${featureFailures.join("; ")}`); continue; }
    accepted.push({ advisoryId: id, expiresOn: exception.expiresOn, reason: exception.reason });
  }
  return { passed: failures.length === 0, advisories: records.length, accepted, remediated, failures };
}

async function main() {
  const args = process.argv.slice(2);
  requireValid(args.length === 4 && args[0] === "--audit-file" && args[2] === "--audit-status" && /^[01]$/.test(args[3]), "Usage: node scripts/check-security-audit.mjs --audit-file FILE --audit-status 0|1");
  const feed = parseAudit(await readFile(args[1], "utf8"));
  const policy = JSON.parse(await readFile(new URL("./security-audit-exceptions.json", import.meta.url), "utf8"));
  const featureState = await loadFeatureState();
  const result = checkAudit(feed, policy, { auditStatus: Number(args[3]), featureState });
  if (!result.passed) throw new Error(result.failures.join("\n"));
  console.log(`Dependency security gate passed: ${result.advisories} raw advisories; ${result.accepted.length} reviewed unused-feature exceptions; ${result.remediated.length} verified local remediations.`);
  for (const exception of result.accepted) console.log(`${exception.advisoryId}: reviewed unused feature; expires ${exception.expiresOn}`);
  for (const remediation of result.remediated) console.log(`${remediation.advisoryId}: raw severity ${remediation.severity}; locally patched, SHA256 and exploit regression verified; review expires ${remediation.expiresOn}; ${remediation.source}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`Dependency security gate FAILED: ${error.message}`); process.exitCode = 1; });
}
