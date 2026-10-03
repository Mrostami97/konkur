import { BadRequestException } from "@nestjs/common";
import AdmZip from "adm-zip";
import { ImportItemStatus } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { IngestionService } from "../src/modules/ingestion/ingestion.service";
import { ObjectStorageService } from "../src/modules/ingestion/object-storage.service";
import { sha256Buffer } from "../src/modules/ingestion/checksum";
import { isSafeImportFilename, isSafeMediaMime, sniffImportImageMime } from "../src/modules/ingestion/media-types";
import { IMPORT_ZIP_LIMITS, parseImportZip } from "../src/modules/ingestion/zip-reader";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

function archive(payload: unknown, files: Record<string, Buffer> = {}): Buffer {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(payload)));
  for (const [name, bytes] of Object.entries(files)) zip.addFile(name, bytes);
  return zip.toBuffer();
}

/** Alter central-directory metadata only: proofs stay small and never expand a bomb. */
function editCentral(buffer: Buffer, edit: (copy: Buffer, offset: number, name: string) => void): Buffer {
  const copy = Buffer.from(buffer);
  for (let offset = 0; offset + 46 <= copy.length; offset += 1) {
    if (copy.readUInt32LE(offset) !== 0x02014b50) continue;
    const length = copy.readUInt16LE(offset + 28);
    const name = copy.toString("utf8", offset + 46, offset + 46 + length);
    edit(copy, offset, name);
    offset += 45 + length + copy.readUInt16LE(offset + 30) + copy.readUInt16LE(offset + 32);
  }
  return copy;
}

function assetArticle(bytes: Buffer, mime = "image/png", filename = "figure.png") {
  return {
    schema_version: "article.v1", external_id: "security-synthetic-article", title: "Synthetic image lesson", slug: "security-synthetic-article",
    summary: "A synthetic local fixture", content_blocks: [{ type: "image", media_key: "figure" }],
    taxonomy: { major: ["computer-engineering"] },
    assets: [{ media_key: "figure", filename, mime_type: mime, checksum: `sha256:${sha256Buffer(bytes)}` }],
    provenance: { producer_type: "human", source_artifact: "local-security-fixture" }, review_status: "approved",
  };
}

describe("passive import media", () => {
  function setup() {
    const prisma = { importItem: { create: jest.fn().mockResolvedValue({}) }, article: { findUnique: jest.fn().mockResolvedValue(null) }, sourceArtifact: { upsert: jest.fn().mockResolvedValue({}) } };
    const storage = { objectExists: jest.fn().mockResolvedValue(false), putObject: jest.fn().mockResolvedValue(undefined) };
    const service = new IngestionService(prisma as unknown as PrismaService, {} as AuditService, storage as unknown as ObjectStorageService);
    return { prisma, storage, service };
  }

  async function stage(service: IngestionService, payload: ReturnType<typeof assetArticle>, bytes: Buffer) {
    // Exercise the actual staging implementation without a database or storage server.
    await (service as unknown as { stageItem(job: string, schema: string, payload: unknown, files: Map<string, Buffer>): Promise<void> })
      .stageItem("synthetic-job", "article.v1", payload, new Map([[payload.assets[0].filename, bytes]]));
  }

  it.each(["text/html", "image/svg+xml", "application/xhtml+xml", "application/pdf"])("rejects %s before object storage", async (mime) => {
    const { service, storage, prisma } = setup();
    const bytes = Buffer.from("<html><body>inert synthetic document</body></html>");
    await stage(service, assetArticle(bytes, mime), bytes);
    expect(prisma.importItem.create.mock.calls[0][0].data.status).toBe(ImportItemStatus.INVALID);
    expect(storage.objectExists).not.toHaveBeenCalled();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.sourceArtifact.upsert).not.toHaveBeenCalled();
  });

  it("rejects an HTML body with a forged passive MIME and mismatched image MIME", async () => {
    for (const [bytes, mime] of [[Buffer.from("<html>inert</html>"), "image/png"], [PNG, "image/jpeg"]] as const) {
      const { service, storage, prisma } = setup();
      await stage(service, assetArticle(bytes, mime), bytes);
      expect(prisma.importItem.create.mock.calls[0][0].data.status).toBe(ImportItemStatus.INVALID);
      expect(storage.putObject).not.toHaveBeenCalled();
    }
  });

  it("keeps an ordinary verified PNG import valid", async () => {
    const { service, storage, prisma } = setup();
    await stage(service, assetArticle(PNG), PNG);
    expect(prisma.importItem.create.mock.calls[0][0].data.status).toBe(ImportItemStatus.VALID);
    expect(storage.putObject).toHaveBeenCalledWith(`${sha256Buffer(PNG)}/figure.png`, PNG, "image/png");
    expect(prisma.sourceArtifact.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects traversal and the reserved payload filename before storage", async () => {
    for (const filename of ["../figure.png", "nested/figure.png", "nested\\figure.png", "payload.json"]) {
      const { service, storage, prisma } = setup();
      await stage(service, assetArticle(PNG, "image/png", filename), PNG);
      expect(prisma.importItem.create.mock.calls[0][0].data.status).toBe(ImportItemStatus.INVALID);
      expect(storage.putObject).not.toHaveBeenCalled();
    }
  });

  it("identifies permitted image signatures and rejects active MIME types", () => {
    expect(sniffImportImageMime(PNG)).toBe("image/png");
    expect(sniffImportImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImportImageMime(Buffer.from("RIFFxxxxWEBP"))).toBe("image/webp");
    expect(sniffImportImageMime(Buffer.from("GIF89a"))).toBe("image/gif");
    const avif = Buffer.alloc(20); avif.writeUInt32BE(20); avif.write("ftyp", 4); avif.write("avif", 8); avif.write("avif", 16);
    expect(sniffImportImageMime(avif)).toBe("image/avif");
    expect(sniffImportImageMime(Buffer.from("<svg/>"))).toBeNull();
    expect(isSafeMediaMime("image/svg+xml")).toBe(false);
    expect(isSafeMediaMime("text/html")).toBe(false);
    expect(isSafeMediaMime("video/mp4")).toBe(true);
    expect(isSafeImportFilename("../x.png")).toBe(false);
    expect(isSafeImportFilename("x:y.png")).toBe(false);
  });
});

describe("bounded ZIP import", () => {
  it("parses a normal batch and inflates only referenced assets", () => {
    const payload = { items: [assetArticle(PNG)] };
    const bytes = archive(payload, { "figure.png": PNG, "unused.png": PNG });
    // Unreferenced bytes need not be inflated or pass a CRC check.
    const damagedUnused = editCentral(bytes, (copy, offset, name) => { if (name === "unused.png") copy.writeUInt32LE(0, offset + 16); });
    const result = parseImportZip(damagedUnused);
    expect(result.items).toEqual(payload.items);
    expect([...result.files.keys()]).toEqual(["figure.png"]);
    expect(result.files.get("figure.png")).toEqual(PNG);
  });

  it("checks declared payload and aggregate expansion before decompression", () => {
    const payloadLarge = editCentral(archive({}), (copy, offset) => copy.writeUInt32LE(IMPORT_ZIP_LIMITS.payloadBytes + 1, offset + 24));
    expect(() => parseImportZip(payloadLarge)).toThrow("expanded size budget");
    const aggregate = editCentral(archive({}, { "a.png": PNG, "b.png": PNG, "c.png": PNG }), (copy, offset, name) => {
      if (name !== "payload.json") copy.writeUInt32LE(40 * 1024 * 1024, offset + 24);
    });
    expect(() => parseImportZip(aggregate)).toThrow("100 MB");
  });

  it("bounds actual inflate even when the declared uncompressed size lies", () => {
    const bytes = archive({ text: "a".repeat(1024 * 1024) });
    const forged = editCentral(bytes, (copy, offset) => copy.writeUInt32LE(16, offset + 24));
    expect(() => parseImportZip(forged)).toThrow("invalid or exceeds");
  });

  it.each(["crc", "encryption", "compression"])("rejects invalid %s instead of trusting ZIP metadata", (fault) => {
    const invalid = editCentral(archive({}), (copy, offset) => {
      if (fault === "crc") copy.writeUInt32LE(0, offset + 16);
      if (fault === "encryption") copy.writeUInt16LE(1, offset + 8);
      if (fault === "compression") copy.writeUInt16LE(99, offset + 10);
    });
    expect(() => parseImportZip(invalid)).toThrow(BadRequestException);
  });

  it("rejects too many entries and too many items", () => {
    const zip = new AdmZip(); zip.addFile("payload.json", Buffer.from("{}"));
    for (let index = 0; index < IMPORT_ZIP_LIMITS.entries; index += 1) zip.addFile(`asset-${index}.png`, Buffer.alloc(0));
    expect(() => parseImportZip(zip.toBuffer())).toThrow("1000 entries");
    expect(() => parseImportZip(archive(Array.from({ length: IMPORT_ZIP_LIMITS.items + 1 }, () => ({}))))).toThrow("1000 items");
  });

  it("rejects nested root files and duplicate central-directory names", () => {
    expect(() => parseImportZip(archive({}, { "nested/figure.png": PNG }))).toThrow("archive root");
    const duplicate = editCentral(archive({}, { "figure1.png": PNG, "figure2.png": PNG }), (copy, offset, name) => {
      if (name === "figure2.png") copy.write("figure1.png", offset + 46);
    });
    // adm-zip may reject the duplicate itself before the parser's own check.
    expect(() => parseImportZip(duplicate)).toThrow(BadRequestException);
  });
});
