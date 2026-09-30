import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { Readable, Transform } from "stream";
import { degrees, PDFDocument, PDFEmbeddedPage, PDFPage, rgb } from "pdf-lib";

/**
 * Stamps a buyer's own details on every page of a PDF, so a copy that leaks
 * names the person it was sold to. The text is drawn as vector outlines, not
 * as a font: Persian needs its letters joined (shaping), which pdf-lib cannot
 * do, so HarfBuzz shapes each line and the glyph outlines are drawn as paths.
 * That also means the stamp cannot be found or replaced as text in the file.
 */

export interface WatermarkStamp {
  /** The buyer's name as their profile gives it, if they have filled it in. */
  name: string | null;
  /** The buyer's phone number, as their account knows it. */
  phone: string;
  /** Jalali date the copy was made, already formatted. */
  date: string;
  /** Short code tying this copy to one buyer and one document. */
  copyCode: string;
}

interface ShapedLine {
  path: string;
  /** Advance width in font units. */
  width: number;
}

type HarfBuzz = {
  createBlob(data: ArrayBuffer | Uint8Array): { destroy(): void };
  createFace(blob: unknown, index: number): { upem: number; destroy(): void };
  createFont(face: unknown): { glyphToPath(glyph: number): string; destroy(): void };
  createBuffer(): {
    addText(text: string): void;
    setDirection(direction: "ltr" | "rtl"): void;
    guessSegmentProperties(): void;
    json(): { g: number; ax: number; dx: number; dy: number }[];
    destroy(): void;
  };
  shape(font: unknown, buffer: unknown): void;
};

const FONT_PATH = join(__dirname, "..", "..", "..", "assets", "fonts", "Vazirmatn-Bold.ttf");
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toPersianDigits = (value: string) => value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);

/** Loaded once per process: the shaper and the font never change. */
let shaper: Promise<{ shape: (text: string, direction: "ltr" | "rtl") => ShapedLine; upem: number }> | null = null;

function getShaper() {
  if (!shaper) {
    shaper = (async () => {
      // harfbuzzjs 0.x is CommonJS and resolves to the ready module.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const hb = (await require("harfbuzzjs")) as HarfBuzz;
      const blob = hb.createBlob(readFileSync(FONT_PATH));
      const face = hb.createFace(blob, 0);
      const font = hb.createFont(face);
      const shape = (text: string, direction: "ltr" | "rtl"): ShapedLine => {
        const buffer = hb.createBuffer();
        buffer.addText(text);
        buffer.setDirection(direction);
        buffer.guessSegmentProperties();
        hb.shape(font, buffer);
        let pen = 0;
        const parts: string[] = [];
        for (const glyph of buffer.json()) {
          const outline = font.glyphToPath(glyph.g);
          if (outline) {
            const offsetX = pen + glyph.dx;
            let index = 0;
            // Font outlines point y up; SVG paths, which pdf-lib draws, point y down.
            parts.push(
              outline.replace(/-?\d+(?:\.\d+)?/g, (number) => {
                const value = Number(number);
                const moved = index % 2 === 0 ? value + offsetX : -(value + glyph.dy);
                index += 1;
                return String(Math.round(moved * 10) / 10);
              }),
            );
          }
          pen += glyph.ax;
        }
        buffer.destroy();
        return { path: parts.join(""), width: pen };
      };
      return { shape, upem: face.upem };
    })();
  }
  return shaper;
}

const INK = rgb(0.04, 0.35, 0.3);
const MUTED = rgb(0.3, 0.33, 0.37);

/** Draws a run of shaped lines centred on (cx, cy), rotated by `angle` degrees. */
function drawCentred(page: PDFPage, lines: { line: ShapedLine; size: number }[], cx: number, cy: number, angle: number, upem: number, opacity: number) {
  const theta = (angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const lineGap = 1.35;
  const total = lines.reduce((sum, item) => sum + item.size * lineGap, 0);
  let offsetY = total / 2 - lines[0].size;
  for (const { line, size } of lines) {
    const scale = size / upem;
    const halfWidth = (line.width * scale) / 2;
    // The baseline start, placed so the line's middle sits on the centre
    // after rotating about that start point.
    const x = cx - halfWidth * cos + offsetY * -sin;
    const y = cy - halfWidth * sin + offsetY * cos;
    page.drawSvgPath(line.path, { x, y, scale, rotate: degrees(angle), color: INK, opacity });
    offsetY -= size * lineGap;
  }
}

/** Returns a copy of `original` with the stamp on every page. */
export async function watermarkPdf(original: Uint8Array, stamp: WatermarkStamp): Promise<Uint8Array> {
  const { shape, upem } = await getShaper();
  const doc = await PDFDocument.load(original, { updateMetadata: false });

  const who = stamp.name?.trim() || "خریدار";
  const phone = toPersianDigits(stamp.phone);
  const nameLine = shape(who, "rtl");
  const detailLine = shape(`${phone} · ${toPersianDigits(stamp.date)} · kunkurcomputer.ir`, "ltr");
  const footerLabel = shape(`نسخهٔ شخصی ${who}`, "rtl");
  const footerDetail = shape(`${phone} · ${stamp.copyCode}`, "ltr");

  // The stamp is drawn once per distinct page size, into a scratch document,
  // and every page of that size then shows the same embedded copy. Drawing the
  // outlines on each page instead put six large paths in every page: a
  // several-hundred-page handout took hundreds of MB of RAM to stamp, which the
  // small production server could not spare.
  const scratch = await PDFDocument.create();
  const stamps = new Map<string, PDFEmbeddedPage>();
  const stampFor = async (width: number, height: number) => {
    const key = `${width}x${height}`;
    const cached = stamps.get(key);
    if (cached) return cached;
    const page = scratch.addPage([width, height]);
    const big = Math.max(18, Math.min(width, height) / 16);
    // Two diagonal stamps, so neither half of a page can be cut away clean.
    for (const fraction of [0.3, 0.72]) {
      drawCentred(page, [{ line: nameLine, size: big }, { line: detailLine, size: big * 0.55 }], width / 2, height * fraction, 32, upem, 0.11);
    }
    // A small, legible line along the foot of the page.
    const small = Math.max(6.5, Math.min(width, height) / 70);
    const scale = small / upem;
    const gap = small * 0.8;
    const labelWidth = footerLabel.width * scale;
    const detailWidth = footerDetail.width * scale;
    const right = width / 2 + (labelWidth + gap + detailWidth) / 2;
    page.drawSvgPath(footerLabel.path, { x: right - labelWidth, y: small * 2.2, scale, color: MUTED, opacity: 0.75 });
    page.drawSvgPath(footerDetail.path, { x: right - labelWidth - gap - detailWidth, y: small * 2.2, scale, color: MUTED, opacity: 0.75 });
    const embedded = await doc.embedPage(page);
    stamps.set(key, embedded);
    return embedded;
  };

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const stamp = await stampFor(width, height);
    page.drawPage(stamp, { x: 0, y: 0, width, height });
  }

  doc.setSubject(`Licensed copy ${stamp.copyCode} for ${stamp.phone}`);
  doc.setKeywords([stamp.copyCode, "kunkurcomputer.ir"]);
  doc.setProducer("kunkurcomputer.ir");
  return doc.save();
}

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
