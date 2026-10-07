// Questions the exam board used again: pairs of past questions (any year,
// either set) whose stem and options are the same or nearly so. Compares
// character 4-gram sets (Jaccard) within each subject, after normalising
// digits, Arabic/Persian letters, spacing and LaTeX noise.
//
//   node repeats.mjs <bank-root> [threshold=0.8]
//
// Writes repeats.json next to this file: one entry per pair, both questions'
// ids, years, sets, numbers and similarity. Counts only go into articles;
// the question text is the bank's own.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [bankRoot, thresholdArg] = process.argv.slice(2);
const threshold = Number(thresholdArg ?? 0.8);
const build = readFileSync(new URL("../questions/build.mjs", import.meta.url), "utf8");
const start = build.indexOf("const SUBJECTS = {");
const SUBJECTS = Object.fromEntries([...build.slice(start, build.indexOf("\n};", start)).matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

const rows = readFileSync(path.join(bankRoot, "outputs/unified_question_bank/active_questions.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
function normalise(text) {
  return String(text ?? "")
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ًٌٍَُِّْ‌]/g, "")
    .replace(/\\(left|right|mathrm|text|displaystyle|,|;|!|quad)/g, "")
    .replace(/[$\\{}()[\]\s.,،؛:؟?!"'«»\-–_*`|]/g, "")
    .toLowerCase();
}

function shingles(text) {
  const set = new Set();
  for (let i = 0; i + 4 <= text.length; i++) set.add(text.slice(i, i + 4));
  return set;
}

const items = [];
for (const r of rows) {
  const it = r.exam_track === "it";
  const subject = SUBJECTS[r.subject_specific];
  if (!subject || !r.exam_track) continue;
  const stem = String((it ? r.stem : r.stem_text) ?? "");
  const options = (r.options ?? []).map((o) => o.text ?? "").join(" ");
  const body = normalise(stem + " " + options);
  if (body.length < 60) continue;
  items.push({
    id: `${it ? 1276 : 1277}-${r.year}-${it ? r.booklet_code : "b" + r.booklet_number}-${r.question_number}`,
    track: r.exam_track,
    code: it ? "1276" : "1277",
    year: r.year,
    number: r.question_number,
    subject,
    answer: r.answer,
    figures: (it ? [r.source_figure_crop, r.source_table_crop].filter(Boolean) : r.figure_paths ?? []).length,
    set: shingles(body),
  });
}

const pairs = [];
const bySubject = new Map();
for (const item of items) bySubject.set(item.subject, [...(bySubject.get(item.subject) ?? []), item]);
for (const [subject, list] of bySubject) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.code === b.code && a.year === b.year) continue;
      const small = a.set.size < b.set.size ? a.set : b.set;
      const large = small === a.set ? b.set : a.set;
      if (small.size / large.size < threshold) continue;
      let shared = 0;
      for (const s of small) if (large.has(s)) shared++;
      const jaccard = shared / (a.set.size + b.set.size - shared);
      if (jaccard >= threshold) {
        const [first, second] = a.year < b.year || (a.year === b.year && a.code < b.code) ? [a, b] : [b, a];
        pairs.push({ subject, similarity: Math.round(jaccard * 1000) / 1000, first: strip(first), second: strip(second) });
      }
    }
  }
}
function strip({ set, ...rest }) {
  return rest;
}
pairs.sort((x, y) => x.subject.localeCompare(y.subject) || x.first.year - y.first.year);
writeFileSync(new URL("./repeats.json", import.meta.url), JSON.stringify(pairs, null, 1));
const crossTrack = pairs.filter((p) => p.first.code !== p.second.code).length;
console.log(`${items.length} questions, ${pairs.length} pairs at ≥${threshold} (${crossTrack} between IT and CE)`);
for (const [subject, n] of Object.entries(pairs.reduce((m, p) => ((m[p.subject] = (m[p.subject] ?? 0) + 1), m), {}))) console.log(subject, n);
