// Aggregates the owner's past-exam bank into analysis/bank_stats.json for the
// "question budget" article family: how many questions each subject had in each
// year's booklet, and which questions the final key deleted, accepted two
// answers for, or scored with a positive effect. Counts only -- no question text.
//
//   node analysis/bank_stats.mjs <bank-root>
//
// <bank-root> as for questions/build.mjs. Every booklet slot counts, including
// questions the final key deleted and the few the bank set aside (a missing
// figure, a question absent from the booklet).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bankRoot = process.argv[2];
if (!bankRoot) throw new Error("usage: node analysis/bank_stats.mjs <bank-root>");
const read = (name) =>
  readFileSync(path.join(bankRoot, "outputs/unified_question_bank", name), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
const rows = [...read("active_questions.jsonl"), ...read("set_aside_questions.jsonl")];

/** The bank's subject names → one name per subject, so IT's split "ساختمان
 * داده‌ها" / "طراحی الگوریتم" years line up with the merged title. */
const CANON = {
  "ساختمان داده و طراحی الگوریتم": "داده‌ساختارها و الگوریتم‌ها",
  "ساختمان داده‌ها و طراحی الگوریتم": "داده‌ساختارها و الگوریتم‌ها",
  "ساختمان داده‌ها": "داده‌ساختارها و الگوریتم‌ها",
  "طراحی الگوریتم": "داده‌ساختارها و الگوریتم‌ها",
  "پایگاه داده": "پایگاه داده",
  "پایگاه داده‌ها": "پایگاه داده",
  "اصول طراحی پایگاه داده‌ها": "پایگاه داده",
  "زبان عمومی و تخصصی (انگلیسی)": "زبان",
  "الکترونیک دیجیتال و VLSI": "الکترونیک دیجیتال",
};
const canon = (name) => CANON[name] ?? name;

const out = {};
for (const track of ["ce", "it"]) {
  const list = rows.filter((row) => row.exam_track === track && row.bank_classification !== "alternate");
  const years = {};
  for (const row of list) {
    const y = (years[row.year] ??= { total: 0, subjects: {}, sections: {}, deleted: [], multi: [], positive: [], initialKey: 0, booklets: [], slots: new Set() });
    // IT names its booklet by a code (257C); CE by number within the exam (1, 2).
    const b = track === "it" ? (row.booklet_code ?? null) : (row.booklet_number ?? null);
    if (b !== null && !y.booklets.includes(b)) y.booklets.push(b);
    // One slot per booklet position; the 1389 CE exam had two sessions.
    const slot = `${row.exam_session ?? ""}|${row.booklet_number ?? row.booklet_code ?? ""}|${row.question_number}`;
    if (y.slots.has(slot)) continue;
    y.slots.add(slot);
    y.total += 1;
    const subject = canon(row.subject_specific ?? "نامشخص");
    y.subjects[subject] = (y.subjects[subject] ?? 0) + 1;
    if (row.subject) y.sections[row.subject] = (y.sections[row.subject] ?? 0) + 1;
    // The accepted options: IT keeps a list for several, CE accepted_options; a
    // single key (a number) stands for itself.
    const listed = Array.isArray(row.answer) ? row.answer : Array.isArray(row.accepted_options) && row.accepted_options.length ? row.accepted_options : [];
    const accepted = listed.length ? listed : Number.isInteger(row.answer) ? [row.answer] : [];
    const deleted = row.answer_deleted || (Array.isArray(row.answer) && row.answer.length === 0);
    if (deleted) y.deleted.push({ n: row.question_number, b, subject });
    else if (row.answer_multiple_correct || accepted.length > 1) y.multi.push({ n: row.question_number, b, subject, options: [...new Set(accepted)].sort() });
    if (row.answer_positive_effect) y.positive.push({ n: row.question_number, b, subject, options: [...new Set(accepted)].sort() });
    if (row.answer_finality_review_pending || ["user_confirmed_initial_key", "initial_fallback_final_row_absent", "initial_key_with_final_scoring_label"].includes(row.answer_stage)) y.initialKey += 1;
  }
  for (const y of Object.values(years)) {
    delete y.slots;
    for (const key of ["deleted", "multi", "positive"]) y[key].sort((a, b) => String(a.b).localeCompare(String(b.b)) || a.n - b.n);
  }
  out[track] = years;
}

writeFileSync(fileURLToPath(new URL("./bank_stats.json", import.meta.url)), JSON.stringify(out, null, 1));
for (const [track, years] of Object.entries(out)) {
  console.log(`\n== ${track}`);
  for (const [year, y] of Object.entries(years)) {
    console.log(year, "total", y.total, "| del", y.deleted.length, "multi", y.multi.length, "pos", y.positive.length, "initial", y.initialKey);
    console.log("   ", Object.entries(y.subjects).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join("  "));
  }
}
