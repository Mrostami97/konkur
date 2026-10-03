import assert from "node:assert/strict";
import test from "node:test";
import { createHash, createHmac, pbkdf2Sync } from "node:crypto";

const rotation = await import("../../ops/rotate-internal-credentials.mjs").catch(() => ({}));

test("environment parsing never executes shell syntax and refuses interpolation ambiguity", () => {
  assert.equal(typeof rotation.parseEnv, "function");
  assert.deepEqual({ ...rotation.parseEnv("A='literal # value'\nB=plain # comment\nC=\"literal\"\n") }, {
    A: "literal # value", B: "plain", C: "literal",
  });
  for (const source of ["A=$(touch file)\n", "A=${B}\n", "A=one\nA=two\n", "A='multiline\nvalue'\n", "A=\"unclosed\n"]) {
    assert.throws(() => rotation.parseEnv(source), /configuration/);
  }
});

test("rotation preserves unrelated configuration and removes optional administrator bootstrap", () => {
  assert.equal(typeof rotation.rewriteEnv, "function");
  const result = rotation.rewriteEnv("# retained\nPOSTGRES_PASSWORD=old\nWEB_DOMAIN=fixture.invalid\nBOOTSTRAP_ADMIN_PHONE=synthetic\nMINIO_ROOT_PASSWORD=old\nBOOTSTRAP_ADMIN_PASSWORD=old\n", {
    POSTGRES_PASSWORD: "synthetic_pg_secret", MINIO_ROOT_PASSWORD: "synthetic_s3_secret",
  });
  assert.equal(result, "# retained\nPOSTGRES_PASSWORD=synthetic_pg_secret\nWEB_DOMAIN=fixture.invalid\nMINIO_ROOT_PASSWORD=synthetic_s3_secret\n");
});

test("PostgreSQL SCRAM verifier authenticates the supplied random URL-safe secret", () => {
  assert.equal(typeof rotation.scramVerifier, "function");
  const secret = "synthetic_only_2dRaZ7_KyN-pdqwF";
  const value = rotation.scramVerifier(secret);
  const match = /^SCRAM-SHA-256\$(\d+):([^$]+)\$([^:]+):(.+)$/u.exec(value);
  assert.ok(match);
  const salted = pbkdf2Sync(secret, Buffer.from(match[2], "base64"), Number(match[1]), 32, "sha256");
  const client = createHmac("sha256", salted).update("Client Key").digest();
  assert.equal(createHash("sha256").update(client).digest("base64"), match[3]);
  assert.equal(createHmac("sha256", salted).update("Server Key").digest("base64"), match[4]);
  assert.ok(!value.includes(secret));
  assert.notEqual(rotation.scramVerifier(secret), value);
});

test("administrator preflight requires a real ADMIN password credential", () => {
  assert.equal(typeof rotation.assertBaseline, "function");
  assert.throws(() => rotation.assertBaseline({ adminCount: 0 }), /administrator/);
  assert.throws(() => rotation.assertBaseline({ adminCount: 1, adminFingerprint: "invalid" }), /administrator/);
  assert.doesNotThrow(() => rotation.assertBaseline({ adminCount: 1, adminFingerprint: "a".repeat(64), object: null }));
});

test("IAM verification ignores only record and object-key order, preserving permissions and multiplicity", () => {
  assert.equal(typeof rotation.canonicalIam, "function");
  const before = '{"status":"success","policy":"read","rules":{"b":2,"a":1}}\n{"status":"success","user":"fixture"}\n';
  const reordered = '{"user":"fixture","status":"success"}\n{"rules":{"a":1,"b":2},"policy":"read","status":"success"}\n';
  assert.equal(rotation.canonicalIam(before), rotation.canonicalIam(reordered));
  assert.notEqual(rotation.canonicalIam(before), rotation.canonicalIam(reordered.replace('"read"', '"write"')));
  assert.notEqual(rotation.canonicalIam(before), rotation.canonicalIam(before + '{"status":"success","user":"fixture"}\n'));
  assert.notEqual(rotation.canonicalIam('{"status":"success","rules":[1,2]}'), rotation.canonicalIam('{"status":"success","rules":[2,1]}'));
});

test("IAM verification refuses empty, malformed or unsuccessful command output", () => {
  assert.equal(typeof rotation.canonicalIam, "function");
  for (const output of ["", "not JSON", "[]", "null", '{"status":"error"}', '{"policy":"read"}']) {
    assert.throws(() => rotation.canonicalIam(output));
  }
});
