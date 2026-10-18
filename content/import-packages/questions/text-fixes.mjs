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
]);
