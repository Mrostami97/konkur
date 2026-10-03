import assert from "node:assert/strict";
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../encrypt-production-inspection.mjs", import.meta.url));
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
function run(input, key = publicKey) {
  const env = { ...process.env };
  if (key === undefined || key === null) delete env.PRODUCTION_INSPECTION_PUBLIC_KEY;
  else env.PRODUCTION_INSPECTION_PUBLIC_KEY = key;
  return spawnSync(process.execPath, [script], { input, env, encoding: "utf8", maxBuffer: 512 * 1024, timeout: 10000 });
}
function notices(output) {
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^::notice title=(Encrypted production prerequisites(?: part (\d+) of (\d+))?)::([A-Za-z0-9+/]+={0,2})$/);
    assert.ok(match, "every published line must be a valid encrypted notice");
    assert.ok(match[4].length <= 3000, "an annotation message must fit the safe 3000-character bound");
    return { title: match[1], part: match[2] ? Number(match[2]) : null, total: match[3] ? Number(match[3]) : null, message: match[4] };
  });
}
function decrypt(encoded) {
  const envelope = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  assert.equal(envelope.version, 1);
  const key = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(envelope.key, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
}
test("small reports retain the single legacy notice and decrypt exactly", () => {
  const input = Buffer.from("private synthetic diagnostic\nبررسی خصوصی\n", "utf8");
  const result = run(input);
  assert.equal(result.status, 0); assert.equal(result.stderr, "");
  const parsed = notices(result.stdout);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Encrypted production prerequisites");
  assert.deepEqual(decrypt(parsed[0].message), input);
  assert.ok(!result.stdout.includes("private synthetic diagnostic"));
});
test("an 8KiB report uses at most ten contiguous bounded notices and decrypts without loss", () => {
  const input = Buffer.alloc(8 * 1024);
  for (let index = 0; index < input.length; index++) input[index] = index % 251;
  const result = run(input);
  assert.equal(result.status, 0); assert.equal(result.stderr, "");
  const parsed = notices(result.stdout);
  assert.ok(parsed.length > 1);
  assert.ok(parsed.length <= 10);
  for (const [index, notice] of parsed.entries()) {
    assert.equal(notice.part, index + 1);
    assert.equal(notice.total, parsed.length);
    assert.equal(notice.title, `Encrypted production prerequisites part ${index + 1} of ${parsed.length}`);
  }
  assert.deepEqual(decrypt(parsed.map((notice) => notice.message).join("")), input);
});
test("reports exceeding the ten-notice transport budget fail without partial publication", () => {
  const result = run(Buffer.alloc(128 * 1024, "PRIVATE_FAILURE_VALUE_"));
  assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "Production inspection report encryption failed; no diagnostic content was published.");
});
test("oversized reports fail before publishing any encrypted or plaintext diagnostics", () => {
  const result = run(Buffer.alloc(128 * 1024 + 1, "PRIVATE_FAILURE_VALUE_"));
  assert.equal(result.status, 1); assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "Production inspection report encryption failed; no diagnostic content was published.");
});
test("missing and invalid public keys never expose diagnostic content or crypto details", () => {
  const input = Buffer.from("PRIVATE_FAILURE_VALUE diagnostic content must remain private");
  for (const key of [null, "", "not a public key"]) {
    const result = run(input, key);
    assert.equal(result.status, 1); assert.equal(result.stdout, "");
    assert.equal(result.stderr.trim(), "Production inspection report encryption failed; no diagnostic content was published.");
  }
});
