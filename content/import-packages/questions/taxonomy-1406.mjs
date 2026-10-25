import { readFileSync } from "node:fs";

// The 1406 syllabus as the bank's topic tree, and the rules that place each of
// the owner's tagged questions on it.
//
// The owner tags questions with free text (course, chapter, a one-line topic),
// so one subject arrives under several names and almost every topic is unique
// to its question. The site needs a fixed tree so a candidate can build an exam
// from one topic and see how often it came: subject → chapter → topic, taken
// from the official 1406 syllabus (apps/web/src/content/editorial.ts). Algorithm
// design (dynamic programming, greedy, MST, NP, ...) is outside the unified
// 1276/1277 list but inside the computer-science (1209) «طراحی الگوریتم‌ها»
// list, so it is its own chapter of the bank, not "outside 1406" (owner,
// 2026-10-20). Its codes keep the old dsa-off- prefix so stored tags hold. The
// owner's own wording stays on the question as its fine-grained label.
//
// A rule matches the owner's chapter and topic text; the first rule that fits
// wins, so specific rules come before general ones.

/** The tree (subject → chapters → topics), kept where the site reads it too, so a
 * title shown on a question is always the one the import used. */
export const TREE = JSON.parse(readFileSync(new URL("../../../apps/web/src/content/syllabus-tree.json", import.meta.url), "utf8"));

/**
 * A question's site subject: algorithmic chapters inside other booklets'
 * courses (computer science prints analysis and recurrences under «مبانی
 * نظریهٔ محاسبه» and «مبانی کامپیوتر») go to data structures and algorithms,
 * where a candidate building a topic exam looks for them.
 */
const ALGORITHMIC_CHAPTER = /تحلیل پیچیدگی|تحلیل الگوریتم|روابط بازگشتی|مرتب‌سازی|درخت‌ها|درخت‌های جست|پشته و صف|لیست پیوندی|لیست‌های پیوندی|مجموعه‌های مجزا|الگوریتم‌های گراف|جریان در شبکه|ساختمان داده|جست‌وجو$|^جستجو$|تقسیم و حل|الگوریتم‌های حریصانه|انتخاب|مدل‌سازی برنامه‌ریزی/;

/**
 * A tagged topic that is plainly about languages and machines stays with the
 * theory of computation even when its chapter reads as analysis: the tag file
 * files some DPDA and closure questions under «تحلیل پیچیدگی و روابط بازگشتی».
 */
const THEORY_TOPIC = /بازگشتی شمارا|بازگشتی‌شمارا|شمارش‌پذیر|محاسبه‌پذیر|قطری‌سازی|چامسکی|زبان|گرامر|ماشین|اتومات|تورینگ|تصمیم‌پذیر|عبارت منظم|عبارات منظم|منظم|مستقل از متن|لم تزریق|لم پمپاژ|DFA|NFA|PDA|DPDA/;

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
    // «کاهش» alone also means a recurrence step («کاهش یک واحد»); only a reduction between problems is NP.
    [/NP|پیچیدگی محاسباتی|کلاس‌های پیچیدگی|کاهش چندجمله‌ای|کاهش‌پذیر|کاهش مسئله|ارضاپذیری|تقریبی|بلندترین مسیر/, "dsa-off-np"],
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
    // «هش» only as a word: «کاهش» (a recurrence shrinking its input) is not hashing.
    [/درهم‌سازی|درهم سازی|(?<![؀-ۿ])هش|وارسی/, "dsa-sorting-hashing"],
    [/کران پایین|درخت تصمیم/, "dsa-sorting-lower-bound"],
    [/شمارشی|مبنایی|سطلی|radix|counting sort/i, "dsa-sorting-linear"],
    [/k-ام|kام|k ام|انتخاب|آمار ترتیبی|مرتبهٔ آماری|میانه|کمینه و بیشینه|کمینه.*بیشینه|ماکزیمم و مینیمم|دومین/, "dsa-sorting-selection"],
    [/مرتب‌سازی|مرتب سازی|Partition|افراز|مرتب‌شده/, "dsa-sorting-comparison"],
    [/جستجو در ماتریس|جست‌وجو در ماتریس|آرایهٔ چرخشی|آرایه چرخشی|جستجوی سه‌تایی|عنصر پرتکرار|عدد گمشده|عضو غایب|جست‌وجوی زوج/, "dsa-sorting-search"],
    // Basic structures.
    [/میانوندی|پسوندی|پیشوندی|درخت عبارت|نگارش/, "dsa-structures-expression"],
    [/ترای|trie/i, "dsa-structures-trie"],
    [/هرم|هیپ|heap|deap|صف اولویت/i, "dsa-structures-heap"],
    // A binary search tree before binary search: «درخت جست‌وجوی دودویی» contains «جست‌وجوی دودویی».
    [/درخت جستجو|درخت جست‌وجو|درخت‌های جستجو|درخت‌های جست‌وجو|BST/i, "dsa-structures-bst"],
    [/جستجوی دودویی|جست‌وجوی دودویی|جستجو دودویی/, "dsa-analysis-divide"],
    // «صف» only as a word: «نصف» (halving) is not a queue.
    [/پشته|(?<![؀-ۿ])صف/, "dsa-structures-stack-queue"],
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
    [/بازگشتی شمارا|بازگشتی‌شمارا/, "aut-computability-decidability"],
    [/سلسله‌مراتب چامسکی/, "aut-basics-grammars"],
    [/مستقل از متن قطعی|پشته‌ای قطعی|DPDA/, "aut-pda-deterministic"],
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
  english: [
    [/کلوز|متن/, "en-reading-cloze"],
    [/مجهول|زمان/, "en-grammar-tenses"],
    [/ربط|ضمیر|جمله‌واره/, "en-grammar-clauses"],
    [/بافت|هم‌آیی|حروف اضافه|صفت|اسم/, "en-vocab-context"],
    [/تخصصی|کامپیوتر/, "en-vocab-technical"],
    [/واژ/, "en-vocab-general"],
  ],
  "digital-logic": [
    [/ماشین حالت|میلی|مور|نمودار حالت/, "dl-seq-fsm"],
    [/شمارنده|ثبات/, "dl-seq-counters"],
    [/فلیپ|لچ/, "dl-seq-flipflops"],
    [/مالتی‌پلکسر|دیکودر|انکودر/, "dl-comb-mux"],
    [/جمع‌کننده|تفریق/, "dl-comb-adders"],
    [/کارنو/, "dl-boolean-kmap"],
    [/گیت|بول/, "dl-boolean-gates"],
    [/عدد|کد/, "dl-boolean-numbers"],
    // Fallbacks by chapter, for tags the rules above do not name.
    [/آشکارساز|Moore|Mealy|مدارهای ترتیبی/, "dl-seq-fsm"],
    [/پوشاننده|ساده‌سازی توابع/, "dl-boolean-kmap"],
    [/مدارهای ترکیبی|مدار ترکیبی/, "dl-comb-arith"],
  ],
  "operating-systems": [
    [/حافظه مجازی|حافظهٔ مجازی|خطای صفحه|جایگزینی/, "os-memory-virtual"],
    [/صفحه‌بندی|بخش‌بندی/, "os-memory-paging"],
    [/فایل|پرونده|دیسک|رکورد|میان‌گیری|ورودی|بلوک/, "os-memory-files"],
    [/بن‌بست/, "os-sync-deadlock"],
    [/سمافور|بحرانی/, "os-sync-critical"],
    [/زمان‌بندی/, "os-process-scheduling"],
    [/فرایند|نخ/, "os-process-processes"],
    // Fallback by chapter.
    [/fork|مدیریت فرآیندها|مدیریت فرایندها/, "os-process-processes"],
  ],
  "computer-networks": [
    [/DNS|HTTP|کاربرد/i, "net-app-application"],
    [/TCP|UDP|انتقال/i, "net-app-transport"],
    [/مسیریابی|RIP|بردار فاصله/i, "net-network-routing"],
    [/IP|آدرس/i, "net-network-ip"],
    [/فیزیکی|QAM|مدولاسیون/i, "net-arch-physical"],
    [/رمز|امنیت/, "net-security-crypto"],
  ],
  databases: [
    [/موجودیت|EER|(?<![A-Za-z])ER(?![A-Za-z])/i, "db-model-er"],
    [/جبر رابطه‌ای|حساب رابطه‌ای|تقسیم|پیوند طبیعی|تفاضل|اشتراک/, "db-model-algebra"],
    [/SQL|SELECT|GROUP|ASSERTION|Trigger|رهانا|(?<![؀-ۿ])دید(?![؀-ۿ])|View/i, "db-sql-queries"],
    [/وابستگی|نرمال|کلید|بستار/, "db-sql-normalization"],
    [/تراکنش|همروندی/, "db-tx-concurrency"],
    [/ترمیم|بازیابی|ثبت وقایع|log/i, "db-tx-recovery"],
    [/شاخص|ایندکس|درخت B|index/i, "db-sql-indexing"],
    [/مدل رابطه‌ای|ویژگی‌های رابطه|جامعیت/, "db-model-relational"],
  ],
  "artificial-intelligence": [
    [/بیز|احتمال/, "ai-prob-bayes"],
    [/منطق|Prolog/i, "ai-logic-logic"],
    [/minimax|بازی/i, "ai-search-games"],
    [/جست‌وجو|جستجو/, "ai-search-search"],
    [/ارضای محدودیت|محدودیت|ارضای قید|سازگاری/, "ai-logic-csp"],
    [/بازنمایی دانش|مسئلهٔ قاب/, "ai-logic-logic"],
    [/یادگیری|عصبی/, "ai-prob-learning"],
    // Planning has no topic of its own in the 1406 list; it sits with agents and state spaces.
    [/برنامه‌ریزی|عامل/, "ai-search-agents"],
  ],
};

/**
 * The site subject of one tagged question, from its course and chapter;
 * null when its course is not known yet. A course the 1406 exam dropped
 * returns its own code with `outside1406`.
 */
export function subjectOf(course, chapter = "", topic = "") {
  const base = COURSE_SUBJECT.find(([pattern]) => pattern.test(course))?.[1] ?? null;
  if (base && base !== "data-structures-algorithms" && ["automata", "programming-fundamentals"].includes(base) && ALGORITHMIC_CHAPTER.test(chapter) && !(base === "automata" && THEORY_TOPIC.test(topic))) {
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
  // A theory question filed under an analysis chapter is placed by its topic alone.
  const misfiled = subject === "automata" && ALGORITHMIC_CHAPTER.test(chapter) && THEORY_TOPIC.test(topic);
  const text = misfiled ? topic : `${chapter} | ${topic}`;
  for (const [pattern, code] of RULES[subject] ?? []) if (pattern.test(text)) return code;
  return null;
}
