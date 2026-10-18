// Corrections to the bank's text, checked against the booklet crop. build.mjs
// applies them before packing: `options` replaces an option's text, `stem`
// is a list of [wrong, right] replacements in the stem. Each fix is logged in
// ../bank-corrections.md.
export const TEXT_FIXES = new Map([
  // CS 1392 q63: the booklet's option 3 is ۱۲۰ (the Huffman merge cost), the bank typed 125.
  ["kunkurcomputer-q-1209-1392-370C-063", { options: { 3: "$120$" } }],
]);
