// Builds the two key images of the 1405 computer-engineering master's exam
// for the site, into <bank>/outputs/1405/site_assets:
//  - key-1405-initial-135A.png: Sanjesh's initial key for booklet 135A, as published.
//  - key-1405-final-135B.png: the final key for booklet 135B. Our only copy is a
//    candidate's result sheet, so only the «question» and «key» columns are kept
//    and joined; the candidate's name, number and own answers are left out.
// Run: node content/import-packages/analysis/key_images_1405.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const sharp = require("sharp");
const BANK = process.env.KONKUR_BANK_ROOT ?? "C:/Users/Error/Documents/Codex/2026-10-03/new-chat";
const SRC = path.join(BANK, "outputs/1405");
export const OUT = path.join(SRC, "site_assets");
mkdirSync(OUT, { recursive: true });

// Column edges and row ranges measured from the sheet's grid lines.
const PAGE1 = path.join(SRC, "final_key/page_1.png");
const PAGE2 = path.join(SRC, "final_key/page_2.png");
const tables = [
  { file: PAGE1, key: [827, 869], number: [954, 1058], y: [166, 1282] }, // 1-30
  { file: PAGE1, key: [448, 614], number: [695, 795], y: [166, 1282] }, // 31-60
  { file: PAGE1, key: [185, 235], number: [316, 416], y: [166, 1282] }, // 61-90
  { file: PAGE2, key: [827, 877], number: [958, 1058], y: [1, 938] }, // 91-115
];

const PAD = 28;
const GAP = 30;
const parts = [];
for (const t of tables) {
  const height = t.y[1] - t.y[0];
  const cut = (x) => sharp(t.file).extract({ left: x[0], top: t.y[0], width: x[1] - x[0], height }).png().toBuffer();
  parts.push({ key: await cut(t.key), number: await cut(t.number), keyWidth: t.key[1] - t.key[0], numberWidth: t.number[1] - t.number[0], height });
}
const width = PAD * 2 + parts.reduce((sum, p) => sum + p.keyWidth + p.numberWidth, 0) + GAP * (parts.length - 1);
const height = PAD * 2 + Math.max(...parts.map((p) => p.height));
// Right to left, as on the sheet: the number column right, its key to its left.
const layers = [];
let right = width - PAD;
for (const p of parts) {
  layers.push({ input: p.number, left: right - p.numberWidth, top: PAD });
  layers.push({ input: p.key, left: right - p.numberWidth - p.keyWidth, top: PAD });
  right -= p.numberWidth + p.keyWidth + GAP;
}
await sharp({ create: { width, height, channels: 3, background: "#ffffff" } }).composite(layers).png({ compressionLevel: 9 }).toFile(path.join(OUT, "key-1405-final-135B.png"));
await sharp(path.join(SRC, "key_135A/page_1.png")).png({ compressionLevel: 9 }).toFile(path.join(OUT, "key-1405-initial-135A.png"));
console.log(`written to ${OUT} (${width}x${height})`);
