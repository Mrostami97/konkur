import { createHash } from "crypto";

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Deterministic stringify (recursively sorted object keys) so semantically
 * identical JSON with different key order still hashes the same. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Json(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}
