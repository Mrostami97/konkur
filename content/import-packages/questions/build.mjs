// Turns the owner's local past-exam bank into question.v2 import zips, one
// per exam and year, for /admin/import. Re-runnable: external ids come from
// exam code, year, booklet and number, so a rebuilt zip revises the same
// questions instead of adding new ones.
//
//   node build.mjs <bank-root> <out-dir> [year ...]
//
// <bank-root> is the folder whose `outputs/unified_question_bank/active_questions.jsonl`
// holds the master's banks -- computer engineering (1277, exam_track "ce"),
// IT (1276, "it") and computer science (1209, "cs") -- and whose image paths
// the bank records (e.g. C:\Users\Error\Documents\Codex\2026-10-03\new-chat).
// The tracks were built separately and store a few fields under different
// names; each record is read into one shape first. A track missing from
// TRACKS (the PhD bank, for now) is reported and left out. Nothing here touches the database:
// the zips go through import review.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLES } from "./samples.mjs";
import { SOLUTIONS } from "./solutions.mjs";
import { NEEDS_FIGURE } from "./needs-figure.mjs";
import { TEXT_FIXES } from "./text-fixes.mjs";
import { FIGURE_PICKS } from "./figure-picks.mjs";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const AdmZip = createRequire(`${repo}apps/api/package.json`)("adm-zip");
const sharp = createRequire(`${repo}apps/web/package.json`)("sharp");
const { validateQuestion } = createRequire(`${repo}apps/api/package.json`)("@konkurcom/contracts");

import { VERIFIED, VERIFIED_ONLY } from "./verified.mjs";
import { TREE, isOutside1406, subjectOf, topicOf } from "./taxonomy-1406.mjs";

const [bankRoot, outDir, ...restArgs] = process.argv.slice(2);
if (!bankRoot || !outDir) {
  console.error("usage: node build.mjs <bank-root> <out-dir> [--tagged] [year ...]");
  process.exit(1);
}
// --tagged: only the questions the owner has tagged with a chapter and topic
// (chapter_topics.json), taken from the whole bank -- active, set-aside and
// supplement records alike -- placed on the 1406 syllabus tree
// (taxonomy-1406.mjs). Nothing tagged is left out: a question the final key
// deleted comes in marked as deleted, and one without an official key comes
// with our own reviewed answer, marked as ours (owner, 2026-10-18).
const TAGGED = restArgs.includes("--tagged");
const onlyYears = new Set(restArgs.filter((arg) => arg !== "--tagged").map(Number));
const BANK = TAGGED ? "outputs/unified_question_bank/questions.jsonl" : "outputs/unified_question_bank/active_questions.jsonl";
const TAGS = TAGGED
  ? new Map(JSON.parse(await readFile(path.join(bankRoot, "outputs/unified_question_bank/chapter_topics.json"), "utf8")).questions.map((tag) => [tag.question_id, tag]))
  : new Map();
// Questions of the 1406 computer-engineering subjects the owner has not tagged yet, which we checked
// word for word against the booklet crop and solved to confirm the key (owner, 2026-10-24: build the
// bank to the 1406 CE exam). Each entry is tagged like chapter_topics.json, plus `ours: true`.
if (TAGGED) {
  const ours = JSON.parse(await readFile(new URL("./our-tags.json", import.meta.url), "utf8")).questions;
  for (const tag of ours) if (!TAGS.has(tag.question_id)) TAGS.set(tag.question_id, { ...tag, ours: true });
}

const TRACKS = {
  ce: { code: "1277", major: "computer-engineering" },
  it: { code: "1276", major: "information-technology" },
  // Only the three CS subjects the owner reviewed are in the active bank:
  // data structures and algorithms, theory of computation, computer basics.
  cs: { code: "1209", major: "computer-science" },
  // The PhD booklets print their code in the subject name, e.g. «(کد ۲۳۵۵)».
  phd: { code: null, major: null, degree: "phd" },
};

const latinDigits = (text) => String(text).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

/** A PhD record's exam code and major, from its printed subject name. */
function phdExam(record) {
  const code = latinDigits(String(record.exam_subject ?? "")).match(/(\d{4})/)?.[1] ?? "";
  const subject = String(record.exam_subject ?? "");
  const major = /فناوری اطلاعات/.test(subject) ? "information-technology" : /علوم کامپیوتر/.test(subject) ? "computer-science" : "computer-engineering";
  return { code, major };
}

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
  // Computer science (1209) names the same subjects its own way.
  "ساختمان داده‌ها و الگوریتم‌ها": "data-structures-algorithms",
  "ساختمان داده و الگوریتم": "data-structures-algorithms",
  "ساختمان داده‌ها و طراحی الگوریتم‌ها": "data-structures-algorithms",
  "طراحی الگوریتم‌ها": "data-structures-algorithms",
  "نظریه اتوماتا و زبان‌ها": "automata",
  "نظریهٔ اتوماتا و زبان‌ها": "automata",
  "مبانی نظریه محاسبه": "automata",
  "مبانی نظریهٔ محاسبه": "automata",
  "مبانی کامپیوتر": "programming-fundamentals",
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

/** Crops of one kind among a CS record's source assets. */
const assetsOf = (record, kind) => (record.source_assets ?? []).filter((asset) => asset.kind === kind && asset.path).map((asset) => asset.path);

/** The tracks' records in one shape. */
function normalise(record) {
  const track = TRACKS[record.exam_track];
  const cs = record.exam_track === "cs";
  // IT and CS share one layout; CE has its own.
  const it = record.exam_track === "it" || cs;
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
  // A supplement record keeps its text under `stem` whatever its track.
  const stem = String((it ? record.stem : (record.stem_text ?? record.stem)) ?? "").trim();
  // CS keeps figures, tables and code as crops beside the question. Code is
  // usually typed into the stem as a fenced block; where it is not, the
  // original crop is shown, since OCR of code is not to be trusted.
  const figures = cs
    ? [...assetsOf(record, "original_figure_crop"), ...assetsOf(record, "original_table_crop"), ...(/```/.test(stem) ? [] : assetsOf(record, "original_code_crop"))]
    : it
      ? [record.source_figure_crop, record.source_table_crop].filter(Boolean)
      : record.figure_paths ?? [];
  const stage = String(record.answer_stage ?? "");
  // CS records say which key they come from: «initial», «final», or a stage
  // the source does not print. Only a printed initial key is called one.
  const initialKey = cs ? stage === "initial" : Boolean(record.answer_finality_review_pending) || INITIAL_STAGES.has(stage);
  const stageNote =
    cs && !initialKey && stage !== "final"
      ? stage === "publisher_claimed_final_without_printed_stage_header"
        ? "ناشر کلید را نهایی خوانده، ولی عنوان «نهایی» روی آن چاپ نشده"
        : "مرحلهٔ کلید (اولیه یا نهایی) در منبع مشخص نیست"
      : null;
  // The key: the board's when the bank matched one; otherwise our own answer,
  // written and independently reviewed (authored_solution), marked as ours.
  const official = [1, 2, 3, 4].includes(correct);
  const authored = record.authored_solution?.status === "independently_reviewed" ? record.authored_solution : null;
  const authoredOptions = (authored?.accepted_options ?? authored?.proposed_options ?? []).filter((n) => [1, 2, 3, 4].includes(n));
  const phd = record.exam_track === "phd" ? phdExam(record) : null;
  return {
    track: record.exam_track,
    questionId: record.question_id,
    degree: track?.degree ?? "master",
    code: phd ? phd.code : (track?.code ?? ""),
    major: phd ? phd.major : (track?.major ?? ""),
    keySource: official ? "official" : authoredOptions.length ? "authored" : null,
    authoredExplanation: authored?.explanation_fa ? String(authored.explanation_fa).trim() : "",
    authoredOptions,
    positiveEffect: Boolean(record.answer_positive_effect),
    year: record.year,
    booklet: Number.isInteger(record.booklet_number) && record.booklet_number > 0 ? record.booklet_number : undefined,
    bookletLabel: it ? String(record.booklet_code ?? "b0").replace(/[^A-Za-z0-9]/g, "") || "b0" : `b${record.booklet_number ?? 0}`,
    number: record.question_number,
    section: record.subject,
    subjectName: record.subject_specific,
    stem,
    options: record.options ?? [],
    // A CS option drawn in the booklet (a tree, a circuit) comes as a crop.
    // Some records keep the drawing under display_blocks instead.
    optionImages: new Map(
      (record.options ?? [])
        .map((option) => [option.number, option.source_image ?? option.display_blocks?.find((block) => block.type === "image" && block.path)?.path])
        .filter(([, image]) => image),
    ),
    // A note or figure the booklet prints once for several questions.
    contextCrops: cs ? assetsOf(record, "original_shared_context_crop") : [],
    correct,
    accepted,
    deleted: Boolean(record.answer_deleted) || (Array.isArray(rawAnswer) && rawAnswer.length === 0),
    // A later word-by-word check against the source image (source_transcription)
    // counts too, unless the source itself is marked ambiguous.
    textVerified:
      TEXT_CHECKED.has(record.content_review_status) ||
      (record.source_transcription?.visually_reviewed === true && !/ambigu/i.test(String(record.content_review_status ?? ""))),
    keyVerified: KEY_CHECKED.has(record.answer_key_status),
    // Only stages that say the answer comes from an initial key; a key
    // "without a printed initial or final heading" is not one.
    initialKey,
    notes: [record.content_review_status, record.answer_key_status, stage, stageNote].filter(Boolean),
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

/** A small grey picture of an image and its shape, to spot one drawing cropped twice. */
/** A hand-cut copy of a booklet drawing (cleaner than the automatic crop). */
const HAND_CUT = /[\\/]source_fidelity[\\/]/;

/** A drawing reduced to 32×32 grey after its white margin is trimmed, so two
 * cuts of one drawing with different margins still compare alike. */
async function thumbnail(buffer) {
  const flat = await sharp(buffer).flatten({ background: "#ffffff" }).grayscale().toBuffer();
  const { data: trimmed, info } = await sharp(flat)
    .trim({ background: "#ffffff", threshold: 40 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => sharp(flat).toBuffer({ resolveWithObject: true }));
  const pixels = await sharp(trimmed).resize(32, 32, { fit: "fill" }).raw().toBuffer();
  return { ratio: info.width / info.height, pixels };
}

// Only a drawing cut twice (a booklet crop and its cleaned copy) is dropped.
// Single lines of code and per-option pieces ("code-overlay-NN", "option_N")
// look alike and still differ (A[i][i] and A[j][j]), so they always stay.
const PIECE = /code-overlay-\d+|option_\d+/;
function sameDrawing(a, b, file) {
  if (a.path === file) return true;
  if (PIECE.test(a.path) || PIECE.test(file)) return false;
  if (a.ratio > 4 || b.ratio > 4) return false;
  if (Math.abs(a.ratio - b.ratio) / Math.max(a.ratio, b.ratio) > 0.15) return false;
  let diff = 0;
  for (let i = 0; i < a.pixels.length; i += 1) diff += Math.abs(a.pixels[i] - b.pixels[i]);
  return diff / a.pixels.length < 18;
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
  if (!q.code) return `رشتهٔ «${q.track}» در این مبدل تعریف نشده`;
  if (q.subjectCode) {
    // A tagged question: its subject comes from the tag; deleted and keyless ones still come in.
    // An option drawn in the booklet (a tree, a circuit) is its image.
    if (q.options.length !== 4 || q.options.some((option) => !String(option.text ?? "").trim() && !q.optionImages.has(option.number))) return "ساختار گزینه‌ها کامل نیست";
    if (!q.stem && !q.passage) return "متن سؤال خالی است";
    return null;
  }
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
// BANK_GENERATED_AT pins the bank's date when its file was copied to a disk that rounds timestamps
// (exFAT keeps 2 seconds), so an unchanged bank does not show every question as changed.
const generatedAt = process.env.BANK_GENERATED_AT ?? (await stat(bankFile)).mtime.toISOString();
const questions = (await readFile(bankFile, "utf8"))
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))
  .filter((record) => !TAGGED || TAGS.has(record.question_id))
  .map((record) => {
    const q = normalise(record);
    if (!TAGGED) return q;
    const tag = TAGS.get(record.question_id);
    // Our own crop check stands in for the owner's review; the key only when we confirmed it by solving.
    if (tag.ours) {
      q.textVerified = true;
      if (tag.key_checked) q.keyVerified = true;
    }
    const subjectCode = subjectOf(tag.course, tag.chapter, tag.topic);
    if (!subjectCode) throw new Error(`${record.question_id}: no subject for course «${tag.course}» (taxonomy-1406.mjs)`);
    const topic = isOutside1406(subjectCode) ? null : topicOf(subjectCode, tag.chapter, tag.topic);
    // Without an official key, our reviewed answer is the key.
    const keyed = q.keySource === "official" ? q : q.keySource === "authored" ? { ...q, correct: q.authoredOptions[0], accepted: q.authoredOptions, keyVerified: true } : q;
    return {
      ...keyed,
      subjectCode,
      topicCodes: topic ? [topic] : [],
      labels: { ...(tag.chapter ? { chapter: tag.chapter } : {}), ...(tag.topic ? { topic: tag.topic } : {}) },
      outside1406: isOutside1406(subjectCode),
    };
  })
  // The bank carries only the courses of the 1406 exam (owner, 2026-10-25); the dropped ones
  // (signals, general and engineering maths, digital electronics, management) stay in the archive.
  .filter((q) => !q.outside1406)
  .filter((q) => onlyYears.size === 0 || onlyYears.has(q.year));

await mkdir(outDir, { recursive: true });
const report = { generated_at: new Date().toISOString(), bank_modified_at: generatedAt, exams: {} };
const seenIds = new Set();
/** Samples found in the bank; any left over means a curated id no longer matches. */
const usedSamples = new Set();
const usedSolutions = new Set();
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

  for (const record of questions.filter((item) => item.code === code && item.year === year)) {
    summary.records += 1;
    // A question checked word for word for an article replaces the bank's record (verified.mjs).
    const verified = VERIFIED.get(`kunkurcomputer-q-${code}-${year}-${record.bookletLabel}-${String(record.number).padStart(3, "0")}`);
    if (VERIFIED_ONLY.has(examYear) && !verified && !TAGGED) {
      const key = "این سال فقط با سؤال‌های تطبیق‌داده‌شده ساخته می‌شود";
      summary.skipped[key] = (summary.skipped[key] ?? 0) + 1;
      continue;
    }
    const q = verified
      ? {
          ...record,
          stem: verified.stem,
          options: verified.options.map((option, index) => ({ number: index + 1, text: option })),
          optionImages: new Map(),
          figures: [],
          contextCrops: [],
          passage: "",
          correct: verified.correct,
          accepted: verified.accepted,
          deleted: false,
          textVerified: true,
          keyVerified: true,
          initialKey: false,
          notes: ["متن، گزینه‌ها و کلید کلمه‌به‌کلمه با دفترچهٔ 135A و کلید نهایی تطبیق داده شده (مقالهٔ حل تشریحی ۱۴۰۵)"],
        }
      : record;
    // The bank marks a figure's place with «[شکل در تصویر منبع]»; the figure itself is attached, so the marker goes.
    const FIGURE_MARKER = /\s*\[شکل در تصویر منبع\]\s*/g;
    q.stem = String(q.stem ?? "").replace(FIGURE_MARKER, "\n").trim();
    q.options = q.options.map((option) => ({ ...option, text: String(option.text ?? "").replace(FIGURE_MARKER, " ").trim() }));
    // Options typed in text-fixes.mjs count, so a question whose options were never transcribed is not skipped.
    const optionFix = TEXT_FIXES.get(`kunkurcomputer-q-${code}-${year}-${q.bookletLabel}-${String(q.number).padStart(3, "0")}`)?.options;
    const reason = skipReason(optionFix ? { ...q, options: q.options.map((option) => (optionFix[option.number] ? { ...option, text: optionFix[option.number] } : option)) } : q);
    if (reason) {
      summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
      continue;
    }
    // A tagged question with no key at all (neither the board's nor ours yet)
    // still comes in, held in the review queue until it is solved.
    let keyless = TAGGED && ![1, 2, 3, 4].includes(q.correct) && !q.deleted;
    // 1389 held two sessions that both numbered from 1; the second session's
    // questions keep the base id plus their source document.
    let externalId = `kunkurcomputer-q-${code}-${year}-${q.bookletLabel}-${String(q.number).padStart(3, "0")}`;
    if (seenIds.has(externalId)) externalId = `${externalId}-${String(q.docId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-6)}`;
    if (seenIds.has(externalId)) {
      summary.skipped["شمارهٔ تکراری در دفترچه"] = (summary.skipped["شمارهٔ تکراری در دفترچه"] ?? 0) + 1;
      continue;
    }
    seenIds.add(externalId);
    // The booklet's text where the bank mistyped it (text-fixes.mjs).
    const fix = TEXT_FIXES.get(externalId);
    if (fix) {
      for (const [wrong, right] of fix.stem ?? []) {
        if (!String(q.stem).includes(wrong)) throw new Error(`${externalId}: text fix «${wrong}» not found`);
        q.stem = String(q.stem).replace(wrong, right);
      }
      if (fix.options) q.options = q.options.map((option) => (fix.options[option.number] ? { ...option, text: fix.options[option.number] } : option));
      if (fix.append) q.stem = `${String(q.stem).trim()}\n${fix.append}`;
      if (fix.dropFigures) q.figures = [];
      if (fix.figures) q.figures = [...q.figures, ...fix.figures];
      // A text the bank marked ambiguous, compared with the booklet crop and found complete.
      if (fix.verified) q.textVerified = true;
    }
    // No official key: our worked answer (solutions.mjs `ourKey`) becomes the key, marked as ours.
    const ourKey = SOLUTIONS[externalId]?.ourKey;
    if (ourKey) {
      if (!keyless) throw new Error(`${externalId}: ourKey is only for questions without an official key`);
      if (SOLUTIONS[externalId].answer !== ourKey) throw new Error(`${externalId}: ourKey and answer differ`);
      Object.assign(q, { correct: ourKey, accepted: [ourKey], keyVerified: true, keySource: "authored" });
      keyless = false;
    }

    const assets = [];
    const addFile = ({ asset, buffer }) => {
      assets.push(asset);
      files.set(asset.filename, buffer);
    };
    const figureKeys = new Map();
    // The bank often keeps one drawing twice: the booklet's automatic crop
    // and a clean hand cut of it (source_fidelity/). A student sees it once,
    // as the hand cut, in the place the first copy had.
    const keptFigures = [];
    for (const [index, figure] of q.figures.entries()) {
      const image = await imageAsset(figure, `fig${index + 1}`);
      if (!image) continue;
      const thumb = await thumbnail(image.buffer);
      const twin = keptFigures.find((seen) => sameDrawing({ ...seen.thumb, path: seen.figure }, thumb, figure));
      if (twin) {
        if (process.env.LOG_DEDUPE) console.log("dedupe", externalId, twin.figure, figure);
        if (HAND_CUT.test(figure) && !HAND_CUT.test(twin.figure)) Object.assign(twin, { figure, image, thumb });
        continue;
      }
      keptFigures.push({ figure, image, thumb });
    }
    // Picked by eye where the bank keeps one drawing more than once (figure-picks.mjs).
    const picks = FIGURE_PICKS.get(externalId);
    if (picks) {
      const keys = keptFigures.map(({ image }) => image.asset.media_key);
      for (const key of picks) if (!keys.includes(key)) throw new Error(`${externalId}: figure pick ${key} not among ${keys.join(",")}`);
      keptFigures.splice(0, keptFigures.length, ...keptFigures.filter(({ image }) => picks.includes(image.asset.media_key)));
    }
    for (const { figure, image } of keptFigures) {
      addFile(image);
      figureKeys.set(path.basename(figure), image.asset.media_key);
    }
    // The booklet crop is not shown to students (owner, 2026-10-18); a tagged build leaves it out.
    const crop = q.crop && !TAGGED ? await imageAsset(q.crop, "source") : null;
    if (crop) addFile(crop);
    const optionKeys = new Map();
    for (const [number, image] of q.optionImages) {
      const asset = await imageAsset(image, `opt${number}`);
      if (asset) {
        addFile(asset);
        optionKeys.set(number, asset.asset.media_key);
      }
    }
    const contextKeys = [];
    for (const [index, image] of q.contextCrops.entries()) {
      const asset = await imageAsset(image, `ctx${index + 1}`);
      if (asset) {
        addFile(asset);
        contextKeys.push(asset.asset.media_key);
      }
    }

    // A verified question's drawings, cut from the booklet without its text.
    const verifiedFigures = [];
    for (const [k, figure] of (verified?.figures ?? []).entries()) {
      const image = await imageAsset(figure.path, `fig${k + 1}`);
      if (!image) throw new Error(`${externalId}: missing figure ${figure.path} (run analysis/question_figures.mjs)`);
      addFile(image);
      // question.v2 images take no caption; the label goes above the drawing.
      if (figure.caption) verifiedFigures.push({ type: "text", text: figure.caption });
      verifiedFigures.push({ type: "image", media_key: image.asset.media_key });
    }
    // A curated sample carries its worked solution, and must reach the key.
    // A verified question brings its own solution (and its own sample flag).
    if (verified && SAMPLES[externalId]) usedSamples.add(externalId);
    // A question outside the samples may carry a worked solution too (solutions.mjs).
    const curated = verified
      ? { solution: verified.solution, topics: SAMPLES[externalId]?.topics, sample: verified.sample }
      : SAMPLES[externalId]
        ? { ...SAMPLES[externalId], sample: true }
        : SOLUTIONS[externalId];
    if (curated && !verified) {
      if (curated.answer !== q.correct) throw new Error(`${externalId}: the solution reaches option ${curated.answer}, the key says ${q.correct}`);
      if (!q.textVerified || !q.keyVerified || q.initialKey) throw new Error(`${externalId}: a sample needs a checked text and a final, checked key`);
      if (SAMPLES[externalId]) usedSamples.add(externalId);
      else usedSolutions.add(externalId);
    }
    const notes = [
      ...q.notes,
      ...(q.initialKey ? ["کلید اولیه؛ کلید نهایی هنوز اعمال نشده"] : []),
      ...(curated?.solution?.length ? ["راه‌حل تشریحی: نوشتهٔ Claude و هم‌خوان با کلید؛ بازبینی مالک لازم است"] : []),
      ...(q.keySource === "authored" ? ["کلید رسمی در دسترس نیست؛ پاسخ تألیفی با بازبینی مستقل جای کلید است"] : []),
      ...(keyless ? ["کلید ندارد؛ تا حل‌شدن در صف بازبینی می‌ماند (گزینهٔ ۱ فقط جای خالی است)"] : []),
      ...(q.deleted ? ["در کلید نهایی حذف شده"] : []),
      ...(NEEDS_FIGURE.has(externalId) ? [`در صف بازبینی: ${NEEDS_FIGURE.get(externalId)}`] : []),
    ];
    const passageKey = q.passageId
      ? String(q.passageId).replace(/[^A-Za-z0-9-]/g, "")
      : sha256(String(q.docId) + q.passage + q.contextCrops.join("|")).slice(0, 12);
    // A shared note printed as a crop is the passage: its image is carried by
    // every question that refers to it, under the same media key.
    const passageBlocks = [
      ...(q.passage ? [{ type: "text", text: q.passage }] : []),
      ...contextKeys.map((key) => ({ type: "image", media_key: key })),
    ];
    const item = {
      schema_version: "question.v2",
      external_id: externalId,
      exam: { degree: q.degree ?? "master", major: q.major, year, code },
      slot: { ...(q.booklet ? { booklet: q.booklet } : {}), number: q.number, ...(q.section ? { section: q.section } : {}) },
      subject_code: q.subjectCode ?? SUBJECTS[q.subjectName],
      topic_codes: curated?.topics ?? q.topicCodes ?? [],
      ...(verified?.passage
        ? { passage: verified.passage }
        : passageBlocks.length ? { passage: { external_id: `kunkurcomputer-passage-${code}-${year}-${passageKey}`, blocks: passageBlocks } } : {}),
      stem_blocks: verified
        ? [{ type: "text", text: q.stem }, ...(verified.table ? [{ type: "table", ...verified.table }] : []), ...verifiedFigures]
        : [
            ...(q.stem ? stemBlocks(q.stem, figureKeys) : [{ type: "text", text: `(${q.number})` }, ...stemBlocks("", figureKeys)]),
            ...(fix?.table ? [{ type: "table", ...fix.table }] : []),
            ...(fix?.tables ?? []).map((table) => ({ type: "table", ...table })),
          ],
      options: q.options.map((option) => ({
        number: option.number,
        blocks: [
          ...(String(option.text ?? "").trim() ? [{ type: "text", text: String(option.text).trim() }] : []),
          ...(optionKeys.has(option.number) ? [{ type: "image", media_key: optionKeys.get(option.number) }] : []),
        ],
      })),
      // A deleted or keyless question keeps 1 as a placeholder: the key state says it is not a key.
      correct_option: [1, 2, 3, 4].includes(q.correct) ? q.correct : 1,
      ...(q.accepted.length > 1 && q.accepted.includes(q.correct) ? { accepted_options: q.accepted } : {}),
      ...(q.deleted ? { key_state: "deleted" } : q.positiveEffect ? { key_state: "positive_effect" } : {}),
      solution_blocks: curated?.solution ?? (q.authoredExplanation ? [{ type: "text", text: q.authoredExplanation }] : []),
      review: { text_verified: q.textVerified && !NEEDS_FIGURE.has(externalId), key_verified: keyless ? false : q.keyVerified, notes },
      ...(q.labels && Object.keys(q.labels).length ? { labels: q.labels } : {}),
      ...(curated?.hint ? { hint: curated.hint } : {}),
      ...(curated?.shortcut ? { shortcut: curated.shortcut } : {}),
      ...(curated?.sample ? { sample: true } : {}),
      assets,
      source: {
        ...(q.page ? { page: q.page } : {}),
        question_number: q.number,
        ...(q.booklet ? { booklet: q.booklet } : {}),
        archive_path: q.archivePath,
        ...(crop ? { crop_media_key: "source" } : {}),
        ...(q.keySource ? { key_source: q.keySource } : {}),
      },
      provenance: {
        producer_type: "ocr",
        producer_name: "mistral-ocr-latest + owner review",
        source_artifact: q.archivePath ?? `bank:${q.questionId}`,
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

// Free samples (owner, 2026-10-20): two questions of every syllabus chapter
// are open to everyone, answer and solution included -- the newest checked
// questions with a worked solution, all three layers (hint, quick way, full
// solution) first. The curated samples above count towards their chapter.
const SAMPLES_PER_CHAPTER = 2;
const chapterOf = new Map();
for (const chapters of Object.values(TREE)) for (const chapter of chapters) for (const topic of chapter.topics) chapterOf.set(topic.code, chapter.code);
const byChapter = new Map();
for (const item of built.flatMap((exam) => exam.items)) {
  const chapter = chapterOf.get(item.topic_codes[0]);
  if (!chapter) continue;
  if (!byChapter.has(chapter)) byChapter.set(chapter, []);
  byChapter.get(chapter).push(item);
}
let autoSamples = 0;
for (const items of byChapter.values()) {
  const open = items.filter(
    (item) => item.solution_blocks.length > 0 && item.review.text_verified && item.review.key_verified && !item.key_state,
  );
  const want = SAMPLES_PER_CHAPTER - open.filter((item) => item.sample).length;
  const ranked = open
    .filter((item) => !item.sample)
    .sort((a, b) => Number(Boolean(b.hint && b.shortcut)) - Number(Boolean(a.hint && a.shortcut)) || b.exam.year - a.exam.year || a.slot.number - b.slot.number);
  for (const item of ranked.slice(0, Math.max(want, 0))) {
    item.sample = true;
    autoSamples += 1;
  }
}
report.auto_samples = autoSamples;
console.log(`free samples: ${autoSamples} picked, two per syllabus chapter`);

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
if (missingSamples.length && onlyYears.size === 0 && !TAGGED) throw new Error(`curated samples not in the bank: ${missingSamples.join(", ")}`);
report.samples = usedSamples.size;
report.solutions = usedSolutions.size;
await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
const totals = {};
for (const [examYear, s] of Object.entries(report.exams)) {
  const code = examYear.split(":")[0];
  totals[code] ??= { records: 0, imported: 0, checked: 0, unchecked: 0, initial_key: 0 };
  for (const key of Object.keys(totals[code])) totals[code][key] += s[key];
  console.log(`${examYear}: ${s.imported}/${s.records} (checked ${s.checked}, review ${s.unchecked}, initial key ${s.initial_key})${s.zip_bytes ? ` ${(s.zip_bytes / 1048576).toFixed(1)} MB` : ""}${s.warning ? ` ⚠ ${s.warning}` : ""}`);
}
console.log("totals", JSON.stringify(totals));
