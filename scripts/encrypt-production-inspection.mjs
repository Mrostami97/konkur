import { constants, createCipheriv, publicEncrypt, randomBytes } from "node:crypto";

// Public CI logs must not expose production security posture. The corresponding
// ephemeral private key stays with the operator outside this public repository.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const plaintext = Buffer.concat(chunks);
  if (plaintext.length > 128 * 1024) throw new Error("bounded report exceeded");
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const wrappedKey = publicEncrypt({
    key: process.env.PRODUCTION_INSPECTION_PUBLIC_KEY,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256",
  }, key);
  const envelope = { version: 1, key: wrappedKey.toString("base64"), iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
  console.log(`::notice title=Encrypted production prerequisites::${Buffer.from(JSON.stringify(envelope)).toString("base64")}`);
} catch {
  console.error("Production inspection report encryption failed; no diagnostic content was published.");
  process.exitCode = 1;
}
