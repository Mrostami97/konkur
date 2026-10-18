// Reviewed questions held in the review queue (text not verified) although
// they come into the bank: their figure, table, code or language is still
// missing from the text, or with it typed in no option is exactly right.
// The booklet crop is not shown to students (owner, 2026-10-18). Each id
// leaves this list once its gap is closed (text-fixes.mjs) or it is resolved.
export const NEEDS_FIGURE = new Map([
  // With the automaton drawn, the strings 10 and 100 are accepted too; no option has them (bank-corrections.md).
  ["kunkurcomputer-q-1209-1384-b0-117", "با شکل اتوماتون، رشته‌های 10 و 100 هم پذیرفته می‌شوند و هیچ گزینه‌ای دقیقاً زبان آن نیست"],
  // The failure probability of a two-edge path is p+q-pq; no option has it (bank-corrections.md).
  ["kunkurcomputer-q-1277-1389-b1-033", "احتمال خرابی مسیر دو یالی p+q-pq است و هیچ گزینه‌ای دقیقاً آن نیست؛ کلید رسمی گزینهٔ ۴ است"],
]);
