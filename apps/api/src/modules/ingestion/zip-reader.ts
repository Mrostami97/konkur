import { BadRequestException } from "@nestjs/common";
import AdmZip from "adm-zip";
import { inflateRawSync } from "node:zlib";
import { isSafeImportFilename } from "./media-types";

export const IMPORT_ZIP_LIMITS = {
  compressedBytes: 50 * 1024 * 1024,
  entries: 1000,
  payloadBytes: 10 * 1024 * 1024,
  assetBytes: 50 * 1024 * 1024,
  expandedBytes: 100 * 1024 * 1024,
  items: 1000,
} as const;

export interface ParsedImportZip {
  items: unknown[];
  files: Map<string, Buffer>;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/** Never use entry.getData(): its inflate has no actual output-size budget. */
function readEntry(entry: AdmZip.IZipEntry, maxBytes: number): Buffer {
  try {
    if ((entry.header.flags & 1) !== 0) throw new Error("encrypted entry");
    const compressed = entry.getCompressedData();
    if (compressed.length !== entry.header.compressedSize) throw new Error("truncated entry");
    const limit = Math.max(1, Math.min(maxBytes, entry.header.size));
    let data: Buffer;
    if (entry.header.method === 0) {
      if (compressed.length > limit) throw new Error("entry exceeds budget");
      data = compressed;
    } else if (entry.header.method === 8) {
      data = inflateRawSync(compressed, { maxOutputLength: limit });
    } else {
      throw new Error("unsupported compression");
    }
    if (data.length !== entry.header.size || crc32(data) !== entry.header.crc) throw new Error("entry integrity mismatch");
    return data;
  } catch {
    throw new BadRequestException(`zip entry ${entry.entryName} is invalid or exceeds its expanded size budget`);
  }
}

/** Root payload plus root assets, with bounded metadata, decompression and JSON. */
export function parseImportZip(buffer: Buffer): ParsedImportZip {
  if (buffer.length > IMPORT_ZIP_LIMITS.compressedBytes) throw new BadRequestException("zip archive must be 50 MB or smaller");
  let zip: AdmZip;
  let entries: AdmZip.IZipEntry[];
  try {
    zip = new AdmZip(buffer);
    // Count before allocating/parsing every central-directory entry.
    if (zip.getEntryCount() > IMPORT_ZIP_LIMITS.entries) throw new Error("too many entries");
    entries = zip.getEntries();
    if (entries.length > IMPORT_ZIP_LIMITS.entries) throw new Error("too many entries");
  } catch {
    throw new BadRequestException("zip archive is invalid or contains more than 1000 entries");
  }

  const names = new Set<string>();
  let expandedBytes = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!isSafeImportFilename(entry.entryName) || names.has(entry.entryName)) {
      throw new BadRequestException("zip files must have unique safe filenames at the archive root");
    }
    names.add(entry.entryName);
    const maxBytes = entry.entryName === "payload.json" ? IMPORT_ZIP_LIMITS.payloadBytes : IMPORT_ZIP_LIMITS.assetBytes;
    if (!Number.isSafeInteger(entry.header.size) || entry.header.size < 0 || entry.header.size > maxBytes) {
      throw new BadRequestException(`zip entry ${entry.entryName} exceeds its expanded size budget`);
    }
    expandedBytes += entry.header.size;
    if (expandedBytes > IMPORT_ZIP_LIMITS.expandedBytes) throw new BadRequestException("zip expanded size must be 100 MB or smaller");
  }

  const payloadEntry = entries.find((entry) => !entry.isDirectory && entry.entryName === "payload.json");
  if (!payloadEntry) throw new BadRequestException("zip archive must contain payload.json at its root");
  const payload = readEntry(payloadEntry, IMPORT_ZIP_LIMITS.payloadBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf-8"));
  } catch {
    throw new BadRequestException("payload.json is not valid JSON");
  }

  const itemsField =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).items : undefined;
  const items: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(itemsField) ? itemsField : [parsed];
  if (items.length > IMPORT_ZIP_LIMITS.items) throw new BadRequestException("payload.json must contain at most 1000 items");

  const referenced = new Set<string>();
  for (const item of items) {
    const assets = item && typeof item === "object" ? (item as Record<string, unknown>).assets : undefined;
    if (!Array.isArray(assets)) continue;
    for (const asset of assets) {
      const filename = asset && typeof asset === "object" ? (asset as Record<string, unknown>).filename : undefined;
      if (typeof filename === "string" && filename !== "payload.json") referenced.add(filename);
    }
  }
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (!entry.isDirectory && referenced.has(entry.entryName)) files.set(entry.entryName, readEntry(entry, IMPORT_ZIP_LIMITS.assetBytes));
  }

  return { items, files };
}
