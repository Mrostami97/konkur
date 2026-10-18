// The 1406 syllabus as the bank's topic tree, and the rules that place each of
// the owner's tagged questions on it.
//
// The owner tags questions with free text (course, chapter, a one-line topic),
// so one subject arrives under several names and almost every topic is unique
// to its question. The site needs a fixed tree so a candidate can build an exam
// from one topic and see how often it came: subject → chapter → topic, taken
// from the official 1406 syllabus (apps/web/src/content/editorial.ts). Topics
// the 1406 list dropped (dynamic programming, greedy, NP, ...) sit in their own
// chapter so past questions stay usable without passing as 1406 material. The
// owner's own wording stays on the question as its fine-grained label.
//
// A rule matches the owner's chapter and topic text; the first rule that fits
// wins, so specific rules come before general ones.

/** Topic code prefix per subject. */
export const SUBJECT_PREFIX = { "data-structures-algorithms": "dsa" };

/** The tree: code → title, grouped by chapter. Order is the syllabus order. */
export const TREE = {
  "data-structures-algorithms": [
    {
      code: "dsa-basics",
      title: "مقدمات",
      topics: [
        ["dsa-basics-adt", "داده‌مدل، داده‌گونهٔ انتزاعی و داده‌ساختار"],
        ["dsa-basics-arrays", "آرایه، ماتریس و نمایش در حافظه"],
        ["dsa-basics-recursion", "توابع بازگشتی و ردیابی آن‌ها"],
        ["dsa-basics-correctness", "درستی الگوریتم و ناوردای حلقه"],
        ["dsa-basics-counting", "شمارش و ریاضی پایه"],
      ],
    },
    {
      code: "dsa-analysis",
      title: "تحلیل الگوریتم",
      topics: [
        ["dsa-analysis-growth", "رشد توابع و نمادهای مجانبی"],
        ["dsa-analysis-loops", "تحلیل زمانی و شمارش اجرای حلقه‌ها"],
        ["dsa-analysis-recurrences", "روابط بازگشتی و حل آن‌ها"],
        ["dsa-analysis-master", "قضیهٔ اصلی"],
        ["dsa-analysis-amortized", "تحلیل سرشکن"],
        ["dsa-analysis-divide", "تقسیم و حل (ادغامی، ضرب اعداد، جست‌وجوی دودویی)"],
        ["dsa-analysis-randomized", "تحلیل الگوریتم‌های تصادفی"],
      ],
    },
    {
      code: "dsa-structures",
      title: "داده‌ساختارهای پایه",
      topics: [
        ["dsa-structures-stack-queue", "صف و پشته"],
        ["dsa-structures-linked-list", "لیست پیوندی"],
        ["dsa-structures-trees", "درخت، درخت دودویی و پیمایش"],
        ["dsa-structures-expression", "درخت عبارت و تبدیل نگارش‌ها (میانوندی، پسوندی)"],
        ["dsa-structures-trie", "داده‌ساختار ترای"],
        ["dsa-structures-bst", "درخت دودویی جست‌وجو"],
        ["dsa-structures-heap", "صف اولویت و هرم"],
      ],
    },
    {
      code: "dsa-sorting",
      title: "مرتب‌سازی و انتخاب",
      topics: [
        ["dsa-sorting-lower-bound", "درخت تصمیم و کران پایین"],
        ["dsa-sorting-comparison", "مرتب‌سازی‌های مقایسه‌ای (درجی، ادغامی، هرمی، سریع)"],
        ["dsa-sorting-linear", "مرتب‌سازی خطی: شمارشی، مبنایی و سطلی"],
        ["dsa-sorting-selection", "مرتبهٔ آماری، کمینه و بیشینه و انتخاب k-امین"],
        ["dsa-sorting-hashing", "درهم‌سازی"],
        ["dsa-sorting-search", "جست‌وجو در آرایه و ماتریس مرتب"],
      ],
    },
    {
      code: "dsa-advanced",
      title: "داده‌ساختارهای پیشرفته و گراف",
      topics: [
        ["dsa-advanced-disjoint-sets", "مجموعه‌های مجزا"],
        ["dsa-advanced-balanced", "درخت‌های متوازن (قرمز–سیاه)"],
        ["dsa-advanced-interval", "درخت بازه"],
        ["dsa-advanced-graph-basics", "گراف و پیاده‌سازی آن"],
        ["dsa-advanced-traversal", "جست‌وجوی عمق‌اول و سطح‌اول و کاربردها"],
        ["dsa-advanced-topological", "ترتیب توپولوژیکی و مؤلفه‌های قویاً همبند"],
        ["dsa-advanced-shortest-path", "کوتاه‌ترین مسیر: دایکسترا و بلمن–فورد"],
      ],
    },
    {
      code: "dsa-off",
      title: "خارج از سرفصل ۱۴۰۶ (برای مرور سال‌های قبل)",
      offSyllabus: true,
      topics: [
        ["dsa-off-dp", "برنامه‌ریزی پویا"],
        ["dsa-off-greedy", "الگوریتم‌های حریصانه و کد هافمن"],
        ["dsa-off-mst", "درخت پوشای کمینه"],
        ["dsa-off-all-pairs", "کوتاه‌ترین مسیر همهٔ زوج‌ها (فلوید)"],
        ["dsa-off-np", "پیچیدگی محاسباتی، NP و کاهش"],
        ["dsa-off-backtracking", "عقبگرد و شاخه‌وکران"],
        ["dsa-off-string", "تطابق رشته و الگوریتم‌های رشته"],
        ["dsa-off-avl-b", "AVL، درخت B و ساختارهای ذخیره‌سازی خارجی"],
        ["dsa-off-other", "مباحث دیگر"],
      ],
    },
  ],
  automata: [
    { code: "aut-basics", title: "مقدمات: زبان، گرامر و اثبات", topics: [["aut-basics-languages", "زبان‌ها، الفبا و عملیات روی زبان‌ها"], ["aut-basics-grammars", "گرامرها و سلسله‌مراتب چامسکی"]] },
    { code: "aut-fa", title: "ماشین‌های حالت متناهی", topics: [["aut-fa-dfa", "پذیرندهٔ متناهی قطعی"], ["aut-fa-nfa", "پذیرندهٔ متناهی غیرقطعی و تبدیل‌ها"]] },
    { code: "aut-regular", title: "زبان‌ها و گرامرهای منظم", topics: [["aut-regular-expressions", "عبارات منظم"], ["aut-regular-grammars", "گرامرهای منظم و خطی"], ["aut-regular-languages", "تشخیص منظم بودن زبان"]] },
    { code: "aut-regular-props", title: "خواص زبان‌های منظم", topics: [["aut-regular-props-closure", "خواص بستاری زبان‌های منظم"], ["aut-regular-props-pumping", "لم پمپاژ و زبان‌های نامنظم"]] },
    { code: "aut-cfl", title: "زبان‌های مستقل از متن", topics: [["aut-cfl-grammars", "گرامرها و زبان‌های مستقل از متن"], ["aut-cfl-derivation", "اشتقاق و درخت اشتقاق"], ["aut-cfl-ambiguity", "ابهام و زبان‌های ذاتاً مبهم"]] },
    { code: "aut-simplify", title: "ساده‌سازی گرامرها", topics: [["aut-simplify-normal-forms", "فرم نرمال چامسکی و گرایباخ"], ["aut-simplify-cyk", "مسئلهٔ عضویت و CYK"]] },
    { code: "aut-pda", title: "ماشین‌های پشته‌ای", topics: [["aut-pda-pda", "ماشین پشته‌ای و هم‌ارزی با گرامر"], ["aut-pda-deterministic", "ماشین پشته‌ای قطعی"]] },
    { code: "aut-cfl-props", title: "خواص زبان‌های مستقل از متن", topics: [["aut-cfl-props-pumping", "لم پمپاژ مستقل از متن"], ["aut-cfl-props-closure", "خواص بستاری و زبان‌های غیرمستقل از متن"]] },
    { code: "aut-computability", title: "محاسبه‌پذیری و پیچیدگی", topics: [["aut-computability-tm", "ماشین تورینگ و تز چرچ–تورینگ"], ["aut-computability-decidability", "تصمیم‌پذیری، بازگشتی و بازگشتی‌شمارش‌پذیر"], ["aut-computability-halting", "مسئلهٔ توقف، کاهش و PCP"], ["aut-computability-complexity", "پیچیدگی محاسباتی، P و NP"]] },
  ],
  "programming-fundamentals": [
    { code: "pf-language", title: "حل مسئله و زبان", topics: [["pf-language-concepts", "مفاهیم زبان‌های برنامه‌نویسی"], ["pf-language-types", "انواع داده، عملگرها و عبارت‌ها"], ["pf-language-numbers", "نمایش داده و اعداد، عملگرهای بیتی"]] },
    { code: "pf-control", title: "کنترل و ساختار برنامه", topics: [["pf-control-loops", "شرط، حلقه و ردگیری برنامه"], ["pf-control-functions", "تابع، پارامتر و دامنهٔ متغیر"], ["pf-control-arrays", "آرایه، رشته و اشاره‌گر"], ["pf-control-memory", "مدیریت حافظه"], ["pf-control-oop", "C++، Java و شیءگرایی"]] },
    { code: "pf-thinking", title: "تفکر الگوریتمی", topics: [["pf-thinking-recursion", "بازگشت"], ["pf-thinking-numeric", "محاسبات و الگوریتم‌های عددی"]] },
  ],
  "discrete-math": [
    { code: "dm-logic", title: "منطق و اثبات", topics: [["dm-logic-propositional", "منطق گزاره‌ها"], ["dm-logic-predicate", "منطق محمولات و سورها"]] },
    { code: "dm-sets", title: "مجموعه، تابع و عدد", topics: [["dm-sets-relations", "مجموعه، رابطه و تابع"], ["dm-sets-numbers", "نظریهٔ اعداد و همنهشتی"], ["dm-sets-algebra", "ساختارهای جبری"]] },
    { code: "dm-counting", title: "شمارش و احتمال گسسته", topics: [["dm-counting-combinatorics", "شمارش و ترکیبیات"], ["dm-counting-recurrences", "روابط بازگشتی و توابع مولد"]] },
    { code: "dm-graphs", title: "رابطه، گراف و مدل محاسبات", topics: [["dm-graphs-graphs", "گراف‌ها، درخت‌ها و رنگ‌آمیزی"], ["dm-graphs-orders", "ترتیب جزئی و جبر بول"]] },
  ],
  "computer-architecture": [
    { code: "arch-cpu", title: "ساختار پردازنده", topics: [["arch-cpu-isa", "مجموعه دستورها و حالت‌های آدرس‌دهی"], ["arch-cpu-rtl", "اسمبلی، انتقال ثبات و ریزعملیات"], ["arch-cpu-arith", "نمایش داده و حساب کامپیوتر"]] },
    { code: "arch-perf", title: "کارایی و خط لوله", topics: [["arch-perf-performance", "کارایی و معیارهای آن"], ["arch-perf-pipeline", "خط لوله و مخاطرات"], ["arch-perf-parallel", "چندپردازنده و پردازش موازی"]] },
    { code: "arch-memory", title: "حافظه و ورودی/خروجی", topics: [["arch-memory-cache", "حافظهٔ نهان"], ["arch-memory-main", "حافظهٔ اصلی، گذرگاه و ورودی/خروجی"], ["arch-memory-secondary", "حافظهٔ جانبی و دیسک"]] },
  ],
  "linear-algebra": [
    { code: "la-systems", title: "ماتریس و دستگاه خطی", topics: [["la-systems-solve", "دستگاه‌های خطی و رتبه"], ["la-systems-decomposition", "تجزیهٔ ماتریس (LU، QR، چولسکی)"], ["la-systems-least-squares", "کمترین مربعات"], ["la-systems-norms", "نرم، عدد حالت و روش‌های تکراری"]] },
    { code: "la-spaces", title: "فضاهای برداری", topics: [["la-spaces-spaces", "فضای برداری، پایه و تعامد"], ["la-spaces-transforms", "تبدیل خطی و ماتریس‌های متعامد"]] },
    { code: "la-spectral", title: "ویژگی‌های طیفی", topics: [["la-spectral-determinant", "دترمینان و انواع ماتریس"], ["la-spectral-eigen", "مقادیر و بردارهای ویژه، قطری‌سازی"]] },
  ],
  statistics: [
    { code: "st-prob", title: "احتمال", topics: [["st-prob-events", "پیشامدها، احتمال شرطی و بیز"], ["st-prob-rv", "متغیر تصادفی و توزیع"]] },
    { code: "st-dist", title: "توزیع و ممان", topics: [["st-dist-moments", "امید، واریانس، کوواریانس و ممان‌ها"], ["st-dist-joint", "توزیع توأم و شرطی"], ["st-dist-inequalities", "نامساوی‌های احتمال"]] },
    { code: "st-inference", title: "استنتاج آماری", topics: [["st-inference-clt", "قضیهٔ حد مرکزی"], ["st-inference-estimation", "نمونه‌گیری و برآورد"], ["st-inference-tests", "آزمون فرض و تحلیل واریانس"]] },
  ],
};

/**
 * A question's site subject: algorithmic chapters inside other booklets'
 * courses (computer science prints analysis and recurrences under «مبانی
 * نظریهٔ محاسبه» and «مبانی کامپیوتر») go to data structures and algorithms,
 * where a candidate building a topic exam looks for them.
 */
const ALGORITHMIC_CHAPTER = /تحلیل پیچیدگی|تحلیل الگوریتم|روابط بازگشتی|مرتب‌سازی|درخت‌ها|درخت‌های جست|پشته و صف|لیست پیوندی|لیست‌های پیوندی|مجموعه‌های مجزا|الگوریتم‌های گراف|جریان در شبکه|ساختمان داده|جست‌وجو$|^جستجو$|تقسیم و حل|الگوریتم‌های حریصانه|انتخاب|مدل‌سازی برنامه‌ریزی/;

/** The bank's course names → site subjects. */
export const COURSE_SUBJECT = [
  [/ساختمان داده|الگوریتم/, "data-structures-algorithms"],
  [/نظریه|اتوماتا|ماشین‌ها/, "automata"],
  [/^مبانی کامپیوتر/, "programming-fundamentals"],
  [/گسسته/, "discrete-math"],
  [/معماری/, "computer-architecture"],
  [/جبر خطی|ماتریس/, "linear-algebra"],
  [/آمار/, "statistics"],
  [/انگلیسی/, "english"],
  [/مدار منطقی/, "digital-logic"],
  [/سیستم عامل|سیستم‌های عامل/, "operating-systems"],
  [/شبکه/, "computer-networks"],
  [/پایگاه داده/, "databases"],
  [/هوش مصنوعی/, "artificial-intelligence"],
];

/** Courses the 1406 exam dropped: kept in the bank, marked as outside 1406. */
export const OUTSIDE_1406 = [
  [/ریاضی عمومی/, "general-math", "ریاضی عمومی"],
  [/ریاضیات مهندسی/, "engineering-math", "ریاضیات مهندسی"],
  [/سیگنال/, "signals", "سیگنال‌ها و سیستم‌ها"],
  [/الکترونیک دیجیتال/, "digital-electronics", "الکترونیک دیجیتال"],
  [/مدیریت/, "management", "اصول و مبانی مدیریت"],
];

/** [regex over "chapter | topic", topic code]. First match wins. */
export const RULES = {
  "data-structures-algorithms": [
    // Off-syllabus first: their words also appear in syllabus chapters.
    [/هافمن|حریصانه|زمان‌بندی کار|کوله‌پشتی کسری/, "dsa-off-greedy"],
    [/پوشای کمینه|فراگیر|پریم|کراسکال|کروسکال|MST/i, "dsa-off-mst"],
    [/فلوید|floyd|همهٔ زوج|همه زوج|وارشال/i, "dsa-off-all-pairs"],
    [/برنامه‌ریزی پویا|برنامه‌نویسی پویا|پویا|ضرب زنجیره|کوله‌پشتی|زیردنبالهٔ مشترک|LCS/i, "dsa-off-dp"],
    [/NP|پیچیدگی محاسباتی|کلاس‌های پیچیدگی|کاهش|ارضاپذیری|تقریبی|بلندترین مسیر/, "dsa-off-np"],
    [/عقب‌گرد|عقبگرد|شاخه و حد|شاخه‌وکران|فضای حالت/, "dsa-off-backtracking"],
    [/تطبیق رشته|تابع شکست|KMP|الگوریتم‌های رشته/i, "dsa-off-string"],
    [/AVL|درخت B|B\+|B-tree|ذخیره‌سازی خارجی|فایل/i, "dsa-off-avl-b"],
    // Graphs.
    [/دایکسترا|بلمن|کوتاه‌ترین مسیر|کوتاهترین/, "dsa-advanced-shortest-path"],
    [/توپولوژیک|قویاً همبند|قویا همبند|مؤلفه‌های قوی/, "dsa-advanced-topological"],
    [/عمق اول|عمق‌اول|سطح اول|سطح‌اول|DFS|BFS|پیمایش.*گراف|گراف.*پیمایش|یال برگشتی|یال پسرو/i, "dsa-advanced-traversal"],
    [/مجموعه‌های مجزا|اجتماع.*مجموعه|union|find/i, "dsa-advanced-disjoint-sets"],
    [/قرمز|سیاه|متوازن/, "dsa-advanced-balanced"],
    [/درخت بازه/, "dsa-advanced-interval"],
    [/گراف/, "dsa-advanced-graph-basics"],
    // Sorting, selection, hashing, search.
    [/درهم‌سازی|درهم سازی|هش|وارسی/, "dsa-sorting-hashing"],
    [/کران پایین|درخت تصمیم/, "dsa-sorting-lower-bound"],
    [/شمارشی|مبنایی|سطلی|radix|counting sort/i, "dsa-sorting-linear"],
    [/k-ام|kام|k ام|انتخاب|آمار ترتیبی|مرتبهٔ آماری|میانه|کمینه و بیشینه|کمینه.*بیشینه|ماکزیمم و مینیمم|دومین/, "dsa-sorting-selection"],
    [/مرتب‌سازی|مرتب سازی|Partition|افراز|مرتب‌شده/, "dsa-sorting-comparison"],
    [/جستجو در ماتریس|جست‌وجو در ماتریس|آرایهٔ چرخشی|آرایه چرخشی|جستجوی سه‌تایی|عنصر پرتکرار|عدد گمشده|عضو غایب|جست‌وجوی زوج/, "dsa-sorting-search"],
    // Basic structures.
    [/میانوندی|پسوندی|پیشوندی|درخت عبارت|نگارش/, "dsa-structures-expression"],
    [/ترای|trie/i, "dsa-structures-trie"],
    [/هرم|هیپ|heap|deap|صف اولویت/i, "dsa-structures-heap"],
    [/جستجوی دودویی|جست‌وجوی دودویی|جستجو دودویی/, "dsa-analysis-divide"],
    [/درخت جستجو|درخت جست‌وجو|درخت‌های جستجو|درخت‌های جست‌وجو|BST/i, "dsa-structures-bst"],
    [/پشته|صف/, "dsa-structures-stack-queue"],
    [/لیست/, "dsa-structures-linked-list"],
    [/درخت|پیمایش|جنگل|نخ‌کشی/, "dsa-structures-trees"],
    // Analysis.
    [/قضیهٔ اصلی|قضیه اصلی|master/i, "dsa-analysis-master"],
    [/سرشکن|amortized/i, "dsa-analysis-amortized"],
    [/تصادفی/, "dsa-analysis-randomized"],
    [/تقسیم و حل|تقسیم و غلبه|تقسیم‌وحل|ضرب اعداد|ضرب.*ماتریس بلوکی/, "dsa-analysis-divide"],
    // Tracing a program's own recursive functions, before recurrences.
    [/ردیابی|ردگیری|خروجی توابع|تابع بازگشتی تودرتو/, "dsa-basics-recursion"],
    [/بازگشتی|رابطهٔ بازگشتی|روابط بازگشتی|برج هانوی|رابطه بازگشتی|فیبوناچی/, "dsa-analysis-recurrences"],
    [/حلقه|تودرتو|تو در تو|تعداد اجرای|شمارش مراحل|چندجمله‌ای|هورنر/, "dsa-analysis-loops"],
    [/توان‌رسانی/, "dsa-analysis-divide"],
    [/عضو ممتاز|فرد مشهور|مرتب چرخشی/, "dsa-sorting-search"],
    [/جمع متناوب/, "dsa-off-dp"],
    [/بازگشت به عقب/, "dsa-off-backtracking"],
    [/مجانبی|رشد توابع|مرتبهٔ رشد|مرتبه رشد|نماد|تحلیل/, "dsa-analysis-growth"],
    // Basics.
    [/ناوردا|درستی/, "dsa-basics-correctness"],
    [/آرایه|ماتریس|خلوت|تنک|حافظه/, "dsa-basics-arrays"],
    [/تابع بازگشتی|توابع بازگشتی/, "dsa-basics-recursion"],
    [/شمارش|ترکیبیات|کاتالان|پرانتز|زیرمجموعه/, "dsa-basics-counting"],
    [/انتزاعی|داده‌گونه/, "dsa-basics-adt"],
    [/جستجو|جست‌وجو/, "dsa-sorting-search"],
    [/جریان|شبکه|برنامه‌ریزی صحیح|الگوریتم/, "dsa-off-other"],
  ],
  automata: [
    [/تورینگ.*تصمیم|تصمیم‌پذیر|تصمیم ناپذیر|بازگشتی شمارش|بازگشتی‌شمارش|زبان‌های بازگشتی/, "aut-computability-decidability"],
    [/توقف|PCP|پست|کاهش/, "aut-computability-halting"],
    [/پیچیدگی|NP|ردهٔ P|کلاس P/, "aut-computability-complexity"],
    [/تورینگ|محاسبه‌پذیر|مدل‌های محاسباتی|چرچ/, "aut-computability-tm"],
    [/CYK|عضویت/i, "aut-simplify-cyk"],
    [/چامسکی|گرایباخ|فرم نرمال|ساده‌سازی گرامر|تبدیل گرامر/, "aut-simplify-normal-forms"],
    [/پشته‌ای قطعی|DPDA/i, "aut-pda-deterministic"],
    [/پشته‌ای|PDA/i, "aut-pda-pda"],
    [/پمپاژ.*مستقل|مستقل.*پمپاژ/, "aut-cfl-props-pumping"],
    [/مستقل از متن.*(بستار|خواص)|(بستار|خواص).*مستقل از متن|غیرمستقل/, "aut-cfl-props-closure"],
    [/مبهم|ابهام/, "aut-cfl-ambiguity"],
    [/اشتقاق/, "aut-cfl-derivation"],
    [/مستقل از متن/, "aut-cfl-grammars"],
    [/پمپاژ|نامنظم/, "aut-regular-props-pumping"],
    [/بستار|خواص زبان/, "aut-regular-props-closure"],
    [/عبارت منظم|عبارات منظم|عبارت‌های منظم/, "aut-regular-expressions"],
    [/گرامرهای منظم|گرامر منظم|خطی راست|خطی چپ|گرامرها و زبان‌های منظم/, "aut-regular-grammars"],
    [/غیرقطعی|NFA|λ|لاندا|تبدیل.*قطعی/i, "aut-fa-nfa"],
    [/اتوماتا|اتوماتون|ماشین متناهی|DFA|حالت متناهی|کمینه‌سازی/i, "aut-fa-dfa"],
    [/زبان‌های منظم|منظم/, "aut-regular-languages"],
    [/سلسله‌مراتب|طبقه‌بندی زبان|کلاس‌های زبان|گرامر/, "aut-basics-grammars"],
    [/زبان|الفبا|نگاشت/, "aut-basics-languages"],
  ],
  "programming-fundamentals": [
    [/C\+\+|Java|شیءگرا|کلاس/i, "pf-control-oop"],
    [/حافظه پویا|مدیریت حافظه|حافظهٔ پویا/, "pf-control-memory"],
    [/اشاره‌گر|آرایه|رشته/, "pf-control-arrays"],
    [/بیتی|نمایش اعداد|نمایش داده|خطای محاسبات|ممیز شناور/, "pf-language-numbers"],
    [/عددی/, "pf-thinking-numeric"],
    [/بازگشت/, "pf-thinking-recursion"],
    [/تابع|پارامتر|دامنه|حوزه/, "pf-control-functions"],
    [/حلقه|ردگیری|ردیابی|ساختار.*کنترل|کنترل/, "pf-control-loops"],
    [/عملگر|عبارت|نوع داده|انواع داده/, "pf-language-types"],
    [/زبان|برنامه‌نویسی|مفاهیم|کامپایل|C|طراحی کامپیوتر|مبانی/i, "pf-language-concepts"],
  ],
  "discrete-math": [
    [/محمول|سور/, "dm-logic-predicate"],
    [/گزاره|منطق|استنتاج|محاسبه‌پذیر/, "dm-logic-propositional"],
    [/بازگشتی|مولد/, "dm-counting-recurrences"],
    [/گراف|درخت|رنگ‌آمیزی|اویلر|همیلتون/, "dm-graphs-graphs"],
    [/ترتیب|مشبکه|لاتیس|جبر بول|هاس/, "dm-graphs-orders"],
    [/اعداد|همنهشتی|پیمانه|بخش‌پذیری|اول/, "dm-sets-numbers"],
    [/جبری|کدگذاری|گروه/, "dm-sets-algebra"],
    [/مجموعه|رابطه|تابع/, "dm-sets-relations"],
    [/شمارش|ترکیبیات|جایگشت|ترکیب|لانه/, "dm-counting-combinatorics"],
  ],
  "computer-architecture": [
    [/نهان|cache/i, "arch-memory-cache"],
    [/جانبی|دیسک/, "arch-memory-secondary"],
    [/حافظه|گذرگاه|ورودی|خروجی|وقفه/, "arch-memory-main"],
    [/خط لوله|مخاطره/, "arch-perf-pipeline"],
    [/چندپردازنده|موازی/, "arch-perf-parallel"],
    [/کارایی|CPI|سرعت/i, "arch-perf-performance"],
    [/نمایش|حساب|ممیز|مکمل/, "arch-cpu-arith"],
    [/اسمبلی|رجیستر|ثبات|ریزعمل/, "arch-cpu-rtl"],
    [/دستورالعمل|آدرس‌دهی|دستور|طراحی کامپیوتر/, "arch-cpu-isa"],
  ],
  "linear-algebra": [
    [/کمترین مربعات|QR/i, "la-systems-least-squares"],
    [/تجزیه|LU|چولسکی/i, "la-systems-decomposition"],
    [/نرم|عدد حالت|تکراری/, "la-systems-norms"],
    [/ویژه|قطری|مشخصه/, "la-spectral-eigen"],
    [/دترمینان|معین مثبت|انواع ماتریس|ماتریس‌های ویژه/, "la-spectral-determinant"],
    [/تبدیل|متعامد/, "la-spaces-transforms"],
    [/فضا|پایه|تعامد|استقلال/, "la-spaces-spaces"],
    [/دستگاه|رتبه|ماتریس/, "la-systems-solve"],
  ],
  statistics: [
    [/حد مرکزی/, "st-inference-clt"],
    [/آزمون فرض|تحلیل واریانس/, "st-inference-tests"],
    [/برآورد|نمونه‌گیری|تخمین/, "st-inference-estimation"],
    [/نامساوی/, "st-dist-inequalities"],
    [/توأم|شرطی/, "st-dist-joint"],
    [/امید|گشتاور|ممان|کوواریانس|همبستگی|واریانس/, "st-dist-moments"],
    [/متغیر|توزیع/, "st-prob-rv"],
    [/احتمال|پیشامد|رویداد|بیز/, "st-prob-events"],
  ],
};

/**
 * The site subject of one tagged question, from its course and chapter;
 * null when its course is not known yet. A course the 1406 exam dropped
 * returns its own code with `outside1406`.
 */
export function subjectOf(course, chapter = "") {
  const base = COURSE_SUBJECT.find(([pattern]) => pattern.test(course))?.[1] ?? null;
  if (base && base !== "data-structures-algorithms" && ["automata", "programming-fundamentals"].includes(base) && ALGORITHMIC_CHAPTER.test(chapter)) {
    return "data-structures-algorithms";
  }
  if (base) return base;
  const outside = OUTSIDE_1406.find(([pattern]) => pattern.test(course));
  return outside ? outside[1] : null;
}

/** Whether a subject code is one of the courses the 1406 exam dropped. */
export const isOutside1406 = (subject) => OUTSIDE_1406.some(([, code]) => code === subject);

/** The topic code for one tagged question, or null when no rule fits. */
export function topicOf(subject, chapter, topic) {
  const text = `${chapter} | ${topic}`;
  for (const [pattern, code] of RULES[subject] ?? []) if (pattern.test(text)) return code;
  return null;
}
