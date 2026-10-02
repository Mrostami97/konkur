export const IMPORT_IMAGE_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
]);

/** Active documents (including HTML and SVG) never use the generic media route. */
export function isSafeMediaMime(mimeType: string): boolean {
  return IMPORT_IMAGE_MIME_TYPES.has(mimeType) || mimeType === "video/mp4" || mimeType === "video/webm";
}

/** Match passive image signatures, rather than trusting a filename or MIME claim. */
export function sniffImportImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "image/gif";
  if (buffer.length >= 16 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const boxSize = buffer.readUInt32BE(0);
    if (boxSize >= 16 && boxSize <= buffer.length) {
      const brands = [buffer.toString("ascii", 8, 12)];
      for (let offset = 16; offset + 4 <= Math.min(boxSize, 256); offset += 4) brands.push(buffer.toString("ascii", offset, offset + 4));
      if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
    }
  }
  return null;
}

/** The import contract puts each asset at the archive root. */
export function isSafeImportFilename(filename: string): boolean {
  return filename.length > 0 && Buffer.byteLength(filename, "utf8") <= 255 &&
    filename !== "." && filename !== ".." && !/[\\/:]/.test(filename) &&
    [...filename].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
}
