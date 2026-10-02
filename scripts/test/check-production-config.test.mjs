import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateProductionConfig, validateProxyCidrs } from "../check-production-config.mjs";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://konkur:ci_fixture_Pg_9816_X@postgres:5432/konkurcom",
  S3_SECRET_KEY: "ci_fixture_S3_5618_K",
  FRONTEND_URL: "https://kunkurcomputer.ir",
  TRUSTED_PROXY_CIDRS: "185.8.172.0/22,2001:db8::/32",
};

test("explicit production configuration passes without network or database access", () => {
  assert.deepEqual(validateProductionConfig(valid), []);
});

test("missing and weak credentials fail closed", () => {
  for (const secret of [undefined, "", "konkur", "konkur123", "change-me-long-password", "AAAAAAAAAAAAAAAAAAAA", "1234567890123456", "Password1234567890"]) {
    const candidate = { ...valid, S3_SECRET_KEY: secret, DATABASE_URL: `postgresql://konkur:${secret ?? ""}@postgres:5432/konkurcom` };
    const errors = validateProductionConfig(candidate);
    assert(errors.some((value) => value.startsWith("DATABASE_URL password")));
    assert(errors.some((value) => value.startsWith("S3_SECRET_KEY")));
  }
});

test("malformed URLs, missing databases and non-HTTPS frontend fail", () => {
  for (const DATABASE_URL of ["not a URL", "https://u:long_credential_762@host/db", "postgresql://konkur:long_credential_762@host/", "postgresql://konkur:long_credential_762@host", "postgresql://host/db", "postgresql://u:%ZZ@host/db"]) {
    assert(validateProductionConfig({ ...valid, DATABASE_URL }).some((value) => value.startsWith("DATABASE_URL")));
  }
  for (const FRONTEND_URL of [undefined, "http://kunkurcomputer.ir", "https://user:secret@kunkurcomputer.ir", "bad"]) {
    assert(validateProductionConfig({ ...valid, FRONTEND_URL }).some((value) => value.startsWith("FRONTEND_URL")));
  }
});

test("URL-encoded database passwords are validated after decoding", () => {
  assert.deepEqual(validateProductionConfig({ ...valid, DATABASE_URL: "postgresql://konkur:unique%21Pg%23secret%409867@postgres:5432/konkurcom" }), []);
  assert(validateProductionConfig({ ...valid, DATABASE_URL: "postgresql://konkur:change%2Dme@postgres:5432/konkurcom" }).length);
});

test("proxy trust rejects malformed and universal networks", () => {
  assert.deepEqual(validateProxyCidrs(""), []);
  assert.deepEqual(validateProxyCidrs("127.0.0.1/32 2001:db8::/128"), []);
  for (const value of ["0.0.0.0/0", "::/0", "127.0.0.1", "192.0.2.0/33", "::/129", "192.0.2.0/-1", "host/24", "192.0.2.0/24/1", "192.0.2.0/NaN", "192.0.2.0/24;evil"]) {
    assert(validateProxyCidrs(value).length, value);
  }
});

test("bootstrap requires both fields and a strong password", () => {
  assert.deepEqual(validateProductionConfig({ ...valid, BOOTSTRAP_ADMIN_PHONE: "", BOOTSTRAP_ADMIN_PASSWORD: "" }), []);
  assert(validateProductionConfig({ ...valid, BOOTSTRAP_ADMIN_PHONE: "09120000000" }).length);
  assert(validateProductionConfig({ ...valid, BOOTSTRAP_ADMIN_PASSWORD: "ci_fixture_admin_5621" }).length);
  assert(validateProductionConfig({ ...valid, BOOTSTRAP_ADMIN_PHONE: "09120000000", BOOTSTRAP_ADMIN_PASSWORD: "password" }).length);
  assert.deepEqual(validateProductionConfig({ ...valid, BOOTSTRAP_ADMIN_PHONE: "09120000000", BOOTSTRAP_ADMIN_PASSWORD: "ci_fixture_admin_5621" }), []);
});

test("preflight mode enforces credentials even if NODE_ENV is not set", () => {
  assert(validateProductionConfig({}, { requireCredentials: true }).length);
});

test("CLI failures report field names and never secret values", () => {
  const secret = "example-never-print-this-token";
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../check-production-config.mjs", import.meta.url)), "--require-credentials"], {
    env: { ...process.env, ...valid, S3_SECRET_KEY: secret }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /S3_SECRET_KEY/);
  assert(!`${result.stderr}${result.stdout}`.includes(secret));
});
