import { constants, createCipheriv, publicEncrypt, randomBytes } from "node:crypto";

// Public CI logs must not expose production security posture. The corresponding
// ephemeral private key stays with the operator outside this public repository.
try {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 128 * 1024) throw new Error("bounded report exceeded");
    chunks.push(chunk);
  }
  const plaintext = Buffer.concat(chunks);
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
  const encoded = Buffer.from(JSON.stringify(envelope)).toString("base64");
  // GitHub truncates large annotation messages and retains only ten notices
  // per step. Bound the entire transport before emitting any encrypted piece;
  // recipients concatenate the numbered messages before decoding.
  const maxNoticeCharacters = 3000;
  const parts = Math.ceil(encoded.length / maxNoticeCharacters);
  if (parts > 10) throw new Error("bounded annotation transport exceeded");
  for (let index = 0; index < parts; index++) {
    const title = parts === 1 ? "Encrypted production prerequisites"
      : `Encrypted production prerequisites part ${index + 1} of ${parts}`;
    const message = encoded.slice(index * maxNoticeCharacters, (index + 1) * maxNoticeCharacters);
    console.log(`::notice title=${title}::${message}`);
  }
} catch {
  console.error("Production inspection report encryption failed; no diagnostic content was published.");
  process.exitCode = 1;
}
