import { randomBytes } from "crypto";
import { Readable, Transform } from "stream";
import { PDFDocument } from "pdf-lib";

/** Whether the bytes are a PDF pdf-lib can open (and not encrypted), with its page count. */
export async function inspectPdf(bytes: Uint8Array): Promise<{ pages: number } | { error: "not-pdf" | "encrypted" | "unreadable" }> {
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") return { error: "not-pdf" };
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return { pages: doc.getPageCount() };
  } catch (error) {
    return { error: /encrypt/i.test(String(error)) ? "encrypted" : "unreadable" };
  }
}

/** The type a sold document travels as: not a PDF to anything but our reader. */
export const SEALED_MIME = "application/vnd.kunkurcomputer.sealed";
const SEAL_KEY_BYTES = 32;

/**
 * Wraps a stamped copy for the in-panel reader: a random key, then the file
 * XOR-masked with it. This is not encryption -- the key travels with it --
 * but it means the response is not a PDF to a download manager (which would
 * otherwise intercept it and save the file) or to a "save as" of the
 * request; only the reader turns it back into pages.
 */
export function sealStream(source: Readable): Readable {
  const key = randomBytes(SEAL_KEY_BYTES);
  let offset = 0;
  const mask = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const out = Buffer.allocUnsafe(chunk.length);
      for (let i = 0; i < chunk.length; i += 1) out[i] = chunk[i] ^ key[(offset + i) % SEAL_KEY_BYTES];
      offset += chunk.length;
      callback(null, out);
    },
  });
  mask.push(key);
  source.on("error", (error) => mask.destroy(error));
  return source.pipe(mask);
}

/** The inverse of `sealStream`, for tests and tooling. */
export function unseal(sealed: Uint8Array): Buffer {
  const key = sealed.subarray(0, SEAL_KEY_BYTES);
  const body = Buffer.from(sealed.subarray(SEAL_KEY_BYTES));
  for (let i = 0; i < body.length; i += 1) body[i] ^= key[i % SEAL_KEY_BYTES];
  return body;
}
