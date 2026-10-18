// Corrections to the bank's text, checked against the booklet crop. build.mjs
// applies them before packing: `options` replaces an option's text, `stem`
// is a list of [wrong, right] replacements in the stem, `append` is text that
// follows the stem (a program, a matrix, a language the bank never typed),
// `table` is a table block after the stem and `figures` are drawings already
// cut from the booklet (paths under the bank root) that follow it. Each fix is
// logged in ../bank-corrections.md.

const code = (lines) => "```\n" + lines.join("\n") + "\n```";

export const TEXT_FIXES = new Map([
  // CS 1392 q63: the booklet's option 3 is ۱۲۰ (the Huffman merge cost), the bank typed 125.
  ["kunkurcomputer-q-1209-1392-370C-063", { options: { 3: "$120$" } }],

  // Typed from the booklet crop: the bank kept only the sentence that points at them.
  ["kunkurcomputer-q-1209-1382-b0-144", {
    append: "$$L=\\{w \\mid w\\in\\{\\{a\\}^*,\\{b\\}^*,\\{c\\}^*\\}\\ \\wedge\\ \\big((n_a(w)=n_b(w))\\ \\vee\\ (n_a(w)=n_c(w))\\ \\vee\\(n_b(w)=n_c(w))\\big)\\}$$",
  }],
  ["kunkurcomputer-q-1209-1392-370C-088", {
    table: { headers: ["ماتریس", "A", "B", "C", "D"], rows: [["ابعاد", "10×100", "100×1", "1×20", "20×5"]] },
  }],
  ["kunkurcomputer-q-1209-1383-b0-139", {
    stem: [["($i=0,1$) و", "($i=0,1$) و $f(x)=5$ برای $x$ فرد و $f(x)=x+2$ برای $x$ زوج است."]],
  }],
  ["kunkurcomputer-q-1277-1383-b0-050", {
    append: code([
      "void sum (int m, int n, float s[ ][ ])",
      "{   int i, j;",
      "    for (j = 0; j < m; j++)",
      "    {   s[n-1][j] = 0;",
      "        for (i = 0; i < n-1; i++)",
      "            s[n-1][j] += s[i][j];",
      "    }",
      "}",
    ]),
  }],
  ["kunkurcomputer-q-1277-1383-b0-063", {
    table: { headers: ["P", "1", "2", "3", "4"], rows: [["1", "0", "0", "4", "2"], ["2", "4", "0", "4", "0"], ["3", "0", "1", "0", "0"], ["4", "0", "1", "0", "0"]] },
  }],
  ["kunkurcomputer-q-1277-1384-b0-053", {
    append: code([
      "function Test(n)",
      "    if n = 1 then",
      "        return 1",
      "    return 2 * Test(n/2) + 6 * n - 1;",
    ]),
  }],
  ["kunkurcomputer-q-1277-1389-b2-074", {
    append: code(["Push A", "Push B", "Push C", "Push D", "Push E", "Div", "SUB", "MUL", "ADD", "POP X"]),
  }],
  ["kunkurcomputer-q-1277-1389-b1-033", {
    stem: [["به صورت زیر استفاده کنیم.\n", "به صورت زیر استفاده کنیم.\n" + code(["for k = 1 to n do", "    for i = 1 to n do", "        for j = 1 to n do", "            (a) ............"]) + "\n"]],
  }],
  // The booklet prints the fourth and eighth columns blurred as «a» and «n»; the options name d and h.
  ["kunkurcomputer-q-1277-1389-b2-050-8e54dd", {
    table: { headers: ["رأس", "a", "b", "c", "d", "e", "f", "g", "h", "i"], rows: [["ورود", "1", "9", "8", "7", "5", "4", "2", "12", "13"], ["خروج", "18", "10", "11", "16", "6", "17", "3", "15", "14"]] },
  }],
  ["kunkurcomputer-q-1277-1390-b2-034", {
    stem: [["رویه زیر را اجرا می‌کنیم:\n", "رویه زیر را اجرا می‌کنیم:\n" + code([
      "MAYBESORT(A, N)",
      "1  k ← 0",
      "2  repeat",
      "3      k ← k + 1",
      "4      for i = 1 to N",
      "5          do B[i] ← A[A[i]]",
      "6      for i = 1 to N",
      "7          do A[i] ← B[i]",
      "8  until ∀ 1 ≤ i ≤ N: A[i] = i",
      "9  return k",
    ]) + "\n"]],
  }],

  // Drawings cut from the booklet without its text.
  ["kunkurcomputer-q-1209-1384-b0-117", { figures: ["outputs/cs_early_question_bank/assets/1384/q0117_original_automaton_crop_f5f194efe5264953.png"] }],
  ["kunkurcomputer-q-1209-1384-b0-121", { figures: ["outputs/cs_early_question_bank/assets/1384/q0121_original_automaton_crop_16cbb8b10bf00247.png"] }],
  ["kunkurcomputer-q-1277-1382-b0-060", { figures: ["outputs/algo_supplement/assets/1382/p0008_q060_graph.png"] }],
  ["kunkurcomputer-q-1277-1383-b0-052", { figures: ["outputs/algo_supplement/assets/1383/p0009_q052_binary_search_tree.png"] }],
  ["kunkurcomputer-q-1277-1384-b0-052", { figures: ["outputs/algo_supplement/assets/1384/supp-8c8a5c725791db05-p0013-q003-figure-1.png"] }],

  // The bank marked these ambiguous; compared with the booklet crop, the text is complete.
  ["kunkurcomputer-q-1209-1397-262F-092", { verified: true }],
  ["kunkurcomputer-q-1209-1398-861A-077", { verified: true }],
  ["kunkurcomputer-q-1209-1398-861A-085", { verified: true }],
  ["kunkurcomputer-q-1209-1398-861A-094", { verified: true }],
  ["kunkurcomputer-q-1209-1400-660A-085", { verified: true }],
  ["kunkurcomputer-q-1209-1404-460C-069", { verified: true }],
  // The booklet asks about «M»; the set the stem defines is R.
  ["kunkurcomputer-q-1209-1396-265A-212", { verified: true, stem: [["در مورد $M$", "در مورد $R$"]] }],
  // The booklet's «SL» is the language L.
  ["kunkurcomputer-q-1209-1402-760F-085", { verified: true, options: { 3: "برای زبان منظم $L$ که شامل $\\lambda$ نیست، می‌توان یک NFA بدون $\\lambda$ ارائه نمود که شامل یک state پایانی باشد و $L$ را بپذیرد. ($\\lambda$ همان بلانک است.)" } }],
  // The booklet prints the terminal c as «C» in Y → cY (and z for Z in 1403); the keys read it as c.
  // The grammar is typed in, so its crop (printed twice) goes.
  ["kunkurcomputer-q-1209-1402-760F-084", { verified: true, dropFigures: true, stem: [["Y&\\to CY", "Y&\\to cY"]] }],
  ["kunkurcomputer-q-1209-1403-259A-088", { verified: true, dropFigures: true, stem: [["$Y\\to CY\\mid\\epsilon$", "$Y\\to cY\\mid\\epsilon$"], ["$W\\to aWc\\mid z$", "$W\\to aWc\\mid Z$"]] }],
  // The program was two copies of one crop; typed as printed (the outer loop starts at i = 0).
  ["kunkurcomputer-q-1209-1400-660A-067", {
    verified: true,
    dropFigures: true,
    append: code(["k = 0", "for (i = 0; i < n; i = i + 1)", "    for (j = 1; j < n; j = j + i)", "        k = k + 1"]),
  }],

  // CS 1383 q110: the booklet runs 22313 instructions and gives B a CPI of 3; the bank typed 33333 and 2.
  ["kunkurcomputer-q-1209-1383-b0-110", { stem: [["با۳۳۳۳۳دستورالعمل", "با ۲۲۳۱۳ دستورالعمل"], ["روی B دارای CPI برابر۲ است", "روی B دارای CPI برابر ۳ است"]] }],
  // CS 1384 q140: a tridiagonal matrix has a_ij = 0 for |i-j| > 1; the booklet's «≥ 1» would leave only the diagonal.
  ["kunkurcomputer-q-1209-1384-b0-140", { stem: [["|i-j|\\ge1", "|i-j|>1"]] }],
  // CS 1383 q91: the distance table typed out in place of its crop.
  ["kunkurcomputer-q-1209-1383-b0-091", {
    dropFigures: true,
    table: { headers: ["رأس", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], rows: [["فاصله تا a", "0", "2", "1", "5", "2", "4", "1", "2", "3", "5"]] },
  }],

  // CS 1399 q72: the booklet sorts a 10-element array; the bank typed 15.
  ["kunkurcomputer-q-1209-1399-462F-072", { stem: [["یک آرایه ۱۵ عنصری", "یک آرایه ۱۰ عنصری"]] }],
]);
