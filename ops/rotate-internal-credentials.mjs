// Offline helper, run with the existing API image and --network=none.
// All generated credentials, probes and SQL belong only in the private state directory.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateProductionConfig } from "../scripts/check-production-config.mjs";

export function parseEnv(source) {
  const result = Object.create(null);
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    if (!line.trim() || /^\s*#/u.test(line)) continue;
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match || Object.hasOwn(result, match[1])) throw new Error("Ambiguous environment configuration");
    let value = match[2];
    if (value.startsWith("'") || value.startsWith('"')) {
      const quote = value[0];
      const end = value.indexOf(quote, 1);
      if (end < 0 || !/^\s*(?:#.*)?$/u.test(value.slice(end + 1))) throw new Error("Ambiguous environment configuration");
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/u, "").trimEnd();
    // Compose interpolation, multiline/escaped literals and shell substitutions need
    // an independent review; do not guess their effective values or execute them.
    if (/[\x00-\x1f$`\\]/u.test(value)) throw new Error("Unsupported environment configuration");
    result[match[1]] = value;
  }
  return result;
}

export function rewriteEnv(source, credentials) {
  parseEnv(source);
  const handled = new Set();
  const lines = source.replaceAll("\r\n", "\n").split("\n").flatMap((line) => {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(line)?.[1];
    if (["BOOTSTRAP_ADMIN_PHONE", "BOOTSTRAP_ADMIN_PASSWORD"].includes(key)) return [];
    if (Object.hasOwn(credentials, key ?? "")) {
      handled.add(key);
      return [`${key}=${credentials[key]}`];
    }
    return [line];
  });
  while (lines.at(-1) === "") lines.pop();
  for (const [key, value] of Object.entries(credentials)) if (!handled.has(key)) lines.push(`${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

export function scramVerifier(secret) {
  const salt = randomBytes(16);
  const iterations = 4096;
  const salted = pbkdf2Sync(secret, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest("base64");
  const serverKey = createHmac("sha256", salted).update("Server Key").digest("base64");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey}:${serverKey}`;
}

export function assertBaseline(baseline) {
  if (!Number.isInteger(baseline.adminCount) || baseline.adminCount < 1
    || !/^[a-f0-9]{64}$/u.test(baseline.adminFingerprint ?? "")) {
    throw new Error("Existing administrator with a password credential is required");
  }
  if (baseline.object !== null && (!baseline.object || typeof baseline.object.name !== "string"
    || !/^[a-f0-9]{64}$/u.test(baseline.object.sha256 ?? ""))) throw new Error("Stored object baseline is invalid");
}

function containerEnv(container) {
  const env = Object.create(null);
  for (const entry of container.Config.Env) {
    const index = entry.indexOf("=");
    if (index < 1) throw new Error("Container environment is invalid");
    const key = entry.slice(0, index);
    if (Object.hasOwn(env, key)) throw new Error("Container environment is ambiguous");
    env[key] = entry.slice(index + 1);
  }
  return env;
}

function readPlan(state) {
  const source = readFileSync(resolve(state, ".env.old"), "utf8");
  const env = parseEnv(source);
  const containers = JSON.parse(readFileSync(resolve(state, "containers.json"), "utf8"));
  if (containers.length !== 3) throw new Error("Three existing services are required");
  const services = Object.fromEntries(containers.map((container) => [container.Config.Labels["com.docker.compose.service"], container]));
  const project = services.api?.Config.Labels["com.docker.compose.project"];
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(project ?? "") || !["api", "postgres", "minio"].every((key) => {
    const container = services[key];
    return container?.State.Running && container.Config.Labels["com.docker.compose.project"] === project
      && /^sha256:[a-f0-9]{64}$/u.test(container.Image);
  })) throw new Error("Existing service identity is invalid");
  const api = containerEnv(services.api);
  const postgres = containerEnv(services.postgres);
  const minio = containerEnv(services.minio);
  let database;
  try { database = new URL(api.DATABASE_URL); } catch { throw new Error("Existing database configuration is invalid"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) || database.hostname !== "postgres"
    || database.username !== "konkur" || database.pathname !== "/konkurcom"
    || decodeURIComponent(database.password) !== env.POSTGRES_PASSWORD
    || postgres.POSTGRES_PASSWORD !== env.POSTGRES_PASSWORD || postgres.POSTGRES_USER !== "konkur"
    || postgres.POSTGRES_DB !== "konkurcom"
    || api.S3_ENDPOINT !== "minio" || api.S3_ACCESS_KEY !== "konkur" || api.S3_SECRET_KEY !== env.MINIO_ROOT_PASSWORD
    || minio.MINIO_ROOT_USER !== "konkur" || minio.MINIO_ROOT_PASSWORD !== env.MINIO_ROOT_PASSWORD
    || !api.S3_BUCKET) throw new Error("Internal service configuration does not match the private environment");
  // The official image declares *_FILE defaults even when those files do not
  // exist. The host orchestrator checks their actual existence before this step.
  if (Object.keys(minio).some((key) => /^MINIO_(?:KMS|KES|ETCD|IDENTITY)/u.test(key) && !key.endsWith("_FILE") && minio[key])) {
    throw new Error("KMS, external identity and file credentials require a separate storage rotation review");
  }
  for (const [key, destination] of [["postgres", "/var/lib/postgresql/data"], ["minio", "/data"]]) {
    if (!services[key].Mounts.some((mount) => mount.Destination === destination && ["volume", "bind"].includes(mount.Type))) {
      throw new Error("Existing persistent storage is required");
    }
  }
  const compose = JSON.parse(readFileSync(resolve(state, "compose-existing.json"), "utf8"));
  // Compose merges mounts by destination. Refuse unexpected destinations before
  // constructing explicit pins for the currently attached data volumes.
  for (const service of ["postgres", "minio", "api"]) {
    const existingTargets = services[service].Mounts.map(mount => mount.Destination).sort();
    const configuredTargets = (compose.services?.[service]?.volumes ?? []).map(mount => mount.target).sort();
    if (JSON.stringify(existingTargets) !== JSON.stringify(configuredTargets)) throw new Error("Storage mount destinations drifted from existing services");
  }
  return { source, env, services, project, api, postgres, minio, database };
}

function pinnedServices(plan) {
  const volumes = {};
  const services = {};
  for (const service of ["postgres", "minio", "api"]) {
    const container = plan.services[service];
    const mounts = container.Mounts.map((mount, index) => {
      if (mount.Type === "volume") {
        const name = `rotation_${service}_${index}`;
        volumes[name] = { external: true, name: mount.Name };
        return { type: "volume", source: name, target: mount.Destination, read_only: !mount.RW };
      }
      if (mount.Type === "bind" && mount.Source.startsWith("/")) {
        return { type: "bind", source: mount.Source, target: mount.Destination, read_only: !mount.RW, bind: { create_host_path: false } };
      }
      throw new Error("Unsupported existing storage mount");
    });
    services[service] = {
      image: container.Image, command: container.Config.Cmd, entrypoint: container.Config.Entrypoint,
      working_dir: container.Config.WorkingDir || "/", user: container.Config.User || "0", volumes: mounts,
      environment: containerEnv(container),
    };
  }
  return { services, volumes };
}

export function buildProbe({ baseline = null, oldDatabaseUrl = null, oldS3Secret = null, verifyHealth = false } = {}) {
  // This source is written mode 600 and fed to docker exec on stdin, never argv.
  return `"use strict";
const { PrismaClient } = require("@prisma/client");
const { Client } = require("minio");
const { createHash } = require("node:crypto");
const http = require("node:http");
const baseline = ${JSON.stringify(baseline)};
const oldDatabaseUrl = ${JSON.stringify(oldDatabaseUrl)};
const oldS3Secret = ${JSON.stringify(oldS3Secret)};
const prisma = new PrismaClient({ log: [] });
const clientOptions = { endPoint: process.env.S3_ENDPOINT, port: Number(process.env.S3_PORT || 9000), useSSL: process.env.S3_USE_SSL === "true", accessKey: process.env.S3_ACCESS_KEY, secretKey: process.env.S3_SECRET_KEY };
const client = new Client(clientOptions);
const bucket = process.env.S3_BUCKET;
async function firstObject() {
  const stream = client.listObjectsV2(bucket, "", true);
  for await (const object of stream) { if (object.name) { stream.destroy(); return object.name; } }
  return null;
}
async function digestObject(name) {
  const hash = createHash("sha256");
  const stream = await client.getObject(bucket, name);
  for await (const bytes of stream) hash.update(bytes);
  return { name, sha256: hash.digest("hex") };
}
async function main() {
  const users = await prisma.user.findMany({ where: { passwordHash: { not: null }, roles: { some: { role: "ADMIN" } } }, select: { id: true, passwordHash: true }, orderBy: { id: "asc" } });
  const admins = users.filter(user => /^scrypt\\$[a-f0-9]{32}\\$[a-f0-9]{128}$/i.test(user.passwordHash || ""));
  if (!admins.length) throw new Error("ADMIN_CREDENTIAL_REQUIRED");
  const adminFingerprint = createHash("sha256").update(JSON.stringify(admins)).digest("hex");
  if (baseline && (admins.length !== baseline.adminCount || adminFingerprint !== baseline.adminFingerprint)) throw new Error("ADMIN_CHANGED");
  if (!await client.bucketExists(bucket)) throw new Error("BUCKET_REQUIRED");
  const name = baseline ? baseline.object?.name : await firstObject();
  const object = name ? await digestObject(name) : null;
  if (baseline?.object && object.sha256 !== baseline.object.sha256) throw new Error("OBJECT_CHANGED");
  if (oldDatabaseUrl) {
    const old = new PrismaClient({ log: [], datasources: { db: { url: oldDatabaseUrl } } });
    let rejected = false;
    try { await old.$connect(); await old.$queryRawUnsafe("SELECT 1"); } catch (error) { rejected = error.code === "P1000" || error.errorCode === "P1000" || error.meta?.code === "28P01"; }
    finally { await old.$disconnect(); }
    if (!rejected) throw new Error("OLD_DATABASE_CREDENTIAL_NOT_REJECTED");
  }
  if (oldS3Secret) {
    const old = new Client({ ...clientOptions, secretKey: oldS3Secret });
    let rejected = false;
    try { await old.bucketExists(bucket); } catch (error) { rejected = ["SignatureDoesNotMatch", "InvalidAccessKeyId", "AccessDenied"].includes(error.code); }
    if (!rejected) throw new Error("OLD_STORAGE_CREDENTIAL_NOT_REJECTED");
  }
  ${verifyHealth ? 'await new Promise((resolve, reject) => { const request = http.get("http://127.0.0.1:3001/healthz", response => { response.resume(); response.statusCode === 200 ? resolve() : reject(new Error("HEALTH_FAILED")); }); request.setTimeout(5000, () => request.destroy(new Error("HEALTH_TIMEOUT"))); request.on("error", reject); });' : ""}
  process.stdout.write(JSON.stringify({ adminCount: admins.length, adminFingerprint, object }));
}
const timer = setTimeout(() => process.exit(1), 45000);
main().then(async () => { clearTimeout(timer); await prisma.$disconnect(); }).catch(async error => { clearTimeout(timer); await prisma.$disconnect(); const code = /^[A-Z_]{3,80}$/.test(error.message || "") ? error.message : (/^[A-Za-z0-9_]{1,64}$/.test(error.code || "") ? error.code : "PROBE_FAILED"); process.stderr.write("Private probe failure: " + code + "\\n"); process.exitCode = 1; });
`;
}

function writePrivate(state, name, contents) {
  writeFileSync(resolve(state, name), contents, { mode: 0o600, flag: "wx" });
}

export function canonicalIam(source) {
  const normalize = (value) => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
    }
    return value;
  };
  const records = source.split(/\r?\n/u).filter((line) => line.trim()).map((line) => JSON.parse(line));
  if (!records.length || records.some((record) => !record || Array.isArray(record)
    || typeof record !== "object" || record.status !== "success")) {
    throw new Error("IAM command output is incomplete or unsuccessful");
  }
  // Record and object-key order are incidental; field values, array order and
  // duplicate records remain significant so a permission change cannot pass.
  return records.map((record) => JSON.stringify(normalize(record))).sort().join("\n");
}

function mcConfig(secret) {
  return JSON.stringify({ version: "10", aliases: { rotation: { url: "http://127.0.0.1:9000", accessKey: "konkur", secretKey: secret, api: "S3v4", path: "auto" } } });
}

function sqlFor(verifier) {
  if (!/^(?:md5[a-f0-9]{32}|SCRAM-SHA-256\$[1-9][0-9]*:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+)$/u.test(verifier)) {
    throw new Error("PostgreSQL credential verifier is unsupported");
  }
  return `SET log_statement = 'none';\nSET log_min_duration_statement = -1;\nSET log_duration = off;\nSET log_min_error_statement = 'panic';\nSET pgaudit.log = 'none';\nALTER ROLE konkur PASSWORD '${verifier}';\n`;
}

export function prepareRotation(state, action) {
  if (process.platform !== "linux" || !lstatSync(state).isDirectory() || (lstatSync(state).mode & 0o777) !== 0o700) {
    throw new Error("Private Linux state directory is required");
  }
  if (action === "check-iam-after" || action === "check-iam-rollback") {
    const actual = action === "check-iam-after" ? "iam-after.json" : "iam-rollback.json";
    if (canonicalIam(readFileSync(resolve(state, "iam-before.json"), "utf8"))
      !== canonicalIam(readFileSync(resolve(state, actual), "utf8"))) {
      throw new Error("Stored IAM configuration changed");
    }
    return;
  }
  const plan = readPlan(state);
  if (action === "plan") {
    writePrivate(state, "probe-before.cjs", buildProbe());
    writePrivate(state, "mc-config.old.json", mcConfig(plan.api.S3_SECRET_KEY));
    return;
  }
  if (action !== "prepare") throw new Error("Invalid offline rotation action");
  const baseline = JSON.parse(readFileSync(resolve(state, "baseline.json"), "utf8"));
  assertBaseline(baseline);
  const oldVerifier = readFileSync(resolve(state, "pg-verifier.old"), "utf8").trim();
  const rollbackSql = sqlFor(oldVerifier);
  const credentials = { POSTGRES_PASSWORD: randomBytes(32).toString("base64url"), MINIO_ROOT_PASSWORD: randomBytes(32).toString("base64url") };
  plan.database.password = credentials.POSTGRES_PASSWORD;
  const nextApi = { ...plan.api, DATABASE_URL: plan.database.href, S3_SECRET_KEY: credentials.MINIO_ROOT_PASSWORD, BOOTSTRAP_ADMIN_PHONE: "", BOOTSTRAP_ADMIN_PASSWORD: "" };
  const errors = validateProductionConfig(nextApi, { requireCredentials: true });
  if (errors.length) throw new Error("New production configuration failed the offline validator");
  const override = pinnedServices(plan);
  override.services.postgres.environment.POSTGRES_PASSWORD = credentials.POSTGRES_PASSWORD;
  override.services.minio.environment.MINIO_ROOT_PASSWORD = credentials.MINIO_ROOT_PASSWORD;
  override.services.api.environment = nextApi;
  const rollback = pinnedServices(plan);
  writePrivate(state, ".env.new", rewriteEnv(plan.source, credentials));
  writePrivate(state, "compose.next.json", JSON.stringify(override));
  writePrivate(state, "compose.old.json", JSON.stringify(rollback));
  writePrivate(state, "pg-forward.sql", sqlFor(scramVerifier(credentials.POSTGRES_PASSWORD)));
  writePrivate(state, "pg-rollback.sql", rollbackSql);
  writePrivate(state, "mc-config.new.json", mcConfig(credentials.MINIO_ROOT_PASSWORD));
  writePrivate(state, "probe-after.cjs", buildProbe({ baseline, oldDatabaseUrl: plan.api.DATABASE_URL, oldS3Secret: plan.api.S3_SECRET_KEY, verifyHealth: true }));
  writePrivate(state, "probe-rollback.cjs", buildProbe({ baseline, verifyHealth: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const state = resolve(process.argv[3] ?? "/state");
  try { prepareRotation(state, process.argv[2]); }
  catch (error) {
    try { writePrivate(state, `helper-error-${randomBytes(4).toString("hex")}.txt`, String(error.stack)); } catch {}
    console.error("Offline credential rotation preflight failed; inspect private state locally."); process.exitCode = 1;
  }
}
