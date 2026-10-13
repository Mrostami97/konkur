// Questions whose text, options and key were checked word for word against
// the booklet for the worked-solution articles; build.mjs takes them from here
// instead of the bank, with their passages and worked solutions.
//
// The 1405 computer-engineering exam (1277, booklet 135A): every question of
// a subject still in the 1406 exam, from lib/solutions-1405-data.mjs. The bank
// lacks the reading passages of that year, prints a few stems with errors
// (bank-corrections.md) and keeps q76's options as unlabelled figures; this
// text has none of those problems. A question's drawing is an image cut from
// the booklet without its text and its tables are typed out, as in the articles.
//
// SAMPLE_1405: the public samples of each subject (three per subject), shown
// on the subject pages. These questions are public in the 1405 solutions
// article anyway.
import { FIGURES } from "../analysis/question_figures.mjs";
import { PASSAGES, QUESTIONS } from "../lib/solutions-1405-data.mjs";

const text = (t) => ({ type: "text", text: t });
const paragraphs = (t) => t.split("\n").map((line) => line.trim()).filter(Boolean).map(text);

const SAMPLE_1405 = new Set([1, 4, 6, 34, 35, 37, 40, 41, 44, 47, 48, 50, 56, 59, 61, 68, 69, 71, 77, 78, 79, 84, 85, 87, 96, 97, 99]);

function passageOf(n) {
  const starts = Object.entries(PASSAGES).sort(([, a], [, b]) => a.before - b.before);
  // Cloze 8-10, passage 1 11-15, passage 2 16-20, passage 3 21-25.
  for (let i = starts.length - 1; i >= 0; i--) {
    const [key, p] = starts[i];
    if (n >= p.before && n <= 25) return { external_id: `kunkurcomputer-passage-1277-1405-${key}`, blocks: [text(p.title), ...paragraphs(p.text)] };
  }
  return null;
}

/** External id → what replaces the bank's record. */
export const VERIFIED = new Map(
  QUESTIONS.filter((q) => !q.deleted).map((q) => [
    `kunkurcomputer-q-1277-1405-b1-${String(q.n).padStart(3, "0")}`,
    {
      stem: q.stem,
      options: q.options,
      correct: q.answer,
      accepted: q.accepted ?? [q.answer],
      // Drawings cut from the booklet without the question's text (relative to
      // the bank root); tables typed out.
      figures: (FIGURES[1405][q.n] ?? []).map((spec, k) => ({ path: `outputs/1405/site_assets/figures/q${String(q.n).padStart(3, "0")}-${k + 1}.png`, caption: spec.caption })),
      table: q.table,
      passage: passageOf(q.n),
      solution: [...paragraphs(q.solution), ...(q.note ? [text(q.note)] : [])],
      sample: SAMPLE_1405.has(q.n),
    },
  ]),
);

/** Exam-years whose import holds only verified questions (others of that year stay out). */
export const VERIFIED_ONLY = new Set(["1277:1405"]);
