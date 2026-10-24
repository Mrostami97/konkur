// Corrections to the bank's text, checked against the booklet crop. build.mjs
// applies them before packing: `options` replaces an option's text, `stem`
// is a list of [wrong, right] replacements in the stem, `append` is text that
// follows the stem (a program, a matrix, a language the bank never typed),
// `table` is a table block after the stem and `figures` are drawings already
// cut from the booklet (paths under the bank root) that follow it. Each fix is
// logged in ../bank-corrections.md.

const code = (lines) => "```\n" + lines.join("\n") + "\n```";

export const TEXT_FIXES = new Map([
  // IT 1402 q30: the booklet says oranges come in multiples of 3; the bank typed «مضرب ۲».
  ["kunkurcomputer-q-1276-1402-758F-030", { stem: [["تعداد پرتقال‌ها مضرب ۲ باشد", "تعداد پرتقال‌ها مضرب ۳ باشد"]] }],
  // CS 1392 q63: the booklet's option 3 is ۱۲۰ (the Huffman merge cost), the bank typed 125.
  ["kunkurcomputer-q-1209-1392-370C-063", { options: { 3: "$120$" } }],
  // Stems that point at a function, graph, table or circuit the bank never carried (2026-10-20 audit of
  // stems that refer to «زیر/روبه‌رو» with nothing attached). Each drawing is the clean hand cut, checked
  // against the booklet crop; the two tables are typed.
  ["kunkurcomputer-q-1277-1381-b0-139", {
    stem: [["تابع زیر را در نظر بگیرید:\n", "تابع زیر را در نظر بگیرید:\n![](ce1381_q0139_component.png)\n"]],
    figures: ["outputs/source_fidelity/assets/ce_next20/ce1381_q0139_component.png"],
  }],
  ["kunkurcomputer-q-1277-1382-b0-052", { figures: ["outputs/source_fidelity/assets/ce_next20/ce1382_q0052_component.png"] }],
  ["kunkurcomputer-q-1277-1383-b0-043", {
    stem: [["تابع زیر را در نظر می‌گیریم.", "تابع زیر را در نظر می‌گیریم.\n![](ce1383_q0043_component.png)\n"]],
    figures: ["outputs/source_fidelity/assets/ce_following20/ce1383_q0043_component.png"],
  }],
  ["kunkurcomputer-q-1277-1386-b0-043", {
    figures: ["outputs/source_fidelity/assets/ce_third20/ce1386_q0043_component_1.png", "outputs/source_fidelity/assets/ce_third20/ce1386_q0043_component_2.png"],
  }],
  ["kunkurcomputer-q-1277-1390-b2-057", {
    table: {
      headers: ["", "A", "B", "C", "D", "E"],
      rows: [
        ["A", "", "۱۰", "۸", "۲", ""],
        ["B", "۱۰", "", "۲", "", "۲"],
        ["C", "۸", "", "", "۲", "۶"],
        ["D", "۲", "", "۲", "", "۹"],
        ["E", "", "۲", "۶", "۹", ""],
      ],
    },
  }],
  ["kunkurcomputer-q-1277-1390-b1-078", {
    table: {
      headers: ["زمان ورود درخواست", "۰", "۱۰", "۲۰", "۷۰", "۸۰", "۹۰"],
      rows: [["سیلندر درخواست‌شده", "۲۱", "۷۵", "۱۶", "۶۸", "۲", "۱۷"]],
    },
  }],
  ["kunkurcomputer-q-1277-1391-b1-050", {
    stem: [["تابع روبه‌رو را در نظر بگیرید.", "تابع زیر را در نظر بگیرید.\n![](doc-95fb09b12836fade-q-0050-C-code.png)\n"]],
    figures: ["outputs/source_fidelity/assets/ce_technical_07/doc-95fb09b12836fade-q-0050-C-code.png"],
  }],
  ["kunkurcomputer-q-2355-1402-b0-010", { figures: ["outputs/phd_question_bank/assets/1402/phd-1402-7fc9cab5307f7cda-q0010-figure.png"] }],
  // CE 1389 q40: the stem points at «خلاصه اطلاعات زیر» but the bank never typed the table (2026-10-20).
  ["kunkurcomputer-q-1277-1389-b2-040", {
    table: {
      headers: ["", "نمونهٔ ۱", "نمونهٔ ۲", "نمونهٔ ۳"],
      rows: [
        ["اندازهٔ نمونهٔ iام", "۲", "۵", "۴"],
        ["میانگین نمونهٔ iام", "۶", "۸", "۴"],
        ["انحراف معیار نمونهٔ iام", "۰٫۷", "۱٫۰", "۱٫۱"],
      ],
    },
  }],
  // CS 1389 q57: option 2 is «۳ و ۱۰» in the booklet; the bank repeated option 4 (2026-10-20 text audit).
  ["kunkurcomputer-q-1209-1389-3077-057", { options: { 2: "‭۳ و ۱۰‬" } }],
  // CS 1382 q85: option 4 in the booklet says a path «does not exist» (وجود ندارد); the bank typed «وجود دارد».
  // IT 1402 q85: option 3 ends «به‌معنی اثبات‌ناپذیربودن گزاره است» in the booklet; the bank typed «اثبات‌پذیر بودن».
  ["kunkurcomputer-q-1276-1402-758F-085", { options: { 3: "در صورتی که نتیجه اعمال تجزیه در یکی از مراحل اثبات، تهی شود، به معنی اثبات‌ناپذیر بودن گزاره است." } }],
  // CE 1394 q47: the booklet prints the partitioned array as ⟨3,1,2,4,5,8,7,6,9⟩; the bank typed (2,1,3,…), which has four possible pivots.
  ["kunkurcomputer-q-1277-1394-b1-047", { stem: [["2,1,3,4,5,8,7,6,9", "3,1,2,4,5,8,7,6,9"]] }],
  // CS 1400 q67: the booklet's options are n, n lg n, n², n² lg n; the bank typed n, n², n³, n⁴.
  ["kunkurcomputer-q-1209-1400-660A-068", { options: { 2: String.raw`$n\lg n$`, 3: "$n^2$", 4: String.raw`$n^2\lg n$` } }],
  ["kunkurcomputer-q-1209-1382-b0-085", { options: { 4: "بین تمام رئوس در M مسیری وجود ندارد." } }],
  // CS 1395 q93 (repeated as q185): option 3 was untyped and option 4 repeated option 1.
  ["kunkurcomputer-q-1209-1395-271F-093", { options: { 3: "زمان $O(n^3)$ و حافظهٔ $O(n^3)$", 4: "زمان $O(n^2)$ و حافظهٔ $O(n^3)$" } }],
  ["kunkurcomputer-q-1209-1395-271F-185", { options: { 3: "زمان $O(n^3)$ و حافظهٔ $O(n^3)$", 4: "زمان $O(n^2)$ و حافظهٔ $O(n^3)$" } }],

  // Typed from the booklet crop: the bank kept only the sentence that points at them.
  ["kunkurcomputer-q-1209-1382-b0-144", {
    append: "$$L=\\{w \\mid w\\in\\{\\{a\\}^*,\\{b\\}^*,\\{c\\}^*\\}\\ \\wedge\\ \\big((n_a(w)=n_b(w))\\ \\vee\\ (n_a(w)=n_c(w))\\ \\vee\\ (n_b(w)=n_c(w))\\big)\\}$$",
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
  // CE 1394 q113: Persian digits inside the formula.
  ["kunkurcomputer-q-1277-1394-b2-113", { stem: [["v_{۱۰۰}", "v_{100}"]] }],
  // CE 1395 q94: the bank left the definitions to the crop and the four formulas empty; typed from the booklet.
  ["kunkurcomputer-q-1277-1395-b2-094", {
    dropFigures: true,
    stem: [
      ["وزن‌دار G که", "وزن‌دار $G$ که"],
      [
        "فرض کنید ماتریس مجاورت گراف W=(wᵢⱼ) (n×n) باشد. تعریف‌ها و شرایط اولیه در تصویر آمده‌اند. اگر dᵢⱼ⁽ᵐ⁾ وزن کوتاه‌ترین مسیر i→j با حداکثر m یال باشد، کدام گزینه درست است؟",
        "فرض کنید ماتریس مجاورت گراف $W=(w_{ij})$ ($n\\times n$) باشد که:\n$$W[i,j]=\\begin{cases}w_{ij}&(i,j)\\in E\\\\\\infty&(i,j)\\notin E\\\\0&i=j\\end{cases}$$\nاگر $d_{ij}^{(m)}$ وزن کوتاه‌ترین مسیر $i\\leadsto j$ که حداکثر $m$ یال داشته باشد، و\n$$d_{ij}^{(0)}=\\begin{cases}0&i=j\\\\\\infty&i\\ne j\\end{cases}$$\nدر آن صورت کدام یک از گزینه‌های زیر درست است؟",
      ],
    ],
    options: {
      1: "$d_{ij}^{(m)}=\\min_{i\\le k<n}\\{d_{ik}^{(m-1)}+w_{kj}\\}$",
      2: "$d_{ij}^{(m)}=\\min_{1\\le k\\le n}\\{d_{ik}^{(m-1)}+w_{kj}\\}$",
      3: "$d_{ij}^{(m)}=\\min_{i\\le k\\le n}\\{d_{ik}^{(m-1)}+w_{kj}\\}$",
      4: "$d_{ij}^{(m)}=\\min_{i\\le k<j}\\{d_{ik}^{(m-1)}+w_{kj}\\}$",
    },
  }],
  // CE 1397 q55: the hash table was only in the crop; typed from the booklet (empty cells left blank).
  ["kunkurcomputer-q-1277-1397-b0-055", {
    table: {
      headers: ["خانه", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"],
      rows: [["کلید", "5", "", "7", "", "", "", "11", "", "2", "9", "", "14", "", "3", "", "1", "4", "6"]],
    },
  }],
  // CE 1399 q86: option 1 asks about x = 4 (h(4) = 7), like options 2 and 3; the bank typed x = 2.
  ["kunkurcomputer-q-1277-1399-b0-086", { options: { 1: "احتمال آن که ورودی x = ۴ به خانه ۷ نگاشت شود برابر ۱ است." } }],
  // CE 1399 q91: the booklet's second item is A[i] = 3i + 2; the bank typed 2i + 3.
  ["kunkurcomputer-q-1277-1399-b0-091", { stem: [["A[i]=2i+3", "A[i]=3i+2"]] }],
  // CE 1400 q61: the booklet prints Pr[h(u) = h(u)]; the definition it states is for two values u and v.
  ["kunkurcomputer-q-1277-1400-b1-061", { stem: [["[h(u)=h(u)]", "[h(u)=h(v)]"]] }],
  // CE 1400 q66: the exchange-rate table was only in the page scan; typed from the booklet (row = from, column = to).
  ["kunkurcomputer-q-1277-1400-b1-066", {
    table: {
      headers: ["از / به", "D", "E", "P", "T"],
      rows: [
        ["D", "1", "1/1.2", "1/1.4", "25"],
        ["E", "1.2", "1", "1/1.1", "30"],
        ["P", "1.4", "1.1", "1", "35"],
        ["T", "1/25", "1/30", "1/35", "1"],
      ],
    },
  }],
  // CE 1402 q57: the loops were split over lines with a display formula inside; typed as a program.
  ["kunkurcomputer-q-1277-1402-b1-057", {
    stem: [["for(i=1 ; i<=n ; i++)", ""], ["for(j=1 ; j<=$$\\lfloor \\frac{n}{i} \\rfloor$$ ; j++)", ""], ["S.O ;", ""]],
    append: code(["for (i = 1; i <= n; i++)", "    for (j = 1; j <= floor(n / i); j++)", "        S.O;"]),
  }],
  // CE 1402 q64: algorithm B combines in O(n^3) in the booklet; the bank typed O(n^2).
  ["kunkurcomputer-q-1277-1402-b1-064", { options: { 2: "الگوریتم B نمونه‌ای به اندازه $n$ را با حل بازگشتی هشت نمونه با اندازه $\\frac{n}{2}$ حل می‌کند و سپس راه‌حل‌های آنها را در زمان $O(n^3)$ ترکیب می‌کنند." } }],
]);
