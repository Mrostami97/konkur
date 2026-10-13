// Aggregates for the 1209 (computer science) and PhD parts of the owner's bank,
// and the past master's questions the PhD exam used again. Counts only -- no
// question text leaves the bank.
//
//   node analysis/track_stats.mjs <bank-root>
//
// The bank holds part of these booklets, not all of them: for 1209 the group
// «ساختمان داده‌ها، طراحی الگوریتم‌ها و مبانی نظریه محاسبه» (and, before 1393, the
// matching group of the older booklet); for the PhD exams the data-structures and
// algorithms section of each orientation, plus logic and architecture for the
// architecture orientation. Articles must say so.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bankRoot = process.argv[2];
if (!bankRoot) throw new Error("usage: node analysis/track_stats.mjs <bank-root>");
const read = (name) =>
  readFileSync(path.join(bankRoot, "outputs/unified_question_bank", name), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
const rows = [...read("active_questions.jsonl"), ...read("set_aside_questions.jsonl")].filter((r) => r.bank_classification !== "alternate");

/** One name per subject across the years' different spellings. */
const CANON = {
  "ساختمان داده‌ها و الگوریتم‌ها": "ساختمان داده و الگوریتم",
  "ساختمان داده و الگوریتم": "ساختمان داده و الگوریتم",
  "ساختمان داده‌ها و طراحی الگوریتم‌ها": "ساختمان داده و الگوریتم",
  "ساختمان داده‌ها": "ساختمان داده و الگوریتم",
  "طراحی الگوریتم‌ها": "ساختمان داده و الگوریتم",
  "ساختمان داده‌ها و الگوریتم‌ها (بیوانفورماتیک)": "ساختمان داده و الگوریتم",
  "مبانی نظریه محاسبه": "نظریهٔ محاسبه و اتوماتا",
  "مبانی نظریهٔ محاسبه": "نظریهٔ محاسبه و اتوماتا",
  "نظریهٔ اتوماتا و زبان‌ها": "نظریهٔ محاسبه و اتوماتا",
  "نظریه اتوماتا و زبان‌ها": "نظریهٔ محاسبه و اتوماتا",
  "نظریه الگوریتم پیشرفته": "نظریهٔ الگوریتم پیشرفته",
};
const canon = (s) => CANON[s] ?? s;
const slotOf = (r) => `${r.exam_program_code ?? ""}|${r.exam_session ?? ""}|${r.booklet_number ?? r.booklet_code ?? ""}|${r.question_number}`;

function count(list, keyOf) {
  const out = {};
  const seen = new Set();
  for (const r of list) {
    const slot = `${r.year}|${slotOf(r)}`;
    if (seen.has(slot)) continue;
    seen.add(slot);
    const [a, b] = keyOf(r);
    out[a] ??= {};
    out[a][b] = (out[a][b] ?? 0) + 1;
  }
  return out;
}

// 1209: the computer-science programme only (1393-1396 booklets also held
// «علوم تصمیم و مهندسی دانش», a different exam).
const cs = rows.filter((r) => r.exam_track === "cs" && r.exam_program_code === "computer_science" && r.year >= 1386);
const csYears = count(cs, (r) => [r.year, canon(r.subject_specific)]);

// PhD: orientation (programme) × year × subject.
const phd = rows.filter((r) => r.exam_track === "phd");
const phdByProgram = {};
for (const [key, subjects] of Object.entries(count(phd, (r) => [`${r.exam_program_code}|${r.year}`, canon(r.subject_specific ?? r.subject)]))) {
  const [program, year] = key.split("|");
  (phdByProgram[program] ??= {})[year] = subjects;
}
const phdCodes = {};
for (const r of phd) if (r.exam_program_from_cover) (phdCodes[r.exam_program_code] ??= new Set()).add(`${r.year}: ${r.exam_program_from_cover}`);

// Master's questions the PhD exam used again (same similarity as repeats.mjs).
const FA = "۰۱۲۳۴۵۶۷۸۹", AR = "٠١٢٣٤٥٦٧٨٩";
const normalise = (text) =>
  String(text ?? "")
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ًٌٍَُِّْ‌]/g, "")
    .replace(/\\(left|right|mathrm|text|displaystyle|,|;|!|quad)/g, "")
    .replace(/[$\\{}()[\]\s.,،؛:؟?!"'«»\-–_*`|]/g, "")
    .toLowerCase();
const shingles = (t) => {
  const s = new Set();
  for (let i = 0; i + 4 <= t.length; i++) s.add(t.slice(i, i + 4));
  return s;
};
const bodyOf = (r) => normalise(`${r.stem ?? r.stem_text ?? r.text ?? ""} ${(r.options ?? []).map((o) => o.text ?? "").join(" ")}`);
const DSA = new Set(["ساختمان داده و الگوریتم", "داده‌ساختارها و الگوریتم‌ها", "ساختمان داده و طراحی الگوریتم", "ساختمان داده‌ها و طراحی الگوریتم"]);
const isDsa = (r) => DSA.has(canon(r.subject_specific ?? "")) || /ساختمان داده|الگوریتم/.test(r.subject_specific ?? "");
const items = (list) =>
  list
    .filter(isDsa)
    .map((r) => ({ r, body: bodyOf(r) }))
    .filter((x) => x.body.length >= 60)
    .map((x) => ({ ...x, sh: shingles(x.body) }));
const master = items(rows.filter((r) => ["ce", "it", "cs"].includes(r.exam_track)));
const phdItems = items(phd);
const repeats = [];
for (const p of phdItems) {
  let best = null;
  for (const m of master) {
    if (m.r.year > p.r.year) continue;
    const small = p.sh.size < m.sh.size ? p.sh : m.sh;
    const large = small === p.sh ? m.sh : p.sh;
    let inter = 0;
    for (const s of small) if (large.has(s)) inter++;
    const sim = inter / (p.sh.size + m.sh.size - inter);
    if (sim >= 0.8 && (!best || sim > best.sim)) best = { sim, m };
  }
  if (best) {
    repeats.push({
      phd: { program: p.r.exam_program_code, year: p.r.year, number: p.r.question_number, id: p.r.question_id },
      master: { track: best.m.r.exam_track, year: best.m.r.year, number: best.m.r.question_number, id: best.m.r.question_id },
      similarity: Math.round(best.sim * 100) / 100,
    });
  }
}

const out = {
  cs: csYears,
  phd: phdByProgram,
  phdCovers: Object.fromEntries(Object.entries(phdCodes).map(([k, v]) => [k, [...v].sort()])),
  phdRepeats: repeats,
  phdDsaQuestions: phdItems.length,
};
writeFileSync(fileURLToPath(new URL("./track_stats.json", import.meta.url)), JSON.stringify(out, null, 1));
console.log("1209:");
for (const [y, s] of Object.entries(csYears)) console.log(" ", y, JSON.stringify(s));
console.log("PhD programmes:", Object.keys(phdByProgram).join(", "));
console.log("PhD DS&A questions compared:", phdItems.length, "| repeats of master's questions:", repeats.length);
for (const r of repeats) console.log(" ", JSON.stringify(r));
