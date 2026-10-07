// Turns the owner's local past-exam bank into question.v2 import zips, one
// per exam and year, for /admin/import. Re-runnable: external ids come from
// exam code, year, booklet and number, so a rebuilt zip revises the same
// questions instead of adding new ones.
//
//   node build.mjs <bank-root> <out-dir> [year ...]
//
// <bank-root> is the folder whose `outputs/unified_question_bank/active_questions.jsonl`
// holds both master's banks -- computer engineering (1277, exam_track "ce")
// and IT (1276, exam_track "it") -- and whose image paths the bank records
// (e.g. C:\Users\Error\Documents\Codex\2026-10-03\new-chat). The two tracks
// were built separately and store a few fields under different names; each
// record is read into one shape first. Nothing here touches the database:
// the zips go through import review.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLES } from "./samples.mjs";

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
const BANK = "outputs/unified_question_bank/active_questions.jsonl";

const TRACKS = {
  ce: { code: "1277", major: "computer-engineering" },
  it: { code: "1276", major: "information-technology" },
};

/** The bank's own subject names → the site's subject codes. A subject is
 * imported when it is in the 1406 master's exam of either track (1276 or
 * 1277); the ones 1406 dropped (circuits, signals, general maths, compilers,
 * IT management, software engineering, ...) stay in the archive. */
const SUBJECTS = {
  "زبان عمومی و تخصصی (انگلیسی)": "english",
  "ساختمان داده و طراحی الگوریتم": "data-structures-algorithms",
  "ساختمان داده‌ها و طراحی الگوریتم": "data-structures-algorithms",
  // IT booklets before the two were merged printed them apart.
  "ساختمان داده‌ها": "data-structures-algorithms",
  "طراحی الگوریتم": "data-structures-algorithms",
  "هوش مصنوعی": "artificial-intelligence",
  "مدار منطقی": "digital-logic",
  "معماری کامپیوتر": "computer-architecture",
  "پایگاه داده‌ها": "databases",
  "پایگاه داده": "databases",
  "اصول طراحی پایگاه داده‌ها": "databases",
  "سیستم‌های عامل": "operating-systems",
  "آمار و احتمال مهندسی": "statistics",
  "ریاضیات گسسته": "discrete-math",
  "نظریه زبان‌ها و ماشین‌ها": "automata",
  "شبکه‌های کامپیوتری": "computer-networks",
};

/** Text compared with the original page image. */
const TEXT_CHECKED = new Set([
  "original_image_compared_and_repaired",
  "original_image_compared",
  "previous_original_image_repair",
  "source_image_compared_verified",
]);
/** Key checked against the key source by eye; every other match (OCR table,
 * folder pairing) waits for the owner in the review queue. */
const KEY_CHECKED = new Set([
  "matched_key_source_visually_crosschecked",
  "matched_to_1277C_jpg_visual_transcription",
  "source_bubble_key_visually_rechecked",
  "final_letter_session_subject_visually_matched",
  "matching_booklet_source_checked",
  "matched135A_single_key_with_final_special_corrections_overlay",
  "final_key_deleted_user_confirmed_question_number_mapping",
]);

/** Answer stages that come from an initial key, not a final one. */
const INITIAL_STAGES = new Set(["user_confirmed_initial_key", "initial_fallback_final_row_absent", "initial_key_with_final_scoring_label"]);

const MAX_IMAGE_WIDTH = 1100;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** The two tracks' records in one shape. */
function normalise(record) {
  const track = TRACKS[record.exam_track];
  const it = record.exam_track === "it";
  // IT keeps the key as a number, or a list for several accepted answers and
  // an empty list for a deleted question; CE keeps a number plus accepted_options.
  const rawAnswer = record.answer;
  const listed = Array.isArray(rawAnswer)
    ? rawAnswer
    : Array.isArray(record.accepted_options) && record.accepted_options.length
      ? record.accepted_options
      : [rawAnswer];
  const accepted = [...new Set(listed)].filter((n) => [1, 2, 3, 4].includes(n));
  const correct = Array.isArray(rawAnswer) ? accepted[0] : rawAnswer;
  const figures = it ? [record.source_figure_crop, record.source_table_crop].filter(Boolean) : record.figure_paths ?? [];
  const stage = String(record.answer_stage ?? "");
  return {
    track: record.exam_track,
    code: track?.code ?? String(record.exam_code ?? ""),
    major: track?.major ?? "computer-engineering",
    year: record.year,
    booklet: Number.isInteger(record.booklet_number) && record.booklet_number > 0 ? record.booklet_number : undefined,
    bookletLabel: it ? String(record.booklet_code ?? "b0").replace(/[^A-Za-z0-9]/g, "") || "b0" : `b${record.booklet_number ?? 0}`,
    number: record.question_number,
    section: record.subject,
    subjectName: record.subject_specific,
    stem: String((it ? record.stem : record.stem_text) ?? "").trim(),
    options: record.options ?? [],
    correct,
    accepted,
    deleted: Boolean(record.answer_deleted) || (Array.isArray(rawAnswer) && rawAnswer.length === 0),
    textVerified: TEXT_CHECKED.has(record.content_review_status),
    keyVerified: KEY_CHECKED.has(record.answer_key_status),
    // Only stages that say the answer comes from an initial key; a key
    // "without a printed initial or final heading" is not one.
    initialKey: Boolean(record.answer_finality_review_pending) || INITIAL_STAGES.has(stage),
    notes: [record.content_review_status, record.answer_key_status, stage].filter(Boolean),
    crop: it ? record.source_question_crop : record.question_source_crop?.path,
    figures,
    passage: String(record.shared_context_ocr ?? "").trim(),
    passageId: record.shared_context_id,
    page: record.source_page,
    archivePath: record.archive_path,
    docId: record.doc_id,
  };
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

function skipReason(q) {
  if (!q.code) return "رشته یا کد کنکور ثبت نشده";
  if (!q.subjectName) return "درس جزئی ثبت نشده";
  if (!SUBJECTS[q.subjectName]) return `درس «${q.subjectName}» در کنکور ۱۴۰۶ نیست`;
  if (q.options.length !== 4 || q.options.some((option) => !String(option.text ?? "").trim())) return "ساختار گزینه‌ها کامل نیست";
  // A cloze question of the reading section has no stem of its own: its
  // blank is numbered inside the shared passage.
  if (!q.stem && !q.passage) return "متن سؤال خالی است";
  if (q.deleted) return "سؤال در کلید نهایی حذف شده";
  if (![1, 2, 3, 4].includes(q.correct)) return "کلید ندارد";
  return null;
}

const bankFile = path.join(bankRoot, BANK);
const generatedAt = (await stat(bankFile)).mtime.toISOString();
const questions = (await readFile(bankFile, "utf8"))
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => normalise(JSON.parse(line)))
  .filter((q) => onlyYears.size === 0 || onlyYears.has(q.year));

await mkdir(outDir, { recursive: true });
const report = { generated_at: new Date().toISOString(), bank_modified_at: generatedAt, exams: {} };
const seenIds = new Set();
/** Samples found in the bank; any left over means a curated id no longer matches. */
const usedSamples = new Set();
/** Each exam-year's items and files, kept to pack the first-import bundles. */
const built = [];

const examYears = [...new Set(questions.map((q) => `${q.code}:${q.year}`))].sort();
for (const examYear of examYears) {
  const [code, yearText] = examYear.split(":");
  const year = Number(yearText);
  const zip = new AdmZip();
  const items = [];
  const files = new Map();
  const summary = { records: 0, imported: 0, checked: 0, unchecked: 0, initial_key: 0, skipped: {} };

  for (const q of questions.filter((item) => item.code === code && item.year === year)) {
    summary.records += 1;
    const reason = skipReason(q);
    if (reason) {
      summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
      continue;
    }
    // 1389 held two sessions that both numbered from 1; the second session's
    // questions keep the base id plus their source document.
    let externalId = `kunkurcomputer-q-${code}-${year}-${q.bookletLabel}-${String(q.number).padStart(3, "0")}`;
    if (seenIds.has(externalId)) externalId = `${externalId}-${String(q.docId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-6)}`;
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
    for (const [index, figure] of q.figures.entries()) {
      const image = await imageAsset(figure, `fig${index + 1}`);
      if (image) {
        addFile(image);
        figureKeys.set(path.basename(figure), image.asset.media_key);
      }
    }
    const crop = q.crop ? await imageAsset(q.crop, "source") : null;
    if (crop) addFile(crop);

    // A curated sample carries its worked solution, and must reach the key.
    const curated = SAMPLES[externalId];
    if (curated) {
      if (curated.answer !== q.correct) throw new Error(`${externalId}: the solution reaches option ${curated.answer}, the key says ${q.correct}`);
      if (!q.textVerified || !q.keyVerified || q.initialKey) throw new Error(`${externalId}: a sample needs a checked text and a final, checked key`);
      usedSamples.add(externalId);
    }
    const notes = [
      ...q.notes,
      ...(q.initialKey ? ["کلید اولیه؛ کلید نهایی هنوز اعمال نشده"] : []),
      ...(curated ? ["راه‌حل تشریحی: نوشتهٔ Claude و هم‌خوان با کلید؛ بازبینی مالک لازم است"] : []),
    ];
    const passageKey = q.passageId ? String(q.passageId).replace(/[^A-Za-z0-9-]/g, "") : sha256(String(q.docId) + q.passage).slice(0, 12);
    const item = {
      schema_version: "question.v2",
      external_id: externalId,
      exam: { degree: "master", major: q.major, year, code },
      slot: { ...(q.booklet ? { booklet: q.booklet } : {}), number: q.number, ...(q.section ? { section: q.section } : {}) },
      subject_code: SUBJECTS[q.subjectName],
      topic_codes: curated?.topics ?? [],
      ...(q.passage ? { passage: { external_id: `kunkurcomputer-passage-${code}-${year}-${passageKey}`, blocks: [{ type: "text", text: q.passage }] } } : {}),
      stem_blocks: q.stem ? stemBlocks(q.stem, figureKeys) : [{ type: "text", text: `(${q.number})` }, ...stemBlocks("", figureKeys)],
      options: q.options.map((option) => ({ number: option.number, blocks: [{ type: "text", text: String(option.text).trim() }] })),
      correct_option: q.correct,
      ...(q.accepted.length > 1 && q.accepted.includes(q.correct) ? { accepted_options: q.accepted } : {}),
      solution_blocks: curated?.solution ?? [],
      review: { text_verified: q.textVerified, key_verified: q.keyVerified, notes },
      ...(curated ? { sample: true } : {}),
      assets,
      source: {
        ...(q.page ? { page: q.page } : {}),
        question_number: q.number,
        ...(q.booklet ? { booklet: q.booklet } : {}),
        archive_path: q.archivePath,
        ...(crop ? { crop_media_key: "source" } : {}),
      },
      provenance: {
        producer_type: "ocr",
        producer_name: "mistral-ocr-latest + owner review",
        source_artifact: q.archivePath,
        generated_at: generatedAt,
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
    if (q.textVerified && q.keyVerified) summary.checked += 1;
    else summary.unchecked += 1;
    if (q.initialKey) summary.initial_key += 1;
  }

  report.exams[examYear] = summary;
  if (items.length === 0) continue;
  built.push({ code, year, items, files });
  zip.addFile("payload.json", Buffer.from(JSON.stringify(items)));
  for (const [name, buffer] of files) zip.addFile(name, buffer);
  const out = path.join(outDir, `questions-${code}-${year}.zip`);
  zip.writeZip(out);
  const size = zip.toBuffer().length;
  summary.zip_bytes = size;
  if (size > 50 * 1024 * 1024 || files.size + 1 > 1000) summary.warning = "zip exceeds the importer limits (50 MB / 1000 entries)";
}

// The first import, in as few uploads as the importer allows: whole years of
// one exam packed together while a bundle stays under 1000 entries/items and
// 25 MB: the import page sends the file in one request, and the CDN in front
// of the site has cut single uploads much past 40 MB.
const bundles = [];
for (const exam of built) {
  const bytes = [...exam.files.values()].reduce((sum, buffer) => sum + buffer.length, 0);
  const last = bundles[bundles.length - 1];
  if (last && last.code === exam.code && last.entries + exam.files.size + 1 <= 999 && last.items.length + exam.items.length <= 1000 && last.bytes + bytes <= 25 * 1024 * 1024) {
    last.items.push(...exam.items);
    for (const [name, buffer] of exam.files) last.files.set(name, buffer);
    last.entries += exam.files.size;
    last.bytes += bytes;
    last.years.push(exam.year);
  } else {
    bundles.push({ code: exam.code, items: [...exam.items], files: new Map(exam.files), entries: exam.files.size + 1, bytes, years: [exam.year] });
  }
}
report.bundles = [];
for (const bundle of bundles) {
  const zip = new AdmZip();
  zip.addFile("payload.json", Buffer.from(JSON.stringify(bundle.items)));
  for (const [name, buffer] of bundle.files) zip.addFile(name, buffer);
  const name = `bundle-${bundle.code}-${bundle.years[0]}-${bundle.years[bundle.years.length - 1]}.zip`;
  zip.writeZip(path.join(outDir, name));
  report.bundles.push({ name, code: bundle.code, years: bundle.years, questions: bundle.items.length, entries: bundle.files.size + 1 });
  console.log(`${name}: ${bundle.items.length} questions, ${bundle.files.size + 1} entries, ${(zip.toBuffer().length / 1048576).toFixed(1)} MB`);
}

const missingSamples = Object.keys(SAMPLES).filter((id) => !usedSamples.has(id));
if (missingSamples.length && onlyYears.size === 0) throw new Error(`curated samples not in the bank: ${missingSamples.join(", ")}`);
report.samples = usedSamples.size;
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
const totals = {};
for (const [examYear, s] of Object.entries(report.exams)) {
  const code = examYear.split(":")[0];
  totals[code] ??= { records: 0, imported: 0, checked: 0, unchecked: 0, initial_key: 0 };
  for (const key of Object.keys(totals[code])) totals[code][key] += s[key];
  console.log(`${examYear}: ${s.imported}/${s.records} (checked ${s.checked}, review ${s.unchecked}, initial key ${s.initial_key})${s.zip_bytes ? ` ${(s.zip_bytes / 1048576).toFixed(1)} MB` : ""}${s.warning ? ` ⚠ ${s.warning}` : ""}`);
}
console.log("totals", JSON.stringify(totals));
