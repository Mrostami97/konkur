// Keys the bank took from the wrong sheet. build.mjs checks that the bank still holds `from`
// (so a later bank fix is noticed) and uses `to` instead.
//
// CE 1391 (1277, booklet b1): the bank follows «کلید نهایی 91», whose cells for q55, q59, q61, q62,
// q63 and q69 swap options 1 and 4 against the booklet-A initial key. Worked solutions of all six
// reach the initial key's option, so that one stands (owner approved, 2026-10-29). It is printed as
// an initial key, and settles once our solution reaches it.
export const KEY_FIXES = new Map(
  Object.entries({
    "kunkurcomputer-q-1277-1391-b1-055": { from: 4, to: 1, initial: true },
    "kunkurcomputer-q-1277-1391-b1-059": { from: 1, to: 4, initial: true },
    "kunkurcomputer-q-1277-1391-b1-061": { from: 4, to: 1, initial: true },
    "kunkurcomputer-q-1277-1391-b1-062": { from: 1, to: 4, initial: true },
    "kunkurcomputer-q-1277-1391-b1-063": { from: 4, to: 1, initial: true },
    "kunkurcomputer-q-1277-1391-b1-069": { from: 4, to: 1, initial: true },
  }),
);
