// The answer keys of the master's exams 1277 and 1276, 1400-1405, from the
// owner's bank (each key checked against the booklet's own key page), with the
// stage of each year's key as the bank records it. Writes keys.json.
//
//   node analysis/keys.mjs <bank-root>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bankRoot = process.argv[2];
if (!bankRoot) throw new Error("usage: node analysis/keys.mjs <bank-root>");
const read = (name) =>
  readFileSync(path.join(bankRoot, "outputs/unified_question_bank", name), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
const rows = [...read("active_questions.jsonl"), ...read("set_aside_questions.jsonl")].filter((r) => r.bank_classification !== "alternate");

/** final = the board's final key; initial = its initial key; unknown = the source does not say. */
function stageOf(r) {
  const s = r.answer_stage;
  if (["final_source", "final_key_printed_in_source", "final_key_labeled_in_source_filename", "user_supplied_annotated_final_booklet", "final"].includes(s)) return "final";
  if (["initial_fallback_final_row_absent", "user_confirmed_initial_key", "initial", "initial_key_with_final_scoring_label"].includes(s)) return "initial";
  return "unknown";
}

const out = {};
for (const track of ["ce", "it"]) {
  for (let year = 1400; year <= 1405; year++) {
    const list = rows.filter((r) => r.exam_track === track && r.year === year);
    const seen = new Set();
    const questions = [];
    for (const r of list.sort((a, b) => a.question_number - b.question_number)) {
      if (seen.has(r.question_number)) continue;
      seen.add(r.question_number);
      const listed = Array.isArray(r.answer) ? r.answer : Array.isArray(r.accepted_options) && r.accepted_options.length ? r.accepted_options : [];
      const accepted = [...new Set(listed.length ? listed : Number.isInteger(r.answer) ? [r.answer] : [])].sort();
      const deleted = Boolean(r.answer_deleted) || (Array.isArray(r.answer) && r.answer.length === 0);
      questions.push({ n: r.question_number, subject: r.subject ?? null, accepted, deleted, positive: Boolean(r.answer_positive_effect), stage: stageOf(r) });
    }
    const stages = {};
    for (const q of questions) stages[q.stage] = (stages[q.stage] ?? 0) + 1;
    const booklet = track === "it" ? list[0]?.booklet_code : list[0]?.booklet_number;
    (out[track] ??= {})[year] = { booklet, total: questions.length, stages, missing: questions.filter((q) => !q.deleted && q.accepted.length === 0).map((q) => q.n), questions };
  }
}
// Every question whose final key differs from the initial key (the bank holds
// both keys for some years only).
out.changes = rows
  .filter((r) => ["ce", "it"].includes(r.exam_track) && r.initial_vs_final_key_change)
  .map((r) => {
    const c = r.initial_vs_final_key_change;
    return { track: r.exam_track, year: r.year, booklet: r.exam_track === "it" ? r.booklet_code : r.booklet_number, n: r.question_number, subject: r.subject_specific, initial: c.initial_answer, final: [...(c.final_accepted_options ?? [])].sort(), deleted: Boolean(c.final_deleted), positive: Boolean(c.final_positive_effect) };
  })
  .sort((a, b) => a.year - b.year || a.n - b.n);
out.bothKeyYears = [...new Set(out.changes.map((c) => `${c.track}-${c.year}`))];
writeFileSync(fileURLToPath(new URL("./keys.json", import.meta.url)), JSON.stringify(out, null, 1));
for (const [track, years] of Object.entries(out).filter(([k]) => ["ce", "it"].includes(k)))
  for (const [year, y] of Object.entries(years))
    console.log(track, year, "booklet", y.booklet, "n", y.total, JSON.stringify(y.stages), "missing", y.missing.length, "deleted", y.questions.filter((q) => q.deleted).length, "multi", y.questions.filter((q) => q.accepted.length > 1).length);
