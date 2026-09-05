import { BadRequestException } from "@nestjs/common";
import AdmZip from "adm-zip";

export interface ParsedImportZip {
  items: unknown[];
  files: Map<string, Buffer>;
}

/**
 * Expects a ZIP with a `payload.json` at the root -- either a single contract
 * item, or `{ "items": [...] }` for a batch -- plus any media files the
 * items' `assets[].filename` entries reference, at the ZIP root.
 */
export function parseImportZip(buffer: Buffer): ParsedImportZip {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BadRequestException("uploaded file is not a valid zip archive");
  }

  const entries = zip.getEntries();
  const payloadEntry = entries.find((e) => e.entryName === "payload.json");
  if (!payloadEntry) {
    throw new BadRequestException("zip archive must contain payload.json at its root");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadEntry.getData().toString("utf-8"));
  } catch {
    throw new BadRequestException("payload.json is not valid JSON");
  }

  const itemsField =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).items : undefined;
  const items: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(itemsField) ? itemsField : [parsed];

  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.entryName === "payload.json" || entry.isDirectory) continue;
    files.set(entry.entryName, entry.getData());
  }

  return { items, files };
}
