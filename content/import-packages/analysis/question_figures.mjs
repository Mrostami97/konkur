// Cuts the figure of each solved 1404/1405 question out of the booklet, so an
// article shows the question's text as text and only its drawing as an image
// (the owner cannot edit text inside an image). Source: the bank's per-block
// crops (outputs/content_review/source_crops/<doc>-q-NNNN-pPP-bBB-image.png);
// a few carry a stray line of the neighbouring text, trimmed or painted white
// here. Output: <bank>/outputs/<year>/site_assets/figures/qNNN-K.png, which
// lib/solutions-YYYY-data.mjs and questions/verified.mjs reference.
// Run: node content/import-packages/analysis/question_figures.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(new URL("../../../apps/web/package.json", import.meta.url));
const sharp = require("sharp");
const BANK = process.env.KONKUR_BANK_ROOT ?? "C:/Users/Error/Documents/Codex/2026-10-03/new-chat";
const CROPS = path.join(BANK, "outputs/content_review/source_crops");
const DOCS = { 1405: "doc-0d6b4ac841e02bf1", 1404: "doc-aa34d7e9ba352ebc" };

/**
 * year → question → figures in display order. `trim`: fractions cut from each
 * side; `white`: [x, y, w, h] fractions painted white (stray text); `caption`:
 * shown under the figure (the option a drawing stands for).
 */
export const FIGURES = {
  1405: {
    46: [{ block: "p10-b16" }],
    76: [{ block: "p16-b8", caption: "نمودار ۱" }, { block: "p16-b7", caption: "نمودار ۲" }, { block: "p16-b10", caption: "نمودار ۳" }, { block: "p16-b9", caption: "نمودار ۴" }],
    79: [{ block: "p17-b5", trim: { top: 0.025 } }],
    80: [{ block: "p17-b13" }],
    81: [{ block: "p18-b7" }],
    82: [{ block: "p18-b13", white: [0.6, 0.9, 0.4, 0.1] }],
    89: [{ block: "p20-b9" }],
    101: [{ block: "p23-b8", trim: { right: 0.58, top: 0.06 } }],
  },
  1404: {
    43: [{ block: "p10-b17" }],
    69: [{ block: "p16-b13", white: [0.72, 0, 0.28, 0.13] }],
    73: [{ block: "p17-b12" }],
    74: [{ block: "p17-b20" }],
    77: [{ block: "p18-b19" }],
    80: [{ block: "p19-b9" }],
    81: [{ block: "p19-b15" }],
    82: [{ block: "p19-b21" }],
    85: [{ block: "p20-b14" }],
    87: [{ block: "p21-b4" }],
  },
};

export const figureFile = (year, n, k) => path.join(BANK, `outputs/${year}/site_assets/figures/q${String(n).padStart(3, "0")}-${k + 1}.png`);

async function cut(year, n, k, spec) {
  const src = path.join(CROPS, `${DOCS[year]}-q-${String(n).padStart(4, "0")}-${spec.block}-image.png`);
  const meta = await sharp(src).metadata();
  const { width: W, height: H } = meta;
  const t = { top: 0, bottom: 0, left: 0, right: 0, ...spec.trim };
  const box = { left: Math.round(t.left * W), top: Math.round(t.top * H) };
  box.width = W - box.left - Math.round(t.right * W);
  box.height = H - box.top - Math.round(t.bottom * H);
  let img = sharp(src).flatten({ background: "#ffffff" }).extract(box);
  if (spec.white) {
    const [x, y, w, h] = spec.white;
    const rect = { width: Math.round(w * box.width), height: Math.round(h * box.height) };
    const patch = await sharp({ create: { ...rect, channels: 3, background: "#ffffff" } }).png().toBuffer();
    img = sharp(await img.png().toBuffer()).composite([{ input: patch, left: Math.round(x * box.width), top: Math.round(y * box.height) }]);
  }
  const out = figureFile(year, n, k);
  mkdirSync(path.dirname(out), { recursive: true });
  await img.png({ compressionLevel: 9 }).toFile(out);
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  let count = 0;
  for (const [year, questions] of Object.entries(FIGURES)) {
    for (const [n, specs] of Object.entries(questions)) {
      for (const [k, spec] of specs.entries()) {
        await cut(Number(year), Number(n), k, spec);
        count += 1;
      }
    }
  }
  console.log(`${count} figures written`);
}
