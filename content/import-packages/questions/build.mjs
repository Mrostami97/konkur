// Turns the owner's local past-exam bank (questions.jsonl from the OCR and
// review work) into question.v2 import zips, one per exam year, for
// /admin/import. Re-runnable: external ids come from year, booklet and number,
// so a rebuilt zip revises the same questions instead of adding new ones.
//
//   node build.mjs <bank-root> <out-dir> [year ...]
//
// <bank-root> is the folder whose `outputs/question_bank/active_questions.jsonl`
// (the owner's release scope: 1389 onward, text compared with the original)
// and image paths the bank records (e.g. C:\Users\Error\Documents\Codex\2026-10-03\new-chat).
// Nothing here touches the database: the zips go through import review.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const AdmZip = createRequire(`${repo}apps/api/package.json`)("adm-zip");
const sharp = createRequire(`${repo}apps/web/package.json`)("sharp");
const { validateQuestion } = createRequire(`${repo}apps/api/package.json`)("@konkurcom/contracts");

const [bankRoot, outDir, ...yearArgs] = process.argv.slice(2);
if (!bankRoot || !outDir) {
  console.error("usage: node build.mjs <bank-root> <out-dir> [year ...]");
  process.exit(1);
}
const onlyYears = new Set(yearArgs.map(Number));

/** The bank's own subject names → the site's subject codes. Subjects the
 * 1406 exam dropped, and ones the site has no page for, stay in the archive. */
const SUBJECTS = {
  "زبان عمومی و تخصصی (انگلیسی)": "english",
  "ساختمان داده و طراحی الگوریتم": "data-structures-algorithms",
  "هوش مصنوعی": "artificial-intelligence",
  "مدار منطقی": "digital-logic",
  "معماری کامپیوتر": "computer-architecture",
  "پایگاه داده‌ها": "databases",
  "پایگاه داده": "databases",
  "سیستم‌های عامل": "operating-systems",
  "آمار و احتمال مهندسی": "statistics",
  "ریاضیات گسسته": "discrete-math",
  "نظریه زبان‌ها و ماشین‌ها": "automata",
  "شبکه‌های کامپیوتری": "computer-networks",
};

/** Text compared with the original page image. */
const TEXT_CHECKED = new Set(["original_image_compared_and_repaired", "original_image_compared", "previous_original_image_repair"]);
/** Key checked against the key source by eye; every other match (OCR table,
 * folder pairing) waits for the owner in the review queue. */
const KEY_CHECKED = new Set([
  "matched_key_source_visually_crosschecked",
  "matched_to_1277C_jpg_visual_transcription",
  "source_bubble_key_visually_rechecked",
  "final_letter_session_subject_visually_matched",
]);

const MAX_IMAGE_WIDTH = 1100;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** A booklet crop or figure as a modest JPEG/PNG the importer accepts. */
async function imageAsset(relPath, mediaKey) {
  const file = path.join(bankRoot, relPath);
  if (!existsSync(file)) return null;
  const input = sharp(await readFile(file));
  const meta = await input.metadata();
  const png = meta.format === "png";
  let pipeline = input.rotate();
  if ((meta.width ?? 0) > MAX_IMAGE_WIDTH) pipeline = pipeline.resize({ width: MAX_IMAGE_WIDTH });
  const buffer = png ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer() : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  const ext = png ? "png" : "jpg";
  const checksum = sha256(buffer);
  return {
    asset: { media_key: mediaKey, filename: `${checksum.slice(0, 16)}.${ext}`, mime_type: png ? "image/png" : "image/jpeg", checksum: `sha256:${checksum}` },
    buffer,
  };
}

/** Stem text with `![name](name)` markers becomes text and image blocks;
 * figures the text never mentions follow the stem. */
function stemBlocks(text, figureKeys) {
  const blocks = [];
  const used = new Set();
  const marker = /!\[[^\]]*\]\(([^)]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(marker)) {
    const before = text.slice(last, match.index).trim();
    if (before) blocks.push({ type: "text", text: before });
    const key = figureKeys.get(path.basename(match[1]));
    if (key) {
      blocks.push({ type: "image", media_key: key });
      used.add(key);
    }
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) blocks.push({ type: "text", text: rest });
  for (const key of figureKeys.values()) if (!used.has(key)) blocks.push({ type: "image", media_key: key });
  return blocks;
}

function skipReason(record) {
  if (!record.subject_specific) return "درس جزئی ثبت نشده";
  if (!SUBJECTS[record.subject_specific]) return `درس «${record.subject_specific}» در سایت یا کنکور ۱۴۰۶ نیست`;
  if ((record.options ?? []).length !== 4 || record.options.some((option) => !String(option.text ?? "").trim())) return "ساختار گزینه‌ها کامل نیست";
  // A cloze question of the reading section has no stem of its own: its
  // blank is numbered inside the shared passage.
  if (!String(record.stem_text ?? "").trim() && !String(record.shared_context_ocr ?? "").trim()) return "متن سؤال خالی است";
  if (record.answer_deleted) return "سؤال در کلید نهایی حذف شده";
  if (![1, 2, 3, 4].includes(record.answer)) return "کلید ندارد";
  return null;
}

const generatedAt = JSON.parse(await readFile(path.join(bankRoot, "outputs/question_bank/manifest.json"), "utf8")).generated_at;
const records = (await readFile(path.join(bankRoot, "outputs/question_bank/active_questions.jsonl"), "utf8"))
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
  .filter((record) => onlyYears.size === 0 || onlyYears.has(record.year));

await mkdir(outDir, { recursive: true });
const report = { generated_at: new Date().toISOString(), bank_generated_at: generatedAt, years: {} };
const seenIds = new Set();
/** Each year's items and files, kept to pack the first-import bundles. */
const built = [];

for (const year of [...new Set(records.map((record) => record.year))].sort()) {
  const zip = new AdmZip();
  const items = [];
  const files = new Map();
  const summary = { records: 0, imported: 0, checked: 0, unchecked: 0, skipped: {} };

  for (const record of records.filter((r) => r.year === year)) {
    summary.records += 1;
    const reason = skipReason(record);
    if (reason) {
      summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
      continue;
    }
    const booklet = record.booklet_number ?? 0;
    const externalId = `kunkurcomputer-q-${record.exam_code}-${year}-b${booklet}-${String(record.question_number).padStart(3, "0")}`;
    if (seenIds.has(externalId)) {
      summary.skipped["شمارهٔ تکراری در دفترچه"] = (summary.skipped["شمارهٔ تکراری در دفترچه"] ?? 0) + 1;
      continue;
    }
    seenIds.add(externalId);

    const assets = [];
    const addFile = ({ asset, buffer }) => {
      assets.push(asset);
      files.set(asset.filename, buffer);
    };
    const figureKeys = new Map();
    for (const [index, figure] of (record.figure_paths ?? []).entries()) {
      const image = await imageAsset(figure, `fig${index + 1}`);
      if (image) {
        addFile(image);
        figureKeys.set(path.basename(figure), image.asset.media_key);
      }
    }
    const crop = record.question_source_crop?.path ? await imageAsset(record.question_source_crop.path, "source") : null;
    if (crop) addFile(crop);

    const textVerified = TEXT_CHECKED.has(record.content_review_status);
    const keyVerified = KEY_CHECKED.has(record.answer_key_status);
    const accepted = Array.isArray(record.accepted_options) ? [...new Set(record.accepted_options)].filter((n) => [1, 2, 3, 4].includes(n)) : [];
    const passageText = String(record.shared_context_ocr ?? "").trim();

    const item = {
      schema_version: "question.v2",
      external_id: externalId,
      exam: { degree: "master", major: "computer-engineering", year, code: String(record.exam_code) },
      slot: { ...(record.booklet_number ? { booklet: record.booklet_number } : {}), number: record.question_number, ...(record.subject ? { section: record.subject } : {}) },
      subject_code: SUBJECTS[record.subject_specific],
      topic_codes: [],
      ...(passageText
        ? { passage: { external_id: `kunkurcomputer-passage-${record.exam_code}-${year}-${sha256(record.doc_id + passageText).slice(0, 12)}`, blocks: [{ type: "text", text: passageText }] } }
        : {}),
      stem_blocks: String(record.stem_text ?? "").trim()
        ? stemBlocks(String(record.stem_text), figureKeys)
        : [{ type: "text", text: `(${record.question_number})` }, ...stemBlocks("", figureKeys)],
      options: record.options.map((option) => ({ number: option.number, blocks: [{ type: "text", text: String(option.text).trim() }] })),
      correct_option: record.answer,
      ...(accepted.length > 1 && accepted.includes(record.answer) ? { accepted_options: accepted } : {}),
      solution_blocks: [],
      review: {
        text_verified: textVerified,
        key_verified: keyVerified,
        notes: [record.content_review_status, record.answer_key_status].filter(Boolean),
      },
      assets,
      source: {
        ...(record.source_page ? { page: record.source_page } : {}),
        question_number: record.question_number,
        ...(record.booklet_number ? { booklet: record.booklet_number } : {}),
        archive_path: record.archive_path,
        ...(crop ? { crop_media_key: "source" } : {}),
      },
      provenance: {
        producer_type: "ocr",
        producer_name: "mistral-ocr-latest + owner review",
        source_artifact: record.archive_path,
        generated_at: new Date(`${generatedAt}T00:00:00Z`).toISOString(),
      },
    };

    const validation = validateQuestion(item);
    if (!validation.valid) {
      const key = `نامعتبر: ${validation.errors[0]}`;
      summary.skipped[key] = (summary.skipped[key] ?? 0) + 1;
      continue;
    }
    items.push(item);
    summary.imported += 1;
    if (textVerified && keyVerified) summary.checked += 1;
    else summary.unchecked += 1;
  }

  report.years[year] = summary;
  if (items.length === 0) continue;
  built.push({ year, items, files });
  zip.addFile("payload.json", Buffer.from(JSON.stringify(items)));
  for (const [name, buffer] of files) zip.addFile(name, buffer);
  const out = path.join(outDir, `questions-1277-${year}.zip`);
  zip.writeZip(out);
  const size = zip.toBuffer().length;
  summary.zip_bytes = size;
  if (size > 50 * 1024 * 1024 || files.size + 1 > 1000) summary.warning = "zip exceeds the importer limits (50 MB / 1000 entries)";
}

// The first import, in as few uploads as the importer allows: whole years
// packed together while a bundle stays under 1000 entries/items and 45 MB.
const bundles = [];
for (const year of built) {
  const bytes = [...year.files.values()].reduce((sum, buffer) => sum + buffer.length, 0);
  const last = bundles[bundles.length - 1];
  if (last && last.entries + year.files.size + 1 <= 999 && last.items.length + year.items.length <= 1000 && last.bytes + bytes <= 45 * 1024 * 1024) {
    last.items.push(...year.items);
    for (const [name, buffer] of year.files) last.files.set(name, buffer);
    last.entries += year.files.size;
    last.bytes += bytes;
    last.years.push(year.year);
  } else {
    bundles.push({ items: [...year.items], files: new Map(year.files), entries: year.files.size + 1, bytes, years: [year.year] });
  }
}
report.bundles = [];
for (const bundle of bundles) {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(bundle.items)));
  for (const [name, buffer] of bundle.files) zip.addFile(name, buffer);
  const name = `bundle-${bundle.years[0]}-${bundle.years[bundle.years.length - 1]}.zip`;
  zip.writeZip(path.join(outDir, name));
  report.bundles.push({ name, years: bundle.years, questions: bundle.items.length, entries: bundle.files.size + 1 });
  console.log(`${name}: ${bundle.items.length} questions, ${bundle.files.size + 1} entries, ${(zip.toBuffer().length / 1048576).toFixed(1)} MB`);
}

await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
let totals = { records: 0, imported: 0, checked: 0, unchecked: 0 };
for (const [year, s] of Object.entries(report.years)) {
  for (const key of Object.keys(totals)) totals[key] += s[key];
  console.log(`${year}: ${s.imported}/${s.records} (checked ${s.checked}, review ${s.unchecked})${s.zip_bytes ? ` ${(s.zip_bytes / 1048576).toFixed(1)} MB` : ""}${s.warning ? ` ⚠ ${s.warning}` : ""}`);
}
console.log("total", totals);
