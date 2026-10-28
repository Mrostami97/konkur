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
  // CE 1392 q118: the heuristic table beside the graph was not in the figure crop; typed from the booklet.
  ["kunkurcomputer-q-1277-1392-b2-118", {
    table: { headers: ["گره", "h1", "h2"], rows: [["S", "3", "4"], ["A", "3", "2"], ["B", "4", "3"], ["C", "2", "1"], ["D", "3", "1"], ["G", "0", "0"]] },
  }],
  // CE 1395 q101: the options were only in the page scan; typed from the booklet (the grid image is attached).
  ["kunkurcomputer-q-1277-1395-b2-101", {
    options: { 1: "1, 2, 3", 2: "1, 2, 5", 3: "1, 4, 7", 4: "1, 4, 5" },
  }],
  // CE 1395 q104: the board image is attached and the options typed from the booklet.
  ["kunkurcomputer-q-1277-1395-b2-104", {
    figures: ["outputs/content_review/source_crops/doc-64e3de2de6db498a-q-0104-p30-b25-image.png"],
    options: { 1: "$(Q_3,3)$ یا $(Q_3,1)$", 2: "$(Q_3,3)$ یا $(Q_4,1)$", 3: "$(Q_4,4)$ یا $(Q_4,1)$", 4: "$(Q_4,4)$ یا $(Q_3,3)$" },
  }],
  // CE 1392 q102 and q103 share a schema printed above them in the booklet; it is added to each.
  ["kunkurcomputer-q-1277-1392-b2-102", { stem: [["دستور SQL زیر تاریخ تولد", "بانک اطلاعاتی زیر را در نظر بگیرید:\nPerson(pID, pName, sex, DoB): شناسه، نام، جنسیت و تاریخ تولد هر فرد.\nRel(pID1, pID2, pRel): رابطهٔ pRel بین دو شخص pID1 و pID2؛ به‌طور خاص pRel = 1 یعنی شخص با شناسهٔ pID2 پدر شخص با شناسهٔ pID1 است.\nدستور SQL زیر تاریخ تولد"]] }],
  ["kunkurcomputer-q-1277-1392-b2-103", { stem: [["عبارت جبر رابطه‌ای زیر", "بانک اطلاعاتی زیر را در نظر بگیرید:\nPerson(pID, pName, sex, DoB): شناسه، نام، جنسیت و تاریخ تولد هر فرد.\nRel(pID1, pID2, pRel): رابطهٔ pRel بین دو شخص pID1 و pID2؛ به‌طور خاص pRel = 1 یعنی شخص با شناسهٔ pID2 پدر شخص با شناسهٔ pID1 است.\nعبارت جبر رابطه‌ای زیر"]] }],
  // CE 1399 q103: the memory figure (16 frames, 6 of them shaded for the process) was not attached; described in words.
  ["kunkurcomputer-q-1277-1399-b0-103", { append: "(در شکل دفترچه، حافظهٔ اصلی ۱۶ فریم دارد که ۶ فریم آن، به‌صورت پراکنده، به این پردازه تخصیص داده شده است.)" }],
  // CE 1400 q102: the four options are columns of code (one per process) printed as a table; typed from the booklet.
  ["kunkurcomputer-q-1277-1400-b1-102", { options: {
    1: "‭P1: S1; Signal(a) | P2: Wait(a); S2; Signal(b) | P3: Wait(b); S3; Signal(c) | P4: Wait(c); S4‬",
    2: "‭P1: S1; Signal(a); Signal(b) | P2: Wait(b); S2; Signal(a) | P3: Wait(a); S3; Signal(b) | P4: Wait(a); Wait(b); S4‬",
    3: "‭P1: S1; Signal(a) | P2: Wait(a); S2; Signal(a); Signal(a) | P3: Wait(a); Wait(a); S3; Signal(a); Signal(a); Signal(a) | P4: Wait(a); Wait(a); Wait(a); S4; Signal(a); Signal(a); Signal(a); Signal(a)‬",
    4: "‭P1: S1; Wait(a); Signal(b); Signal(c) | P2: Wait(a); S2; Signal(b); Signal(c) | P3: Wait(a); Signal(b); S3; Signal(c) | P4: Wait(a); Signal(b); Signal(c); S4‬",
  } }],
  ["kunkurcomputer-q-1277-1400-b1-105", { stem: [["هیچ\n\nوقت", "هیچ وقت"]] }],
  // CE 1400 q106 and q107: the tables were only in the crops.
  ["kunkurcomputer-q-1277-1400-b1-106", { stem: [["به\n\nنحوی", "به نحوی"]], table: { headers: ["پردازه", "Period", "CPU Time"], rows: [["P1", "50", "25"], ["P2", "80", "x"]] } }],
  ["kunkurcomputer-q-1277-1400-b1-107", { stem: [["میانگین\n\nزمان", "میانگین زمان"], ["\n\n[جدول در تصویر منبع]", ""]], table: { headers: ["پردازه", "زمان", "اولویت"], rows: [["P1", "10 ms", "3"], ["P2", "1 ms", "1"], ["P3", "2 ms", "4"], ["P4", "1 ms", "5"], ["P5", "5 ms", "2"]] } }],
  // CE 1401 q101: the booklet's transfer rate is 50 MB/Sec; the bank typed 500.
  ["kunkurcomputer-q-1277-1401-b1-101", { stem: [["۵۰۰ MB/Sec", "۵۰ MB/Sec"]] }],
  // CE 1401 q102: the table was only in the crop.
  ["kunkurcomputer-q-1277-1401-b1-102", { stem: [["\n\n[جدول در تصویر منبع]", ""]], table: { headers: ["", "P1", "P2", "P3"], rows: [["مدت زمان CPU", "5", "20", "10"], ["دوره تناوب", "25", "50", "40"]] } }],
  // CE 1402 q98: the booklet's option 1 is 0.000003 (five zeros); the bank typed it the same as option 3.
  ["kunkurcomputer-q-1277-1402-b1-098", { options: { 1: "P < ۰/۰۰۰۰۰۳" } }],
  // CE 1402 q99: the tables were only in the crop.
  ["kunkurcomputer-q-1277-1402-b1-099", {
    append: "منابع آزاد (available): ‭r1 = 1، r2 = 5، r3 = 2، r4 = 0‬",
    tables: [{
      headers: ["فرایند", "تخصیص r1", "تخصیص r2", "تخصیص r3", "تخصیص r4", "حداکثر r1", "حداکثر r2", "حداکثر r3", "حداکثر r4"],
      rows: [
        ["P0", "0", "0", "1", "2", "0", "0", "1", "2"],
        ["P1", "1", "0", "0", "1", "1", "5", "1", "1"],
        ["P2", "1", "3", "0", "4", "2", "3", "5", "6"],
        ["P3", "0", "6", "3", "2", "0", "6", "7", "2"],
        ["P4", "0", "0", "1", "4", "0", "6", "5", "6"],
      ],
    }],
  }],
  // CE 1403 q97 and q99: line breaks in the middle of sentences.
  ["kunkurcomputer-q-1277-1403-b1-097", { stem: [["مقدار\n\nکوانتوم", "مقدار کوانتوم"], ["است\n\nکه", "است که"]] }],
  ["kunkurcomputer-q-1277-1403-b1-099", { stem: [["همچنین\n\nفرض", "همچنین فرض"], ["مدخل‌های\n\nجدول", "مدخل‌های جدول"], ["جدول\n\nصفحه", "جدول صفحه"], ["برای\n\nجدول", "برای جدول"]] }],
  // CE 1404 q97 and q99: line breaks in the middle of sentences.
  ["kunkurcomputer-q-1277-1404-b1-097", { stem: [["تکمیل\n\nIO", "تکمیل IO"], ["پردازنده\n\nدوهسته", "پردازنده دوهسته"]] }],
  ["kunkurcomputer-q-1277-1404-b1-099", { stem: [["دارای\n\nیک", "دارای یک"], ["عامل،\n\nچند", "عامل، چند"]] }],
  // CE 1397 q77: the booklet reads each option right to left (A's size, then B's); the bank typed them left to right.
  ["kunkurcomputer-q-1277-1397-b0-077", { options: { 2: "۱۴۰۰ - ۶۰۰", 3: "۹۰۰ - ۱۰۰" } }],
  // CE 1397 q78: line breaks in the middle of sentences.
  ["kunkurcomputer-q-1277-1397-b0-078", { stem: [["را\n\nیک", "را یک"], ["کامپیوتر\n\nA", "کامپیوتر A"], ["برای\n\nB", "برای B"], ["بسته\n\n۱۰۰۰", "بسته ۱۰۰۰"], ["ماند؟\n\n(مقادیری", "ماند؟\n(مقادیری"]] }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1393-b1-067", { stem: [["تعداد\n\nبلوک‌های", "تعداد بلوک‌های"]] }],
  ["kunkurcomputer-q-1277-1393-b1-068", { stem: [["در\n\nحالی", "در حالی"]] }],
  // CE 1394 q68: the booklet's code is C8FF; the bank typed CAFF.
  ["kunkurcomputer-q-1277-1394-b1-068", { stem: [["$CAFF_{16}$", "$C8FF_{16}$"]] }],
  // CE 1395 q66: the two numbers and the three encoded options were only in the crop.
  ["kunkurcomputer-q-1277-1395-b1-066", {
    append: "‭A = 0 | 111 | 0010‬\n‭B = 0 | 111 | 0001‬\n(به ترتیب S، E و F)",
    options: { 1: "‭0 | 111 | 0011‬", 2: "‭0 | 111 | 0010‬", 3: "‭0 | 111 | 0001‬", 4: "غیرقابل نمایش" },
  }],
  // CE 1395 q68: the TLB excerpt was only in the crop.
  ["kunkurcomputer-q-1277-1395-b1-068", { stem: [["\n\n[جدول در تصویر منبع]", ""]], table: { headers: ["قطعه (۴ بیت)", "صفحه (۱۲ بیت)", "بلوک (۱۲ بیت)"], rows: [["1", "2FF", "012"], ["5", "02A", "2A5"]] } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1394-b1-067", { stem: [["ظرفیت\n\n512kByte", "ظرفیت 512kByte"], ["اندازه\n\nنشانه", "اندازه نشانه"]] }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1396-b1-071", { stem: [["۲۰٪\n\nاز", "۲۰٪ از"], ["این\n\nبرنامه", "این برنامه"]] }],
  ["kunkurcomputer-q-1277-1398-b0-073", { stem: [["روش\n\n$$A", "روش $$A"]] }],
  // CE 1399 q80: the memory contents were only in the crop.
  ["kunkurcomputer-q-1277-1399-b0-080", { table: { headers: ["آدرس", "محتوای حافظه"], rows: [["100", "100"], ["110", "-10"], ["120", "120"], ["130", "-12"]] } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1399-b0-076", { stem: [["دارای\n\nگنجایش", "دارای گنجایش"]] }],
  ["kunkurcomputer-q-1277-1399-b0-077", { stem: [["دستور\n\nمختلف", "دستور مختلف"]] }],
  ["kunkurcomputer-q-1277-1399-b0-078", { stem: [["اضافه\n\nمی‌شوند،", "اضافه می‌شوند،"]] }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1400-b1-088", { stem: [["این\n\nعدد", "این عدد"]] }],
  // CE 1401 q89: the function table and the four options (a table of u, v, w, z) were only in the crop.
  ["kunkurcomputer-q-1277-1401-b1-089", {
    table: { headers: ["S1", "S0", "C0", "F"], rows: [["0", "0", "0", "A"], ["0", "0", "1", "A+1"], ["0", "1", "0", "A+B"], ["0", "1", "1", "A+B+1"], ["1", "0", "0", "A-1"], ["1", "0", "1", "A"], ["1", "1", "0", "A-B-1"], ["1", "1", "1", "A-B"]] },
    options: {
      1: String.raw`$u=0,\ v=b_i,\ w=1,\ z=b'_i$`,
      2: String.raw`$u=b_i,\ v=1,\ w=b'_i,\ z=0$`,
      3: String.raw`$u=0,\ v=b'_i,\ w=1,\ z=b_i$`,
      4: String.raw`$u=b'_i,\ v=0,\ w=b_i,\ z=1$`,
    },
  }],
  // CE 1402 q89: the four options are function tables printed only in the crop (rows S1S0Cin = 100, 101, 110, 111).
  ["kunkurcomputer-q-1277-1402-b1-089", { options: {
    1: "‭100: A-1 | 101: A | 110: A-B-1 | 111: A-B+1‬",
    2: "‭100: A-1 | 101: A | 110: A-B-1 | 111: A-B‬",
    3: "‭100: A | 101: A-1 | 110: A-B-1 | 111: A-B‬",
    4: "‭100: A | 101: A+1 | 110: A-B | 111: A-B+1‬",
  } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1402-b1-083", { stem: [["آن\n\nکدام", "آن کدام"]] }],
  ["kunkurcomputer-q-1277-1402-b1-084", { stem: [["صرف\n\nمی‌شود.", "صرف می‌شود."]] }],
  ["kunkurcomputer-q-1277-1402-b1-085", { stem: [["دو\n\nثبات", "دو ثبات"], ["طراحی\n\nاین", "طراحی این"]] }],
  ["kunkurcomputer-q-1277-1402-b1-086", { stem: [["از\n\nیک", "از یک"], ["می‌توان\n\nاز", "می‌توان از"], ["بین\n\nخانه‌های", "بین خانه‌های"]] }],
  ["kunkurcomputer-q-1277-1402-b1-087", { stem: [["ظرفیت\n\n512", "ظرفیت 512"], ["offset)\n\nچند", "offset) چند"]] }],
  ["kunkurcomputer-q-1277-1402-b1-088", { stem: [["X\n\nt1:DR", "X\nt1:DR"], ["M[MAR]\n\nt2:M[MAR]", "M[MAR]\nt2:M[MAR]"], ["A\n\nt3:A", "A\nt3:A"]] }],
  // CE 1403 q84, q85 and q87: the tables and the four microprogram options were only in the crop; q88 drops a bank note.
  ["kunkurcomputer-q-1277-1403-b1-084", { stem: [["\n\n[جدول در تصویر منبع]", ""]], table: { headers: ["علامت", "توان", "مانتیس"], rows: [["1 bit", "3 bit", "4 bit"]] } }],
  ["kunkurcomputer-q-1277-1403-b1-085", { stem: [["\n\n[جدول در تصویر منبع]", ""]], table: {
    headers: ["", "درصد A", "درصد B", "درصد C", "درصد D", "CPI کلاس A", "CPI کلاس B", "CPI کلاس C", "CPI کلاس D"],
    rows: [["P1", "30", "20", "40", "10", "1", "3", "2", "1"], ["P2", "20", "50", "20", "10", "1", "1", "3", "2"]],
  } }],
  ["kunkurcomputer-q-1277-1403-b1-087", { options: {
    1: "‭NOP S JMP OVER / NOP U JMP FETCH‬",
    2: "‭NOP I CALL INDRCT / ACTDR U JMP NEXT / WRITE U JMP FETCH‬",
    3: "‭PCTAR U JMP NEXT / READ, INCPC U JMP NEXT / DRTAR‬",
    4: "‭READ U JMP NEXT / DRTAR U RET‬",
  } }],
  ["kunkurcomputer-q-1277-1403-b1-088", { stem: [[" جهت خواندن نیز در برش تصویر منبع حفظ شده است.", ""]] }],
  // CE 1404 q85: the four options are function tables printed only in the crop (rows S1S0Cin = 100, 101, 110, 111).
  ["kunkurcomputer-q-1277-1404-b1-085", { dropFigures: true, figures: ["outputs/content_review/source_crops/doc-aa34d7e9ba352ebc-q-0085-p20-b14-image.png"], options: {
    1: "‭100: A-1 | 101: A | 110: A-B-1 | 111: A-B‬",
    2: "‭100: A-1 | 101: A | 110: A-B-1 | 111: A-B+1‬",
    3: "‭100: A | 101: A-1 | 110: A-B-1 | 111: A-B‬",
    4: "‭100: A | 101: A+1 | 110: A-B | 111: A-B+1‬",
  } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1401-b1-093", { stem: [["آوردن\n\nعملوندها", "آوردن عملوندها"], ["استفاده\n\nمی", "استفاده می"]] }],
  // CE 1405 q89: the three formula boxes under the circuit were dropped from the stem; typed from the booklet.
  ["kunkurcomputer-q-1277-1405-b1-089", { append: String.raw`$P_i, G_i$ Generator: $P_i=A'_i+B_i\cdot A_i$ و $G_i=A'_iB_i$
XOR Generator: $S_i=A_i\oplus B_i\oplus C_{i-1}$
C-Generator: $C_0=G_0+P_0C_{in}$، $C_1=G_1+P_1G_0+P_1P_2C_{in}$، …، $C_i=G_i+P_iG_{i-1}+P_iP_{i-1}G_{i-2}+\cdots+\prod_{i=1}^{n}P_iC_{in}$` }],
  // CE 1394 q59: the four options are circuits drawn only in the crop; described as drawn.
  ["kunkurcomputer-q-1277-1394-b1-059", { options: {
    1: String.raw`مالتی‌پلکسر $4\times1$ با ورودی‌های داده $I_0=0$، $I_1=C$، $I_2=1$، $I_3=0$ و خطوط انتخاب $S_1=B$ و $S_0=A$`,
    2: String.raw`مالتی‌پلکسر $2\times1$ با خط انتخاب A؛ ورودی ۰ خروجی گیت AND روی B و C، و ورودی ۱ برابر $\overline B$`,
    3: String.raw`دیکودر با ورودی‌های C (بیت ۰)، B (بیت ۱) و A (بیت ۲) و هشت خروجی؛ خروجی‌های ۳، ۴ و ۵ به یک گیت OR`,
    4: String.raw`دیکودر $2\times4$ با ورودی‌های B (بیت ۰) و A (بیت ۱)؛ خروجی ۱ با C به یک گیت AND و خروجی آن و خروجی ۲ به یک گیت OR`,
  } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1393-b1-061", { stem: [["را\n\nبه", "را به"]] }],
  ["kunkurcomputer-q-1277-1393-b1-062", { stem: [["جمع\n\nحاصل", "جمع حاصل"]] }],
  // CE 1395 q60: the booklet's f1 is Σm(0,3,5,8,11,15) and its option 3 is Σm(1,3,7,8,9,14,15); the bank typed 2 for 3 in both.
  ["kunkurcomputer-q-1277-1395-b1-060", { stem: [["m(0,2,5,8,11,15)", "m(0,3,5,8,11,15)"]], options: { 3: String.raw`$f_2(a,b,c,d) = \sum m(1,3,7,8,9,14,15)$` } }],
  // CE 1395 q61: each option is a pair read right to left (PI, then EPI); written out so the order cannot flip.
  ["kunkurcomputer-q-1277-1395-b1-061", { options: { 1: "PI = ۴، EPI = ۰", 2: "PI = ۴، EPI = ۲", 3: "PI = ۶، EPI = ۲", 4: "PI = ۷، EPI = ۰" } }],
  // CE 1395 q62: the four options are output waveforms drawn only in the crop; described against the drawn X, Y and clock.
  ["kunkurcomputer-q-1277-1395-b1-062", { append: "شکل موج ورودی‌ها در دفترچه: ساعت سه پالس دارد و تغییر حالت در لبه‌های پایین‌رونده است. X هم‌زمان با لبهٔ بالاروندهٔ دوم ساعت از ۰ به ۱ می‌رود و ۱ می‌ماند. Y اندکی پیش از لبهٔ پایین‌روندهٔ سوم از ۰ به ۱ می‌رود و ۱ می‌ماند.", options: {
    1: "خروجی از لبهٔ پایین‌روندهٔ دوم ساعت ۱ می‌شود و با بالا رفتن Y به ۰ برمی‌گردد.",
    2: "خروجی از لبهٔ پایین‌روندهٔ دوم ساعت ۱ می‌شود و تا لبهٔ پایین‌روندهٔ سوم ۱ می‌ماند.",
    3: "خروجی همزمان با بالا رفتن X یک می‌شود و همزمان با بالا رفتن Y به ۰ برمی‌گردد.",
    4: "خروجی همزمان با بالا رفتن X یک می‌شود و تا لبهٔ پایین‌روندهٔ سوم ساعت ۱ می‌ماند.",
  } }],
  // CE 1396 q66: the four options are circuits drawn only in the crop; described as drawn.
  ["kunkurcomputer-q-1277-1396-b1-066", { options: {
    1: String.raw`دیکودر $2\times4$ با ورودی‌های B ($I_0$) و A ($I_1$)؛ $y_0$ با C و $y_3$ با $C'$ هر کدام به یک AND، و خروجی این دو AND و $y_1$ به یک OR`,
    2: String.raw`دیکودر $3\times8$ با ورودی‌های C ($I_0$)، B ($I_1$) و A ($I_2$)؛ خروجی‌های $y_1$، $y_2$، $y_3$ و $y_6$ به یک گیت AND`,
    3: String.raw`مالتی‌پلکسر $2\times1$ با انتخاب A؛ $I_0$ خروجی OR روی B و C و $I_1$ خروجی AND روی B و C`,
    4: String.raw`مالتی‌پلکسر $4\times1$ با ورودی‌های $I_0=C$، $I_1=1$، $I_2=0$، $I_3=C'$ و خطوط انتخاب $s_1=B$ و $s_0=A$`,
  } }],
  // CE 1397 q68: the state table was only in the crop.
  ["kunkurcomputer-q-1277-1397-b0-068", { stem: [["\n\n[جدول در تصویر منبع]", ""]], table: { headers: ["PS", "NS/Z (X=0)", "NS/Z (X=1)"], rows: [["A", "B/1", "A/0"], ["B", "A/1", "B/1"], ["C", "C/0", "D/1"], ["D", "E/0", "C/1"], ["E", "D/0", "E/1"]] } }],
  // CE 1398 q67: the two descriptions (Verilog and VHDL) were only in the crop.
  ["kunkurcomputer-q-1277-1398-b0-067", { append: "نسخهٔ وریلاگ:\n" + code([
    "module DQ(Q, D, M, N);",
    "    output Q;",
    "    input D, M, N;",
    "    reg Q;",
    "    always @(posedge M or negedge N)",
    "        if (N == 0) Q = 1'b0;",
    "        else Q = D;",
    "endmodule",
  ]) + "\nنسخهٔ VHDL:\n" + code([
    "architecture ARCH of DQ is",
    "begin",
    "    process(M, N)",
    "    begin",
    "        if (N = '0') then",
    "            Q <= '0';",
    "        elsif (rising_edge(M)) then",
    "            Q <= D;",
    "        end if;",
    "    end process;",
    "end ARCH;",
  ]) }],
  // CE 1398 q68: the four options are state sequences drawn with arrows only in the crop.
  ["kunkurcomputer-q-1277-1398-b0-068", { figures: ["outputs/content_review/source_crops/doc-80ceacadef3e68ab-q-0068-p15-b9-image.png"], options: {
    1: "‭000 → 011 → 110 → 010‬، و 010 به خودش برمی‌گردد",
    2: "‭000 → 011 → 110 → 010 → 000‬",
    3: "‭000 → 011 → 101 → 010 → 000‬",
    4: "‭000 → 011 → 101 → 110 → 100 → 000‬",
  } }],
  // Line breaks in the middle of sentences (bank OCR), joined.
  ["kunkurcomputer-q-1277-1397-b0-066", { stem: [["مینتترم\n\nبی", "مینتترم بی"]] }],
  ["kunkurcomputer-q-1277-1398-b0-065", { stem: [["انجام\n\nمی‌شود.", "انجام می‌شود."]] }],
  ["kunkurcomputer-q-1277-1398-b0-069", { stem: [["۱۰۱۱۰۱۰۰\n\nباشند،", "۱۰۱۱۰۱۰۰ باشند،"]] }],
  // CE 1399 q65: the state table was only in the crop (the x=1 entries of b, c and e are «e», checked enlarged).
  ["kunkurcomputer-q-1277-1399-b0-065", { table: { headers: ["PS", "NS/Output (x=0)", "NS/Output (x=1)"], rows: [["a", "f/0", "b/0"], ["b", "d/0", "e/0"], ["c", "f/0", "e/0"], ["d", "g/1", "a/0"], ["e", "d/0", "e/0"], ["f", "f/1", "b/1"], ["g", "g/0", "h/1"], ["h", "g/1", "a/0"]] } }],
  // CE 1399 q67: the bank read the booklet's «+» in option 1 as «-».
  ["kunkurcomputer-q-1277-1399-b0-067", { options: { 1: String.raw`$F'(X,Y,Z)=X'+(Y'+Z)(Y+Z')$` } }],
  // CE 1399 q72: the four options are circuits drawn only in the crop; described as drawn.
  ["kunkurcomputer-q-1277-1399-b0-072", { options: {
    1: String.raw`مالتی‌پلکسر $2\times1$ با انتخاب z؛ ورودی ۰ خروجی AND روی x و y و ورودی ۱ خروجی OR روی x و y`,
    2: String.raw`مالتی‌پلکسر $2\times1$ با انتخاب $\overline x$؛ ورودی ۰ خروجی AND روی $\overline y$ و $\overline z$ و ورودی ۱ خروجی OR روی $\overline y$ و $\overline z$`,
    3: String.raw`مالتی‌پلکسر $2\times1$ با انتخاب y؛ ورودی ۰ خروجی AND روی x و $\overline z$ و ورودی ۱ خروجی OR روی x و $\overline z$`,
    4: String.raw`مالتی‌پلکسر $2\times1$ با انتخاب $\overline x$؛ ورودی ۰ خروجی AND روی z و y و ورودی ۱ خروجی OR روی z و y`,
  } }],
  // CE 1400 q81 and q84: the options (state sequences, D-input equations) and q84's example were only in the crop.
  ["kunkurcomputer-q-1277-1400-b1-081", { figures: ["outputs/content_review/source_crops/doc-ce948be666ad51cd-q-0080-p18-b9-image.png"], options: {
    1: "‭111 → 110 → 010‬، و 010 به خودش برمی‌گردد",
    2: "‭111 → 001 → 011 → 101 → 111‬",
    3: "‭111 → 001 → 110 → 100 → 111‬",
    4: "‭111 → 000 → 011 → 101 → 010 → 111‬",
  } }],
  ["kunkurcomputer-q-1277-1400-b1-084", {
    stem: [["برای مثال، توالی‌های x و z در تصویر زیر آمده‌اند.", "برای مثال:"]],
    append: "‭x = 0101001000110010010‬\n‭z = 0000001000000010010‬",
    options: {
      1: String.raw`$d_0=x\oplus y_1$، $d_1=y_1\bar y_0+\bar x(y_1+y_0)$`,
      2: String.raw`$d_0=x+y_1\bar y_0$، $d_1=\bar x(y_1\oplus y_0)$`,
      3: String.raw`$d_0=x\oplus y_1$، $d_1=y_1y_0+\bar x(\bar y_1+y_0)$`,
      4: String.raw`$d_0=x\odot y_1$، $d_1=y_1\bar y_0x+\bar xy_1$`,
    },
  }],
  // CE 1390 q75: the five process listings (with the run time of each block) were only in the crop.
  ["kunkurcomputer-q-1277-1390-b1-075", { append: code([
    "P0: code1();        // 10",
    "    P(s); code2(); V(s);   // 15",
    "P1: code3();        // 40",
    "P2: code4();        // 50",
    "P3: code5();        // 10",
    "    P(s); code6(); V(s);   // 15",
    "P4: code7();        // 15",
    "    P(s); code8(); V(s);   // 10",
  ]) }],
  // CE 1401 q81: the booklet's options 1 and 2 are A-3 and A+3; the bank typed 2 for 3.
  ["kunkurcomputer-q-1277-1401-b1-081", { options: { 1: "$A-3$", 2: "$A+3$" } }],
  // CE 1401 q84: the four options are circuits drawn only in the crop; each gate pair is given by what it feeds to R and S.
  ["kunkurcomputer-q-1277-1401-b1-084", { options: {
    1: String.raw`دو گیت NAND با ورودی‌های وارون‌شده: $R=T+\overline Q$ و $S=T+Q$`,
    2: String.raw`دو گیت NOR با ورودی‌های وارون‌شده: $R=T\cdot Q$ و $S=T\cdot\overline Q$`,
    3: String.raw`دو گیت NAND: $R=\overline{T\cdot Q}$ و $S=\overline{T\cdot\overline Q}$`,
    4: String.raw`دو گیت NOR: $R=\overline{T+\overline Q}$ و $S=\overline{T+Q}$`,
  } }],
  // CE 1401 q83: the multiplexer circuit was not attached; a clean cut of it (from the booklet crop) is added.
  ["kunkurcomputer-q-1277-1401-b1-083", { figures: ["outputs/source_fidelity/assets/ce_ours/ce1401_q0083_mux.png"] }],
  // CE 1402 q81: the booklet asks for register R3; the bank typed R2.
  ["kunkurcomputer-q-1277-1402-b1-081", { stem: [["مقدار ثبات R₂ پس از ۵ سیکل", "مقدار ثبات R₃ پس از ۵ سیکل"]] }],
  // CE 1402 q82: the Verilog description, the input waveforms and the four output waveforms were only in the crop.
  ["kunkurcomputer-q-1277-1402-b1-082", {
    append: code([
      "module ParReg (A, load, clear, clk, Z);",
      "    input A, load, clear, clk;  output Z;",
      "    wire [7:0] A;  wire load, clear, clk;",
      "    reg  [7:0] Z;",
      "    always @(posedge clk)",
      "        if (!clear) begin",
      "            Z = 0;",
      "        end else begin",
      "            if (load) begin",
      "                Z = A;",
      "            end",
      "        end",
      "endmodule",
    ]) + "\n(نسخهٔ VHDL همین رفتار را توصیف می‌کند.)\nشکل موج ورودی‌ها در دفترچه: ورودی داده در چهار لبهٔ بالاروندهٔ ساعت به ترتیب ۱۰، ۲۰، ۳۰ و ۴۰ است. clear یک بار کمی بعد از لبهٔ اول (پیش از لبهٔ دوم) و یک بار درست در لبهٔ سوم برای مدت کوتاهی ۰ می‌شود. load پیش از لبهٔ اول ۱ می‌شود و بین لبهٔ سوم و چهارم به ۰ برمی‌گردد.",
    options: {
      1: "Z به ترتیب ۱۰، ۲۰ و ۳۰ می‌شود.",
      2: "Z به ترتیب ۱۰، ۰، ۲۰، ۰ و ۴۰ می‌شود.",
      3: "Z به ترتیب ۱۰، ۰، ۲۰، ۰ و ۳۰ می‌شود.",
      4: "Z به ترتیب ۱۰، ۲۰ و ۰ می‌شود و ۰ می‌ماند.",
    },
  }],
  // CE 1403 q77: the four options are state diagrams drawn only in the crop; each is listed as its transitions (input/output, «-» = any).
  ["kunkurcomputer-q-1277-1403-b1-077", { options: {
    1: "‭00 →(-/0) 01؛ 01 →(0/0) 01؛ 01 →(1/1) 00؛ 10 →(-/0) 11؛ 11 →(-/0) 11‬",
    2: "‭00 →(-/0) 10؛ 10 →(0/0) 10؛ 10 →(1/1) 01؛ 01 →(1/0) 01؛ 01 →(0/0) 11؛ 11 →(-/0) 11‬",
    3: "‭00 →(-/0) 10؛ 10 →(0/0) 10؛ 10 →(1/1) 00؛ 01 →(-/0) 11؛ 11 →(-/0) 11‬",
    4: "‭00 →(-/0) 01؛ 01 →(0/0) 01؛ 01 →(1/1) 10؛ 10 →(1/0) 10؛ 10 →(0/0) 11؛ 11 →(-/0) 11‬",
  } }],
  // CE 1403 q80: the Verilog description and the input waveforms were only in the crop.
  ["kunkurcomputer-q-1277-1403-b1-080", { append: code([
    "module exam(A, B, d, e, z);",
    "    input A, B, d, e;",
    "    output z;",
    "    wire [7:0] A, B;",
    "    wire d, e;",
    "    reg [7:0] z;",
    "    always @(posedge d or negedge e)",
    "        if (!e) begin",
    "            z <= 0;",
    "        end else begin",
    "            z <= z + A + B;",
    "        end",
    "endmodule",
  ]) + "\n(نسخهٔ VHDL همین رفتار را توصیف می‌کند.)\nشکل موج ورودی‌ها در دفترچه: d چهار پالس دارد و در لبه‌های بالاروندهٔ آن، (A, B) به ترتیب (۱۰، ۱۲)، (۱۴، ۱۶)، (۵، ۶) و (۱۰، ۱۰) است. e در ابتدا ۰ است و کمی بعد از لبهٔ اول d یک می‌شود؛ بین لبهٔ دوم و سوم d برای مدت کوتاهی ۰ می‌شود و دوباره ۱ می‌ماند." }],
  // CE 1404 q77: the figure is small; the gate delays written inside it are typed as well.
  ["kunkurcomputer-q-1277-1404-b1-077", { append: "تأخیرهای شکل: Y خروجی AND روی C و A (تأخیر ۵)، X خروجی AND روی $\\overline A$ و B (تأخیر ۵) که $\\overline A$ از یک وارونگر با تأخیر ۲۰ می‌آید، W خروجی OR روی Y و X (تأخیر ۵) که ساعت فلیپ‌فلاپ است، و ورودی D از وارونگری با تأخیر ۵ روی خروجی Z می‌آید." }],
  // CE 1404 q78: the state table was only in the crop.
  ["kunkurcomputer-q-1277-1404-b1-078", { table: { headers: ["حالت فعلی", "حالت بعدی (x=0)", "حالت بعدی (x=1)", "خروجی (x=0)", "خروجی (x=1)"], rows: [["a", "f", "b", "0", "0"], ["b", "d", "c", "0", "0"], ["c", "f", "e", "0", "0"], ["d", "g", "a", "1", "0"], ["e", "d", "c", "0", "0"], ["f", "f", "b", "1", "1"], ["g", "g", "h", "0", "1"], ["h", "g", "a", "1", "0"]] } }],
  // CE 1405 q76: the state table and the four state diagrams (options) were only in the crop; each diagram is listed as its transitions (input/output).
  ["kunkurcomputer-q-1277-1405-b1-076", {
    table: { headers: ["حالت فعلی", "حالت بعدی (x=0)", "حالت بعدی (x=1)", "خروجی (x=0)", "خروجی (x=1)"], rows: [["a", "f", "e", "1", "0"], ["b", "f", "e", "1", "0"], ["c", "b", "c", "1", "0"], ["d", "f", "g", "1", "0"], ["e", "a", "e", "0", "1"], ["f", "f", "e", "0", "1"], ["g", "b", "g", "0", "1"]] },
    options: {
      1: "‭00 →(1/1) 00؛ 00 →(0/0) 01؛ 01 →(1/0) 00؛ 01 →(0/1) 10؛ 10 →(0/0) 10؛ 10 →(1/1) 00؛ 11 →(1/0) 11؛ 11 →(0/1) 01‬",
      2: "‭00 →(1/1) 00؛ 00 →(0/0) 01؛ 01 →(1/1) 01؛ 01 →(0/0) 11؛ 11 →(1/0) 01؛ 11 →(0/1) 00؛ 10 →(1/0) 10؛ 10 →(0/1) 11‬",
      3: "‭00 →(1/0) 00؛ 00 →(0/1) 10؛ 10 →(0/1) 01؛ 10 →(1/0) 11؛ 01 →(0/0) 01؛ 01 →(1/1) 11؛ 11 →(0/0) 11؛ 11 →(1/1) 10‬",
      4: "‭00 →(0/1) 10؛ 00 →(1/0) 11؛ 10 →(1/1) 10؛ 10 →(0/0) 00؛ 01 →(0/1) 01؛ 01 →(1/0) 00؛ 11 →(0/0) 11؛ 11 →(1/1) 10‬",
    },
  }],
  // CE 1399 q53: the four strings were only in the crop (checked enlarged).
  ["kunkurcomputer-q-1277-1399-b0-053", { append: "‭الف) abaabaaabaa‬\n‭ب) aaaabaaaa‬\n‭ج) baaaaabaaaab‬\n‭د) baaaaabaa‬" }],
  // CE 1404 q47: option 4 is (0+ε)(11*0)*1* in the booklet.
  ["kunkurcomputer-q-1277-1404-b1-047", { options: { 4: String.raw`$(0+\varepsilon)(11^*0)^*1^*$` } }],
  // CE 1404 q50: no figure in the booklet; the bank attached a stray image.
  ["kunkurcomputer-q-1277-1404-b1-050", { dropFigures: true }],
  // PhD 2354 1404 q14: option 3 was empty; typed as the booklet prints it.
  ["kunkurcomputer-q-2354-1404-b0-014", { options: { 3: String.raw`$O(\log_2^{\,n})$` } }],
  // PhD 2354 1404 q21: the "figure" is the three equations, already typed in the stem.
  ["kunkurcomputer-q-2354-1404-b0-021", { dropFigures: true }],
  // PhD 2354 1404 q31: the ALU table is typed in the stem; only the datapath drawing is kept.
  ["kunkurcomputer-q-2354-1404-b0-031", { dropFigures: true, figures: ["outputs/phd_question_bank/assets/1404/phd-1404-5deb8ce4ef34e66c-q0031-figure.png"] }],
  // PhD 2354 1403 q26: the multiplexer circuit had no figure crop; cut by us from the question image.
  ["kunkurcomputer-q-2354-1403-b0-026", { figures: ["outputs/source_fidelity/assets/ce_ours/phd1403_q0026_mux.png"] }],
  // PhD 2354 1401 q7 and q15: the figure crops repeat the statements/constraints already typed in the stem.
  ["kunkurcomputer-q-2354-1401-b0-007", { dropFigures: true }],
  ["kunkurcomputer-q-2354-1401-b0-015", { dropFigures: true }],
  // PhD 2354 1397 q2, q10, q17: the figure crops repeat the formulas already typed in the stem.
  ["kunkurcomputer-q-2354-1397-b0-002", { dropFigures: true }],
  ["kunkurcomputer-q-2354-1397-b0-010", { dropFigures: true }],
  ["kunkurcomputer-q-2354-1397-b0-017", { dropFigures: true }],
  // PhD 2354 1396 q11: the options list the three orders right to left like the algorithm names; typed with the names so the order is unambiguous.
  ["kunkurcomputer-q-2354-1396-b0-011", { options: {
    1: String.raw`Insertion sort: $O(1)$، Randomized quicksort: $O(\log_2N)$، MergeSort: $O(1)$`,
    2: String.raw`Insertion sort: $O(1)$، Randomized quicksort: $O(\log_2N)$، MergeSort: $O(\log_2N)$`,
    3: String.raw`Insertion sort: $O(N^2)$، Randomized quicksort: $O(N\log_2N)$، MergeSort: $O(N\log_2N)$`,
    4: String.raw`Insertion sort: $O(1)$، Randomized quicksort: $O(N\log_2N)$، MergeSort: $O(N\log_2N)$`,
  } }],
  // PhD 2354 1394 q20: the booklet says 1393 points in both places (the bank had 1392 in the second).
  ["kunkurcomputer-q-2354-1394-b0-020", { stem: [["۱۳۹۲ نقطه", "۱۳۹۳ نقطه"]] }],
  // PhD 2355 1401-1402: notes pointing at «the original image» are dropped (the figure is shown); figure crops that repeat a typed formula, code or table are dropped.
  ["kunkurcomputer-q-2355-1401-b0-001", { stem: [[" جدول حالت و مدار در تصویر اصلی آورده شده‌اند.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-001", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-005", { stem: [[" مدار دیکدر و بافرها در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-006", { stem: [[" مدار در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-008", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-009", { stem: [[" ماشین حالت در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-013", { stem: [[" مسیر داده در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1402-b0-017", { stem: [[" دیاگرام جمع‌کننده در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1401-b0-013", { dropFigures: true, stem: [["در جدول اصلی: ",""]] }],
  ["kunkurcomputer-q-2355-1401-b0-002", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1401-b0-009", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1401-b0-010", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1401-b0-015", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1401-b0-016", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1401-b0-019", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1402-b0-003", { dropFigures: true }],
  // PhD 2355 1400: notes pointing at the source image dropped; figure crops repeating typed formulas or tables dropped.
  ["kunkurcomputer-q-2355-1400-b0-003", { stem: [[" نمودار در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-004", { stem: [[" مدار در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-005", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1400-b0-006", { stem: [[" نمودار هشت‌حالتهٔ اصلی در تصویر آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-007", { stem: [[" مدار در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-009", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1400-b0-010", { stem: [[" مدار دیکودر 3×8 و گیت‌ها در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-012", { stem: [[" شکل در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1400-b0-016", { dropFigures: true }],
  // PhD 2355 1399: notes pointing at the source image dropped; figure crops repeating typed formulas dropped;
  // q4 options typed (the four mux drawings only repeat the inputs); q6 keeps the printed table instead of the typed rows.
  ["kunkurcomputer-q-2355-1399-b0-001", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1399-b0-004", { stem: [["؛ مدار هر گزینه در تصویر اصلی مستقل آمده است.","."]], options: {
    1: String.raw`$I_0=\overline{c}$، $I_1=0$، $I_2=1$، $I_3=c$`,
    2: String.raw`$I_0=\overline{c}$، $I_1=1$، $I_2=0$، $I_3=c$`,
    3: String.raw`$I_0=c$، $I_1=0$، $I_2=1$، $I_3=\overline{c}$`,
    4: String.raw`$I_0=c$، $I_1=1$، $I_2=0$، $I_3=\overline{c}$`,
  } }],
  ["kunkurcomputer-q-2355-1399-b0-005", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1399-b0-006", { stem: [["\nستون‌ها: PS؛ NS/y برای x=0؛ NS/y برای x=1.\na: c/0؛ a/1\nb: d/0؛ b/1\nc: a/1؛ c/0\nd: b/1؛ d/0\ne: c/0؛ e/1\nf: a/1؛ c/0\nجدول چاپی در تصویر اصلی نیز آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1399-b0-009", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1399-b0-017", { stem: [[" مدار در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1399-b0-019", { dropFigures: true }],
  // PhD 2355 1398: notes pointing at the source image dropped; formula/option-table crops dropped; q18 options as
  // drawings only; q19/q20 options typed; q19 circuit cut from the page ourselves (no figure crop existed).
  ["kunkurcomputer-q-2355-1398-b0-004", { stem: [["؛ مدار و ماشین حالت در تصویر اصلی آمده‌اند.","."]] }],
  ["kunkurcomputer-q-2355-1398-b0-017", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1398-b0-018", { stem: [[" اتصال‌های Source و Destination و چهار نمودار Data Valid، Data Bus و Data Accepted در تصویرهای اصلی آمده‌اند.",""]], optionImagesOnly: true }],
  ["kunkurcomputer-q-2355-1398-b0-019", { stem: [[" مدار اصلی شامل MUXها و F.A در تصویر آمده است.",""]], figures: ["outputs/source_fidelity/assets/ce_ours/phd1398_q0019_alu.png"], options: {
    1: String.raw`یک مدار مقایسه‌کنندهٔ یک‌بیتی است.`,
    2: String.raw`یک مدار جمع‌کننده و تفریق‌کنندهٔ یک‌بیتی است.`,
    3: String.raw`یک ALU یک‌بیتی است و چهار عمل $A+B$، $A+\overline B$، $A\wedge B$ و $A\vee B$ را انجام می‌دهد.`,
    4: String.raw`یک ALU یک‌بیتی است و چهار عمل $A+B$، $A-B$ به کمک مکمل ۲، $A\wedge B$ و $A\vee B$ را انجام می‌دهد.`,
  } }],
  ["kunkurcomputer-q-2355-1398-b0-020", { dropFigures: true, options: {
    1: String.raw`Push Ax: $SP\leftarrow SP+2$ سپس $M[SP]\leftarrow Ax$؛ Pop Bx: $Bx\leftarrow M[SP]$ سپس $SP\leftarrow SP-2$`,
    2: String.raw`Push Ax: $M[SP]\leftarrow Ax$؛ Pop Bx: $Bx\leftarrow M[SP]$`,
    3: String.raw`Push Ax: $SP\leftarrow SP-2$ سپس $M[SP]\leftarrow Ax$؛ Pop Bx: $Bx\leftarrow M[SP]$ سپس $SP\leftarrow SP+2$`,
    4: String.raw`Push Ax: $M[SP]\leftarrow Ax$ سپس $SP\leftarrow SP+2$؛ Pop Bx: $SP\leftarrow SP-2$ سپس $Bx\leftarrow M[SP]$`,
  } }],
  // PhD 2355 1397: notes pointing at the source image dropped; q2 output names were typed as powers.
  ["kunkurcomputer-q-2355-1397-b0-001", { stem: [[" مدار و اتصال انتخاب‌گرهای A و C در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1397-b0-002", { stem: [["$Z^2Z^1Z^0$","$Z_2Z_1Z_0$"],[" مدار اصلی سه فلیپ‌فلاپ JK در تصویر آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1397-b0-011", { stem: [[" قالب اصلی شامل S با ۱ بیت، E با ۵ بیت و M با ۱۰ بیت در تصویر آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1397-b0-012", { stem: [[" طرح اصلی حافظهٔ تابع در تصویر آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1397-b0-014", { stem: [[" در شکل، زمان S1 برابر ۱ نانوثانیه و زمان مراحل S2 تا S6 به ترتیب t2 تا t6 است.",""]] }],
  // PhD 2355 1396: notes pointing at the source image dropped; q11 options spelled out per field (the printed
  // dashes read right to left); q16 address order stated plainly.
  ["kunkurcomputer-q-2355-1396-b0-001", { stem: [[" مدار شامل majority_3 و majority_5 در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-002", { stem: [[" مدار با چهار HA در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-005", { stem: [[" مدار وارون‌سازها و گیت xor در تصویر منبع آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-006", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-007", { stem: [[" درخت گیت‌های xor در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-008", { stem: [[" مدار در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-010", { stem: [[" مدار decoder و MUX در تصویر اصلی آمده است.",""]] }],
  ["kunkurcomputer-q-2355-1396-b0-011", { stem: [[" رشتهٔ عددی گزینه‌ها از چپ به راستِ تصویر چاپی ثبت شده است.",""]], options: {
    1: String.raw`tag: ۴۹، index: ۱۱، offset: ۴`,
    2: String.raw`tag: ۵۰، index: ۱۰، offset: ۴`,
    3: String.raw`tag: ۴۹، index: ۱۰، offset: ۵`,
    4: String.raw`tag: ۴۸، index: ۱۱، offset: ۵`,
  } }],
  ["kunkurcomputer-q-2355-1396-b0-013", { dropFigures: true }],
  ["kunkurcomputer-q-2355-1396-b0-016", { dropFigures: true, stem: [["ترتیب تولید آدرس‌ها مطابق جهت پیکانِ تصویر از راست به چپ است: ","آدرس‌ها به این ترتیب تولید می‌شوند: "]] }],
  // PhD 2355 1394: q14/q15/q19 options are drawings (images only); q15's stem crop repeated all four options;
  // q19 keeps the printed K-map instead of the typed rows.
  ["kunkurcomputer-q-2355-1394-b0-002", { stem: [["، don’t care: $(2,15)$", " و بی‌اهمیت‌ها $d(2,15)$"]] }],
  ["kunkurcomputer-q-2355-1394-b0-014", { optionImagesOnly: true }],
  ["kunkurcomputer-q-2355-1394-b0-015", { optionImagesOnly: true, dropFigures: true }],
  ["kunkurcomputer-q-2355-1394-b0-019", { optionImagesOnly: true, stem: [["\nدر جدول اصلی، ترتیب ستون‌های cd از چپ 00، 01، 11، 10 و ترتیب سطرهای ab از بالا 00، 01، 11، 10 است. سطرها به‌ترتیب: [۱،۰،۱،۰]؛ [۰،۱،۰،۱]؛ [۱،۰،۰،۰]؛ [۰،x،x،۱].", ""]] }],
  // PhD 2355 1393: q12 keeps the printed delay table instead of the typed line.
  ["kunkurcomputer-q-2355-1393-b0-012", { stem: [["\nجدول اصلی: برای $t_{pLH}$ حداقل ۵ و حداکثر ۷؛ برای $t_{pHL}$ حداقل ۳ و حداکثر ۵.", ""]] }],
  // PhD 2356 1393 q15: the crop only repeats the typed A^k definition.
  ["kunkurcomputer-q-2356-1393-b0-015", { dropFigures: true }],
  // PhD 2356 1394: q12 crop repeats the typed recurrence; q20 typed 1392 where the booklet has 1393.
  ["kunkurcomputer-q-2356-1394-b0-012", { dropFigures: true }],
  ["kunkurcomputer-q-2356-1394-b0-020", { stem: [["از۱۳۹۲نقطهٔ", "از ۱۳۹۳ نقطهٔ"]] }],
  // PhD 2356 1398 q13: the booklet prints k-1 for k=1 in the sum.
  ["kunkurcomputer-q-2356-1398-b0-013", { stem: [["sum_{k-1}^{i}", "sum_{k=1}^{i}"]] }],
  // PhD 2356 1400: crops that only repeat typed triples, formulas, arrays or digit sequences dropped; notes on print order dropped.
  ["kunkurcomputer-q-2356-1400-b0-004", { dropFigures: true, stem: [[" سه‌تایی‌ها از چپ به راست مطابق چاپ:", " سه‌تایی‌ها:"]] }],
  ["kunkurcomputer-q-2356-1400-b0-011", { dropFigures: true }],
  ["kunkurcomputer-q-2356-1400-b0-014", { dropFigures: true }],
  ["kunkurcomputer-q-2356-1400-b0-015", { stem: [[" توالی گزینه‌ها از چپ به راست مطابق چاپ است.", ""]] }],
  ["kunkurcomputer-q-2356-1400-b0-017", { dropFigures: true }],
  // PhD 2312 1395: notes pointing at the source image dropped; q16 options typed (the crops repeat the formulas);
  // q29 crop only repeats the typed stage times.
  ["kunkurcomputer-q-2312-1395-b0-016", { stem: [[" مدار اصلی دیکودرها در تصویر آمده است.",""]], options: {
    1: String.raw`$f(a,b,c)=ab\overline c+\overline a\,\overline b\,\overline c+\overline a\,\overline b c$`,
    2: String.raw`$f(a,b,c)=\overline a b\overline c+a\overline b\,\overline c+a\overline b c$`,
    3: String.raw`$f(a,b,c)=\overline a b\overline c+a\overline b\,\overline c$`,
    4: String.raw`$f(a,b,c)=ab\overline c+\overline a\,\overline b\,\overline c+a\overline b c$`,
  } }],
  ["kunkurcomputer-q-2312-1395-b0-021", { stem: [[" دو مدار و برچسب‌های «اول» و «دوم» در تصویر اصلی آمده‌اند.",""]] }],
  ["kunkurcomputer-q-2312-1395-b0-029", { dropFigures: true }],
  ["kunkurcomputer-q-2312-1395-b0-030", { stem: [[" مدار جمع‌کنندهٔ nبیتی و گیت‌ها در تصویر اصلی آمده است.",""]] }],
  // IT 1400 q98: the figure crop only repeats the typed code.
  ["kunkurcomputer-q-1276-1400-658A-098", { dropFigures: true }],
  // IT 1399 q92: the booklet prints # for the not-entails sign.
  ["kunkurcomputer-q-1276-1399-460E-092", { stem: [[String.raw`$KB\#\alpha$`, String.raw`$KB\not\models\alpha$`]] }],
  // IT 1398: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1398-859A-095", { stem: [["\nپردازه\nزمان ورود\nزمان مورد استفاده از cpu\nP₁\n۲\n۵\nP₂\n۳\n۱۳\nP₃\n۰\n۸\nP₄\n۵\n۴\nP₅\n۱\n۱۰", ""]] }],
  ["kunkurcomputer-q-1276-1398-859A-099", { stem: [["\nزمان مورد استفاده از CPU (CPU Burst time)\nزمان ورود\nپردازه\n۸\n۰\nP₁\n۹\n۱\nP₂\n۵\n۲\nP₃\n۴\n۳\nP₄", ""]] }],
  // IT 1397: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1397-260E-041", { stem: [["\n$$O(n) \\quad (۲) \\quad O(۱) \\quad (۱)$$\n\n$$O(\\sqrt{n}) \\quad (۴) \\quad O(\\sqrt{n}) \\quad (۳)$$", ""]] }],
  ["kunkurcomputer-q-1276-1397-260E-099", { stem: [["\nMax و Allocation به‌ترتیب A,B,C:\nP0: Max=(0,0,1), Allocation=(0,0,1)\nP1: Max=(1,7,5), Allocation=(1,0,0)\nP2: Max=(2,3,5), Allocation=(1,3,5)\nP3: Max=(0,6,5), Allocation=(0,6,3)\nTotal Allocation=(2,9,9), Available=(1,5,2)", ""]] }],
  // IT 1396: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1396-259C-100", { stem: [["\n(تخصیص یافته)\n\nA\nB\nC\nP₀\n۰\n۱\n۲\nP₁\n۲\n۰\n۳\nP₂\n۳\n۲\n۰\nP₃\n۱\n۰\n۲\nP₄\n۱\n۱\n۰\n\n(حداکثر نیاز)\n\nA\nB\nC\nP₀\n۳\n۶\n۸\nP₁\n۷\n۳\n۶\nP₂\n۵\n۳\n۳\nP₃\n۴\n۵\n۹\nP₄\n۲\n۳\n۳\n\n(تعداد منابع اولیه)\n\nA\nB\nC\n۸\n۶\n۱۰", ""]] }],
  ["kunkurcomputer-q-1276-1396-259C-048", { dropFigures: true }],
  // IT 1395: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1395-252A-088", { stem: [["\nنام برنامه / زمان ورود(s) / مدت زمان لازم برای اجرا(s)\nA / ۱۰ / ۱۰۰\nB / ۲۰ / ۵۰\nC / ۲۵۰ / ۳۰\nD / ۲۶۰ / ۳۰\nE / ۲۷۰ / ۴۰", ""]] }],
  ["kunkurcomputer-q-1276-1395-252A-093", { stem: [["\nستون‌ها به ترتیب R₁,R₂,R₃,R₄:\nتخصیص: P₁=(۰,۰,۱,۰)، P₂=(۲,۰,۰,۱)، P₃=(۰,۱,۲,۰).\nنیاز: P₁=(۲,۰,۰,۱)، P₂=(۱,۰,۱,۰)، P₃=(۲,۱,۰,۰).\nموجود: (۲,۱,۰,۰).", ""]] }],
  ["kunkurcomputer-q-1276-1395-252A-039", { stem: [["\nکلید\nاندیس درهم‌سازی\nB\n۳\nC\n۴\nD\n۵\nF\n۰\nI\n۳\nN\n۱\nU\n۱\n", ""]] }],
  ["kunkurcomputer-q-1276-1395-252A-090", { stem: [[" (به ترتیب از راست به چپ)", ""]], options: { 1: "منطقی ۹ و فیزیکی ۱۱ بیت", 2: "منطقی ۱۱ و فیزیکی ۱۳ بیت", 3: "منطقی ۱۳ و فیزیکی ۱۵ بیت", 4: "منطقی ۱۵ و فیزیکی ۱۳ بیت" } }],
  // IT 1394: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1394-351C-090", { stem: [["\nP1: 2\nP2: 6\nP3: 1\nP4: 4\nP5: 3", ""]] }],
  // IT 1393: typed copies of printed tables dropped (the table crop is shown).
  ["kunkurcomputer-q-1276-1393-350A-090", { stem: [["\nP: Request x₁ kB سپس Request x₂ kB\nQ: Request y₁ kB سپس Request y₂ kB", ""]] }],
  // IT 1390 q79: the booklet prints 310, not 315, in options 1, 3 and 4.
  ["kunkurcomputer-q-1276-1390-351B-079", { options: { 1: "۳۱۰، ۲۶۰ و زمانبندی SSTF از FIFO بهتر عمل می‌کند.", 3: "۳۱۰، ۳۱۰ و SSTF مشابه FIFO عمل می‌کند.", 4: "۳۱۰، ۳۵۶ و زمانبندی FIFO از SSTF بهتر عمل می‌کند." } }],
  // IT 1387 q52: the booklet names S(n) the successful and U(n) the unsuccessful average.
  ["kunkurcomputer-q-1276-1387-b0-052", { stem: [["$U(n)$ و $S(n)$ به ترتیب", "$S(n)$ و $U(n)$ به ترتیب"]] }],
  ["kunkurcomputer-q-2357-1399-b0-011", { stem: [[" درخت عبارت و هشت برگ در تصویر اصلی آمده‌اند.", ""]] }],
  ["kunkurcomputer-q-2357-1399-b0-016", { stem: [[" شبکه و ظرفیت‌ها در تصویر اصلی آمده است.", ""]] }],
  // PhD 2207 1395 q7: the booklet prints F_{h+3} - 1 in option 1.
  ["kunkurcomputer-q-2207-1395-b0-007", { options: { 1: "$G_h=F_{h+3}-1$" } }],
  // IT 1391 q89: the booklet prints 34, not 24, in option 3.
  ["kunkurcomputer-q-1276-1391-349A-089", { options: { 3: "34" } }],
  // IT 1388 q104: the booklet's stage delays are 2, 1, 2, 4 and 3 ns.
  ["kunkurcomputer-q-1276-1388-C-104", { stem: [["۱،۲،۳،۴ و ۳", "۲، ۱، ۲، ۴ و ۳"]] }],
  // IT 1386 q104: the booklet asks for the single mixed number 7 1/7, not 7 and 1/7.
  ["kunkurcomputer-q-1276-1386-421-104", { stem: [["نمایش عدد ۷ و ۱/۷", "نمایش عدد $7\\tfrac{1}{7}$"]] }],
  // CE 1403 q45: the booklet's paths have length 3, not 2.
  ["kunkurcomputer-q-1277-1403-b1-045", { stem: [["هر مسیر به طول ۲", "هر مسیر به طول ۳"]] }],
  // CE 1405 q44: option 2 is 3^8 in the booklet.
  ["kunkurcomputer-q-1277-1405-b1-044", { options: { 2: "$3^8$" } }],
  // CE 1401 q50: options 1 and 3 say k^3 in the booklet.
  ["kunkurcomputer-q-1277-1401-b1-050", { options: { 1: "این گراف حداکثر $k^3$ رأس دارد.", 3: "این گراف حداقل $k^3$ یال دارد." } }],
  // CE 1396 q46: the options were only in the crop.
  ["kunkurcomputer-q-1277-1396-b1-046", { options: { 1: "$3\\times3!$", 2: "$6^4$", 3: "$4\\times3!$", 4: "$9!-4\\times3!$" } }],
  // CE 1399 q47: the booklet asks for 2^1026, not a tower of powers.
  ["kunkurcomputer-q-1277-1399-b0-047", { stem: [["$2^{2^{1026}}$", "$2^{1026}$"]] }],
  // IT 1398 q33: the last constant in option 4 is c_3.
  ["kunkurcomputer-q-1276-1398-859A-033", { options: { 4: "$a_n=(c_1n+c_2)5^n+c_3(-2)^n$" } }],
  // CE 1393 q73: the process table was only in the crop.
  ["kunkurcomputer-q-1277-1393-b1-073", { table: { headers: ["فرایند", "زمان ورود", "زمان پردازش"], rows: [["A", "0", "$t_A=3$"], ["B", "1", "$t_B$"], ["C", "2", "$t_C$"]] } }],
  // CE 1401 q119: the three tables were only in the crop.
  ["kunkurcomputer-q-1277-1401-b1-119", { stem: [["(برای راحتی، اسامی انگلیسی ستون‌ها نیز نوشته شده است.)", "(برای راحتی، اسامی انگلیسی ستون‌ها نیز نوشته شده است.)\nStudent(Stn, Name): شمارهٔ دانشجویی، نام و نام‌خانوادگی\nCourse(Code, CName): کد درس، نام درس\nTaken(CCode, SStn, Mark): کد درس، شمارهٔ دانشجو، نمره"]] }],
  // CE 1399 q141, q149, q150: the schemas and the query were only in the crops; typed from the booklet.
  ["kunkurcomputer-q-1277-1399-b0-141", {
    append: "Supplier(s#, sname, city): تولیدکننده (شماره، نام، شهر)\nSupply(s#, p#, Qty): تولید (شمارهٔ تولیدکننده، شمارهٔ قطعه، تعداد)\nPart(p#, color): قطعه (شماره، رنگ)\n" + code(["select s#", "from supplier", "where s# = p#;"]),
  }],
  ["kunkurcomputer-q-1277-1399-b0-149", { stem: [["با توجه به پایگاه داده زیر در مورد پرس‌وجوهای SQL زیر کدام مورد درست است؟", "با توجه به پایگاه داده زیر در مورد پرس‌وجوهای SQL زیر کدام مورد درست است؟\nNode(NID, Name, Color, Description): شماره، نام، رنگ و شرح هر گره.\nEdge(NID1, NID2, EdgeType): هر سطر یک یال جهت‌دار از نوع EdgeType از گرهٔ NID1 به گرهٔ NID2 است."]] }],
  ["kunkurcomputer-q-1277-1399-b0-150", { stem: [["چند مورد از دستورهای SQL (الف، ب و ج) برای این پرس‌وجو درست است؟", "چند مورد از دستورهای SQL (الف، ب و ج) برای این پرس‌وجو درست است؟\nBook(ISBN, Title, Author, Publisher): کتاب‌ها\nMember(MID, Name, MDate): اعضا\nBorrow(MID, ISBN, BDate, Duration): امانت کتاب (کلید: MID, ISBN, BDate)"]] }],
  // CE 1396 q109: the four expressions were only in the crop; typed from the booklet.
  ["kunkurcomputer-q-1277-1396-b1-109", {
    options: {
      1: "$\\Pi_{Title}(\\sigma_{publisher='wiley'}(Book))-\\Pi_{ISBN}(Borrow)$",
      2: "$\\Pi_{Title,ISBN}(\\sigma_{publisher='wiley'}(Book))\\div\\Pi_{ISBN}(Borrow)$",
      3: "$\\Pi_{Title}\\big((\\Pi_{ISBN,MID}(Borrow)\\div\\Pi_{MID}(Member))\\bowtie Borrow\\big)$",
      4: "$\\Pi_{Title}\\big((\\Pi_{ISBN}(\\sigma_{publisher='wiley'}(Book))-\\Pi_{ISBN}(Borrow))\\bowtie Book\\big)$",
    },
  }],
  // CE 1395 q118: the schema and the four expressions were only in the crop; typed from the booklet.
  ["kunkurcomputer-q-1277-1395-b2-118", {
    stem: [["تعریف رابطه‌ها، کلیدها، متغیرهای برد و عبارت‌های A تا D در تصویر آمده‌اند.", ""]],
    append: [
      "ST(STID, STNAME, STLEVEL, STMAJOR): دانشجویان (کلید STID)",
      "CO(COID, CONAME, COTYPE, CREDIT): درس‌ها (کلید COID)",
      "STCO(STID, COID, YR, TR, GRADE): درس‌های انتخاب‌شده (کلید STID, COID, YR, TR)",
      "RANGEVAR STX OVER ST، RANGEVAR COX OVER CO، RANGEVAR STCOX OVER STCO",
      "A) STX.STNAME WHERE EXISTS STCOX (STCOX.YR='94-95' AND STCOX.TR='2' AND STCOX.STID=STX.STID AND EXISTS COX (COX.COID=STCOX.COID AND COX.COTYPE='p'))",
      "B) $\\Pi_{STNAME}\\big(ST\\bowtie(\\sigma_{YR='94\\text{-}95'\\wedge TR='2'}(STCO)\\bowtie\\sigma_{COTYPE='p'}(CO))\\big)$",
      "C) STX.STNAME WHERE NOT EXISTS STCOX (STCOX.YR='94-95' AND STCOX.TR='2' AND STCOX.STID=STX.STID AND NOT EXISTS COX (COX.COID=STCOX.COID AND COX.COTYPE='p'))",
      "D) $\\Pi_{STNAME}\\big(\\sigma_{YR='94\\text{-}95'\\wedge TR='2'\\wedge COTYPE='p'}(ST\\bowtie(STCO\\bowtie CO))\\big)$",
    ].join("\n"),
  }],
  // CE 1393 q104: the three sample tables were only in the crop.
  ["kunkurcomputer-q-1277-1393-b2-104", {
    tables: [
      { headers: ["eid", "NN", "ename"], rows: [["e1", "111111", "John"], ["e2", "222222", "Jack"], ["e3", "333333", "Bob"], ["e4", "444444", "Joe"]] },
      { headers: ["did", "dname", "address"], rows: [["d1", "Books", "a1"], ["d2", "Electronics", "a2"], ["d3", "Health", "a3"]] },
      { headers: ["eid", "did", "salary"], rows: [["e1", "d1", "1"], ["e2", "d1", "3"], ["e3", "d1", "4"], ["e4", "d3", "4"]] },
    ],
  }],
  // CE 1401 q79: in the booklet option 3 is 1/19 and option 4 is zero; the bank swapped them.
  ["kunkurcomputer-q-1277-1401-b1-079", { options: { 3: "$\\frac1{19}$", 4: "صفر" } }],
  // CE 1381 q101: the directed graph was not attached.
  ["kunkurcomputer-q-1277-1381-b0-101", { figures: ["outputs/source_fidelity/assets/ce_next20/ce1381_q0101_component.png"] }],
  // CE 1399 q120: the game tree was not attached.
  ["kunkurcomputer-q-1277-1399-b0-120", { figures: ["outputs/content_review/source_crops/doc-f383d14836ddf149-q-0120-p27-b28-image.png"] }],
  // CE 1398 q119: the grid figure was not attached.
  ["kunkurcomputer-q-1277-1398-b0-119", { figures: ["outputs/content_review/source_crops/doc-80ceacadef3e68ab-q-0119-p30-b10-table.png"] }],
  // CE 1396 q120: the attached "figures" are page barcodes; the question is text only.
  ["kunkurcomputer-q-1277-1396-b1-120", { dropFigures: true }],
  // CE 1394 q119 points back to q118's graph, which is attached here too.
  ["kunkurcomputer-q-1277-1394-b2-119", { stem: [["تابع اکتشافی h سوال ۱۱۸", "تابع اکتشافی h در گراف زیر (همان گراف سؤال ۱۱۸)"]] }],
  // CE 1403 q62: the example array was only in the crop.
  ["kunkurcomputer-q-1277-1403-b1-062", { stem: [["برای مثال آرایهٔ زیر.", "برای مثال آرایهٔ $\\langle40,50,60,70,80,90,10,20,30\\rangle$."]] }],
  // CE 1403 q64: the task table was only in the crop; typed from the booklet.
  ["kunkurcomputer-q-1277-1403-b1-064", {
    table: {
      headers: ["کار", "w1", "w2", "w3", "w4", "w5", "w6", "w7"],
      rows: [["مهلت (Deadline)", "10", "2", "3", "3", "2", "5", "1"], ["جریمه (Penalty)", "10", "45", "55", "65", "70", "33", "18"]],
    },
  }],
  ["kunkurcomputer-q-1277-1402-b1-064", { options: { 2:"الگوریتم B نمونه‌ای به اندازه $n$ را با حل بازگشتی هشت نمونه با اندازه $\\frac{n}{2}$ حل می‌کند و سپس راه‌حل‌های آنها را در زمان $O(n^3)$ ترکیب می‌کنند." } }],
]);
