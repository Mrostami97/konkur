// The "question budget" family: how many questions each subject had in each
// year's booklet of the master's exams 1277 (computer engineering, 1389-1405)
// and 1276 (IT, 1386-1405), and which questions the final key deleted,
// accepted two answers for, or scored with a positive effect. Every number
// comes from analysis/bank_stats.json (built by analysis/bank_stats.mjs from the
// owner's question bank, which was compared with the original booklets and
// keys). Counts only: no question text is published here.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/bank_stats.json", import.meta.url)), "utf8"));
/** Initial vs final keys, for the years the bank holds both (analysis/keys.mjs). */
const KEYS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/keys.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const one = (v) => fa((Math.round(v * 10) / 10).toFixed(1)).replace(/٫۰$/, "");
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });

export const TRACKS = {
  ce: { code: "1277", name: "مهندسی کامپیوتر", short: "مهندسی کامپیوتر", latin: "", years: Object.keys(STATS.ce).map(Number) },
  it: { code: "1276", name: "فناوری اطلاعات", short: "IT", latin: " (IT)", years: Object.keys(STATS.it).map(Number) },
};

/** Subjects of the 1406 exam: where each sits, from the 1406 Sanjesh announcement. */
export const SUBJECTS = {
  "زبان": { slug: "english", page: "english", code: "english", in1406: "در هر دو مجموعه، با ضریب ۱", related: "language-percentage-by-rank" },
  "ریاضیات گسسته": { slug: "discrete-math", page: "discrete-math", code: "discrete-math", in1406: "در هر دو مجموعه، در بستهٔ ریاضیات با ضریب ۲", related: "math-percentage-by-rank" },
  "آمار و احتمال مهندسی": { slug: "statistics", page: "statistics", code: "statistics", in1406: "در هر دو مجموعه، در بستهٔ ریاضیات با ضریب ۲", related: "math-percentage-by-rank" },
  "داده‌ساختارها و الگوریتم‌ها": { slug: "data-structures-algorithms", oldName: "ساختمان داده و طراحی الگوریتم", page: "data-structures-algorithms", code: "data-structures-algorithms", in1406: "در هر دو مجموعه، در بستهٔ تخصصی با ضریب ۴ و با سرفصل تازهٔ ۱۴۰۶", related: "data-structures-algorithms-percentage-by-rank", course: "/courses/data-structures-algorithms" },
  "سیستم‌های عامل": { slug: "operating-systems", page: "operating-systems", code: "operating-systems", in1406: "در هر دو مجموعه، در بستهٔ تخصصی با ضریب ۴", related: "os-network-db-percentage-by-rank", lessons: [["همگام‌سازی فرایندها", "process-synchronization"], ["بن‌بست و الگوریتم بانکدار", "deadlock-bankers-algorithm"], ["زمان‌بندی پردازنده", "cpu-scheduling"]] },
  "هوش مصنوعی": { slug: "artificial-intelligence", page: "artificial-intelligence", code: "artificial-intelligence", in1406: "در هر دو مجموعه، در بستهٔ تخصصی با ضریب ۴", related: "data-structures-algorithms-percentage-by-rank" },
  "شبکه‌های کامپیوتری": { slug: "computer-networks", page: "computer-networks", code: "computer-networks", in1406: "فقط در مجموعهٔ ۱۲۷۶ (IT)، در بستهٔ تخصصی با ضریب ۴؛ در مجموعهٔ ۱۲۷۷ دیگر نیست", related: "os-network-db-percentage-by-rank" },
  "پایگاه داده": { slug: "databases", page: "databases", code: "databases", in1406: "فقط در مجموعهٔ ۱۲۷۶ (IT)، در بستهٔ تخصصی با ضریب ۴؛ در مجموعهٔ ۱۲۷۷ دیگر نیست", related: "os-network-db-percentage-by-rank" },
  "معماری کامپیوتر": { slug: "computer-architecture", page: "computer-architecture", code: "computer-architecture", in1406: "فقط در مجموعهٔ ۱۲۷۷، در بستهٔ تخصصی با ضریب ۴؛ در IT نیست", related: "logic-architecture-percentage-by-rank" },
  "مدار منطقی": { slug: "digital-logic", page: "digital-logic", code: "digital-logic", in1406: "فقط در مجموعهٔ ۱۲۷۷، در بستهٔ تخصصی با ضریب ۴", related: "logic-architecture-percentage-by-rank" },
  "نظریه زبان‌ها و ماشین‌ها": { slug: "automata", page: "automata", code: "automata", in1406: "فقط در مجموعهٔ ۱۲۷۷ (و ۱۲۰۹)، در بستهٔ تخصصی با ضریب ۴", related: "theory-signal-percentage-by-rank", course: "/courses/theory-of-automata-and-computation", lessons: [["زبان‌های منظم، DFA و NFA", "regular-languages-dfa-nfa"], ["لم تزریق", "pumping-lemma"], ["گرامر مستقل از متن و PDA", "context-free-grammars-pda"], ["ماشین تورینگ و تصمیم‌پذیری", "turing-machines-decidability"]] },
};

/** Subjects the 1406 exam no longer has, per set. */
const DROPPED = {
  ce: ["ریاضی عمومی ۱ و ۲", "سیگنال‌ها و سیستم‌ها", "الکترونیک دیجیتال", "مدارهای الکتریکی", "شبکه‌های کامپیوتری", "پایگاه داده", "کامپایلر", "ریاضیات مهندسی", "محاسبات عددی", "انتقال داده", "زبان‌های برنامه‌سازی", "معادلات دیفرانسیل"],
  it: ["اصول و مبانی مدیریت", "مهندسی نرم‌افزار", "معماری کامپیوتر"],
};

const count = (track, year, subject) => STATS[track][year]?.subjects[subject] ?? 0;
const total = (track, year) => STATS[track][year]?.total ?? 0;
const avg = (values) => values.reduce((a, b) => a + b, 0) / values.length;
/** «الف، ب و ج». */
const andList = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join("، ")} و ${items[items.length - 1]}`);
/** Years as Persian text: a run of consecutive years as «۱۳۸۹ تا ۱۳۹۶». */
const yearList = (ys) => (ys.length > 2 && ys[ys.length - 1] - ys[0] === ys.length - 1 ? `${fa(ys[0])} تا ${fa(ys[ys.length - 1])}` : ys.map(fa).join("، "));

const SOURCES = (claim) => [
  {
    source_external_id: "editorial-source-bd8f7cb1262dd65dec24",
    relation: "SUPPORTS",
    locator: "دفترچه‌های سؤال و کلیدهای کنکور کارشناسی ارشد مجموعهٔ ۱۲۷۷ (۱۳۸۹ تا ۱۴۰۵) و ۱۲۷۶ (۱۳۸۶ تا ۱۴۰۵)",
    claim,
    order: 0,
  },
  {
    source_external_id: "editorial-source-08110ffe99548a591190",
    relation: "SUPPORTS",
    locator: "بانک سؤال کنکور کامپیوتر، ساخته‌شده از همین دفترچه‌ها و کلیدها و مقایسه‌شده با تصویر اصلی هر سؤال",
    claim: "درس هر سؤال و وضعیت حذف، چند کلیدی و تأثیر مثبت در کلید",
    order: 1,
  },
  {
    source_external_id: "editorial-source-50f3b52142efac0715d8",
    relation: "SUPPORTS",
    locator: "اطلاعیه و جدول مجموعه‌های امتحانی کارشناسی ارشد ناپیوسته سال ۱۴۰۶",
    claim: "درس‌ها و ضریب بسته‌های مجموعهٔ ۱۲۷۷ و ۱۲۷۶ در ۱۴۰۶",
    order: 2,
  },
];

const META = (slug, sourceClaim, tags, subjectCodes = []) => ({
  taxonomy: { major: ["کامپیوتر و IT"], tags: [...tags, "ضرایب و بودجه‌بندی", "تحلیل کنکور"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: subjectCodes, topic_codes: [] },
  validity: { exam_year: 1406, time_sensitive: true, source_checked_at: "2026-10-07T00:00:00.000Z", review_due_at: "2026-12-15T00:00:00.000Z" },
  sources: SOURCES(sourceClaim),
  editorial: { author_slug: "mohammad-rostami" },
  provenance: {
    producer_type: "external_ai",
    producer_name: "شمارش با Claude روی بانک سؤال کنکور کامپیوتر (دفترچه‌ها و کلیدهای سنجش)؛ فقط شمارش، بدون متن سؤال — نیازمند بازبینی و تأیید محمد رستمی",
    source_artifact: `content/import-packages/articles/${slug}.mjs`,
  },
  review_status: "draft",
});

const PRACTICE_LINKS = [
  { label: "شبیه‌ساز کنکورهای سال‌های قبل", href: "/exams" },
  { label: "بانک سؤال کنکور با کلید", href: "/questions" },
  { label: "تعداد تست و ضریب دروس ۱۴۰۶", href: "/articles/questions-and-coefficients" },
  { label: "ارزش هر تست در ۱۴۰۶", href: "/articles/value-of-a-test-1406" },
  { label: "سؤال‌های حذفی و دوکلیدی کنکور ارشد", href: "/articles/deleted-and-multi-key-questions" },
];

// --------------------------------------------------------------- per subject

export function subjectBudgetArticle(subject) {
  const meta = SUBJECTS[subject];
  const slug = `${meta.slug}-questions-per-year`;
  const allYears = [...new Set([...TRACKS.ce.years, ...TRACKS.it.years])].sort((a, b) => a - b);
  const recent = [1402, 1403, 1404, 1405];
  const ceRecent = recent.map((y) => count("ce", y, subject));
  const itRecent = recent.map((y) => count("it", y, subject));
  const ceHas = TRACKS.ce.years.some((y) => count("ce", y, subject) > 0);
  const itHas = TRACKS.it.years.some((y) => count("it", y, subject) > 0);
  const range = (values) => (Math.min(...values) === Math.max(...values) ? fa(values[0]) : `${fa(Math.min(...values))} تا ${fa(Math.max(...values))}`);

  // One row per question, its statuses together, in booklet order.
  const special = [];
  for (const track of ["ce", "it"]) {
    for (const year of TRACKS[track].years) {
      const y = STATS[track][year];
      const byQuestion = new Map();
      for (const [list, label] of [[y.deleted, "حذف‌شده"], [y.multi, "بیش از یک پاسخ درست"], [y.positive, "تأثیر مثبت"]]) {
        for (const q of list.filter((item) => item.subject === subject)) {
          const key = `${q.b}|${q.n}`;
          const row = byQuestion.get(key) ?? { q, labels: [] };
          row.labels.push(label);
          byQuestion.set(key, row);
        }
      }
      const rows = [...byQuestion.values()].sort((a, b) => String(a.q.b).localeCompare(String(b.q.b)) || a.q.n - b.q.n);
      for (const { q, labels } of rows) {
        const options = q.options?.length > 1 && !labels.includes("حذف‌شده") ? ` (گزینه‌های ${q.options.map(fa).join("، ")})` : "";
        special.push([TRACKS[track].short, fa(year), booklet(track, q.b), fa(q.n), labels.join(" و ") + options]);
      }
    }
  }

  const ceShare = ceHas ? avg(recent.map((y) => (100 * count("ce", y, subject)) / total("ce", y))) : 0;
  const itShare = itHas ? avg(recent.map((y) => (100 * count("it", y, subject)) / total("it", y))) : 0;
  const recentLine = [
    ceHas && ceRecent.some(Boolean) ? `ارشد مهندسی کامپیوتر (۱۲۷۷) در ۱۴۰۲ تا ۱۴۰۵ هر سال ${range(ceRecent)} تست ${subject} داشت (حدود ${one(ceShare)}٪ کل دفترچه)` : null,
    itHas && itRecent.some(Boolean) ? `ارشد IT (۱۲۷۶) ${range(itRecent)} تست (حدود ${one(itShare)}٪ دفترچه)` : null,
  ].filter(Boolean);
  const quick = `${recentLine.join(" و ")}. جای ${subject} در ۱۴۰۶: ${meta.in1406}؛ تعداد تست هر درس ۱۴۰۶ با دفترچهٔ ثبت‌نام اعلام می‌شود.`;

  const blocks = [];
  if (meta.oldName) blocks.push(text(`در ۱۴۰۶ نام و سرفصل این درس عوض شد و «${subject}» شد. دفترچه‌های سال‌های قبل آن را «${meta.oldName}» یا جداگانه «ساختمان داده‌ها» و «طراحی الگوریتم» نوشته‌اند؛ در جدول‌های این صفحه همهٔ آن‌ها زیر همین نام شمرده شده‌اند. برای ۱۴۰۶ طبق سرفصل تازه بخوان، نه فقط طبق فصل‌های قدیمی.`));
  blocks.push(text(`«از ${subject} چند تست می‌آید؟» را با حدس جواب نمی‌دهیم. همهٔ دفترچه‌های ارشد مهندسی کامپیوتر از ۱۳۸۹ تا ۱۴۰۵ و ارشد IT از ۱۳۸۶ تا ۱۴۰۵ را سؤال‌به‌سؤال در بانک سؤال کنکور کامپیوتر وارد کرده‌ایم و هر سؤال را با تصویر اصلی‌اش مقایسه کرده‌ایم. جدول‌های این صفحه شمارش همان دفترچه‌هاست.`));
  blocks.push(h2(`تعداد تست ${subject} در هر سال`));
  blocks.push(text(`هر عدد، تست‌های ${subject} در دفترچهٔ همان سال است، کنار تعداد کل سؤال‌های دفترچه. «—» یعنی آن سال در بانک نیست؛ «۰» یعنی دفترچه این درس را نداشت. تست‌هایی که بعداً در کلید نهایی حذف شدند هم شمرده شده‌اند.`));
  blocks.push({
    type: "table",
    headers: ["سال", "مهندسی کامپیوتر (۱۲۷۷)", "کل دفترچهٔ ۱۲۷۷", "IT (۱۲۷۶)", "کل دفترچهٔ ۱۲۷۶"],
    rows: allYears.map((y) => [
      fa(y),
      STATS.ce[y] ? fa(count("ce", y, subject)) : "—",
      STATS.ce[y] ? fa(total("ce", y)) : "—",
      STATS.it[y] ? fa(count("it", y, subject)) : "—",
      STATS.it[y] ? fa(total("it", y)) : "—",
    ]),
  });

  blocks.push(h2("روند چند سال اخیر"));
  const eras = (track) => {
    const yrs = TRACKS[track].years;
    const groups = [yrs.filter((y) => y <= 1395), yrs.filter((y) => y >= 1396 && y <= 1401), yrs.filter((y) => y >= 1402)].filter((g) => g.length);
    return groups.map((g) => `${fa(g[0])} تا ${fa(g[g.length - 1])}: میانگین ${one(avg(g.map((y) => count(track, y, subject))))} تست`).join("؛ ");
  };
  if (ceHas) blocks.push(text(`مهندسی کامپیوتر — ${eras("ce")}. دفترچه هم در این سال‌ها کوچک‌تر شد: ۱۲۱ تا ۱۵۰ سؤال پیش از ۱۴۰۰ و ۱۱۵ سؤال از ۱۴۰۲ به بعد.`));
  if (itHas) blocks.push(text(`IT — ${eras("it")}. دفترچهٔ IT از ۱۱۰ سؤال در دههٔ هشتاد به ۹۵ سؤال در ۱۴۰۲ تا ۱۴۰۵ رسید.`));
  blocks.push(text(`ساختار دفترچه در ۱۴۰۲ تا ۱۴۰۵ در هر دو مجموعه تقریباً ثابت بوده است؛ برای همین برنامه‌ریزی را بر همین چهار سال بگذار، نه بر میانگین بیست سال.`));

  blocks.push(h2(`${subject} در کنکور ۱۴۰۶`));
  blocks.push(text(`جای ${subject} در ۱۴۰۶: ${meta.in1406}. ضریب هر بسته به کل آن بسته تعلق دارد، نه به تک‌تک درس‌هایش. تعداد تست هر درس در ۱۴۰۶ هنوز اعلام نشده و با دفترچهٔ ثبت‌نام منتشر می‌شود؛ این صفحه بعد از انتشار دفترچه به‌روز می‌شود. ملاک نهایی، دفترچه و اطلاعیه‌های رسمی سازمان سنجش است.`));

  if (special.length) {
    blocks.push(h2(`تست‌های حذفی و دوکلیدی ${subject}`));
    blocks.push(text("اگر تست‌های سال‌های قبل را با کلید می‌زنی، این سؤال‌ها را جدا حساب کن. «تأثیر مثبت» یعنی در کلید نهایی پاسخ این سؤال فقط به نفع داوطلب حساب شده است."));
    blocks.push({ type: "table", headers: ["مجموعه", "سال", "دفترچه", "سؤال", "وضعیت در کلید"], rows: special });
  }

  blocks.push(h2("با این عددها چه کنیم؟"));
  blocks.push(text([
    `• تعداد تست ${subject} در چهار سال اخیر تقریباً ثابت مانده است؛ هدف درصدت را بر همین تعداد بچین، نه بر عددی که از سال‌های دور شنیده‌ای.`,
    "• یک تست درست در درسی که تستش کم است، درصد همان درس را بیشتر بالا می‌برد؛ هر تست کم‌تعداد، سنگین است.",
    "• تست‌های سال‌های قبل را با زمان واقعی بزن؛ شبیه‌ساز هر سال در سایت همان دفترچه را به ترتیب و با نمرهٔ منفی واقعی می‌دهد.",
    "• تست‌های حذفی را حساب نکن و برای دوکلیدی‌ها هر دو پاسخ را درست بدان.",
  ].join("\n")));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`از ${subject} چند تست در ارشد کامپیوتر می‌آید؟`));
  blocks.push(text(recentLine.length ? `${recentLine.join("؛ ")}. عدد ۱۴۰۶ با دفترچهٔ ثبت‌نام اعلام می‌شود.` : `${subject} در سال‌های اخیر در این دو مجموعه نبود.`));
  blocks.push(h3(`${subject} در ۱۴۰۶ ضریب چند دارد؟`));
  blocks.push(text(`${meta.in1406}.`));
  blocks.push(h3("این عددها از کجا آمده‌اند؟"));
  blocks.push(text("از خود دفترچه‌های سؤال و کلیدهای سازمان سنجش، که در بانک سؤال کنکور کامپیوتر سؤال‌به‌سؤال وارد و با تصویر اصلی مقایسه شده‌اند. درس هر سؤال از ترتیب درس‌ها در دفترچه و بازبینی متن سؤال تعیین شده است."));

  blocks.push(h2("قدم بعدی"));
  const links = [
    { label: `صفحهٔ درس ${subject}`, href: `/subjects/${meta.page}` },
    { label: `تست‌های ${subject} در بانک سؤال`, href: `/questions?subject=${meta.code}` },
    ...(meta.course ? [{ label: `دورهٔ ${subject}`, href: meta.course }] : []),
    ...(meta.lessons ?? []).map(([label, s]) => ({ label, href: `/articles/${s}` })),
    { label: "درصد این درس در رتبه‌های مختلف", href: `/articles/${meta.related}` },
    ...PRACTICE_LINKS,
  ];
  blocks.push({ type: "link_group", items: links });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `${subject} در کنکور ارشد کامپیوتر و IT چند تست دارد؟ تعداد تست هر سال از ۱۳۸۶ تا ۱۴۰۵`,
    slug,
    summary: `تعداد تست ${subject} در همهٔ دفترچه‌های ارشد مهندسی کامپیوتر (۱۳۸۹ تا ۱۴۰۵) و IT (۱۳۸۶ تا ۱۴۰۵)، تست‌های حذفی و دوکلیدی، و جای این درس در کنکور ۱۴۰۶.`,
    quick_answer: quick,
    content_blocks: blocks,
    seo: {
      title: `تعداد تست ${subject} ارشد کامپیوتر و IT در هر سال`,
      description: `${subject} در کنکور ارشد کامپیوتر و IT چند تست دارد؟ شمارش دفترچه‌های ۱۳۸۶ تا ۱۴۰۵، تست‌های حذفی و دوکلیدی و جای درس در ۱۴۰۶.`,
    },
    ...META(slug, `تعداد تست ${subject} در هر دفترچه`, [subject, "بودجه‌بندی"], [meta.code]),
  };
}

// ----------------------------------------------------------------- per set

function booklet(track, b) {
  if (b === null || b === undefined) return "—";
  return track === "it" ? String(b) : `دفترچهٔ ${fa(b)}`;
}

export function trackBudgetArticle(track) {
  const t = TRACKS[track];
  const slug = track === "ce" ? "master-computer-engineering-question-budget" : "master-it-question-budget";
  const years = t.years;
  const split = track === "ce" ? 1399 : 1395;
  const older = years.filter((y) => y <= split);
  const newer = years.filter((y) => y > split);
  const subjectsIn = (ys) => {
    const seen = new Map();
    for (const y of ys) for (const [s, n] of Object.entries(STATS[track][y].subjects)) seen.set(s, (seen.get(s) ?? 0) + n);
    return [...seen].sort((a, b) => b[1] - a[1]).map(([s]) => s).filter((s) => s !== "نامشخص");
  };
  const table = (ys) => ({
    type: "table",
    headers: ["درس", ...ys.map(fa), "در ۱۴۰۶"],
    rows: [
      ...subjectsIn(ys).map((s) => [s, ...ys.map((y) => fa(count(track, y, s))), SUBJECTS[s] && !DROPPED[track].includes(s) ? "هست" : "نیست"]),
      ["کل دفترچه", ...ys.map((y) => fa(total(track, y))), ""],
    ],
  });
  const last = years[years.length - 1];
  const twoBooklets = years.filter((y) => (STATS[track][y].booklets ?? []).length > 1);
  const lastSubjects = Object.entries(STATS[track][last].subjects).sort((a, b) => b[1] - a[1]);
  const kept = lastSubjects.filter(([s]) => SUBJECTS[s] && !DROPPED[track].includes(s));
  const dropped = lastSubjects.filter(([s]) => !(SUBJECTS[s] && !DROPPED[track].includes(s)));
  const droppedCount = dropped.reduce((a, [, n]) => a + n, 0);

  const blocks = [];
  blocks.push(text(`بودجه‌بندی یعنی هر درس چند تست از دفترچه را می‌گیرد. این صفحه بودجه‌بندی واقعی کنکور ارشد ${t.name} (مجموعهٔ ${fa(t.code)}) را برای همهٔ سال‌های ${fa(years[0])} تا ${fa(last)} نشان می‌دهد؛ از شمارش سؤال‌به‌سؤال دفترچه‌های سنجش در بانک سؤال کنکور کامپیوتر، نه از تخمین.`));
  blocks.push(h2(`بودجه‌بندی ${fa(newer[0])} تا ${fa(last)}`));
  blocks.push(text("ستون آخر می‌گوید آن درس در کنکور ۱۴۰۶ همین مجموعه هست یا نه. تست‌هایی که در کلید نهایی حذف شدند هم شمرده شده‌اند."));
  blocks.push(table(newer));
  blocks.push(h2(`بودجه‌بندی ${fa(older[0])} تا ${fa(older[older.length - 1])}`));
  blocks.push(text(track === "ce"
    ? `تا ۱۳۹۹ دفترچهٔ ۱۲۷۷ درس‌های بیشتری داشت (مدار الکتریکی، کامپایلر، انتقال داده، محاسبات عددی و…) و ${fa(Math.min(...older.map((y) => total(track, y))))} تا ${fa(Math.max(...older.map((y) => total(track, y))))} سؤال. سال‌های ${yearList(twoBooklets)} دو دفترچه داشتند و ۱۳۸۹ در دو نوبت برگزار شد؛ عددها مجموع هر دو دفترچهٔ همان سال است.`
    : "دفترچهٔ IT در دههٔ هشتاد ۱۱۰ سؤال داشت و در ۱۳۹۰ و ۱۳۹۱ نود سؤال. «اصول و مبانی مدیریت» از ۱۳۹۲ سهم بیشتری گرفت."));
  blocks.push(table(older));

  blocks.push(h2("در ۱۴۰۶ چه چیزی عوض می‌شود؟"));
  blocks.push(text(track === "ce"
    ? `در ۱۴۰۶ مجموعهٔ ۱۲۷۷ سه بسته دارد: زبان (ضریب ۱)، ریاضیات شامل گسسته، آمار و احتمال و جبر خطی (ضریب ۲) و بستهٔ تخصصی شامل مبانی کامپیوتر و برنامه‌سازی، مدار منطقی، معماری، داده‌ساختارها و الگوریتم‌ها، نظریه زبان‌ها، سیستم عامل و هوش مصنوعی (ضریب ۴). در ${fa(last)}، ${fa(droppedCount)} تست از ${fa(total(track, last))} تست دفترچه مال درس‌هایی بود که در ۱۴۰۶ در این مجموعه نیستند: ${dropped.map(([s, n]) => `${s} (${fa(n)})`).join("، ")}. جبر خطی و مبانی برنامه‌سازی در ۱۴۰۶ تازه اضافه شده‌اند.`
    : `در ۱۴۰۶ مجموعهٔ ۱۲۷۶ سه بسته دارد: زبان (ضریب ۱)، ریاضیات شامل گسسته و آمار و احتمال (ضریب ۲) و بستهٔ تخصصی شامل مبانی کامپیوتر و برنامه‌سازی، داده‌ساختارها و الگوریتم‌ها، سیستم عامل، شبکه، پایگاه داده و هوش مصنوعی (ضریب ۴). در ${fa(last)}، ${fa(droppedCount)} تست از ${fa(total(track, last))} تست دفترچه مال درس‌هایی بود که در ۱۴۰۶ نیستند: ${dropped.map(([s, n]) => `${s} (${fa(n)})`).join("، ")}. آمار و احتمال و مبانی برنامه‌سازی در ۱۴۰۶ تازه اضافه شده‌اند.`));
  blocks.push(text(`پس بودجه‌بندی ۱۴۰۶ با سال‌های قبل یکی نخواهد بود: تست‌های درس‌های حذف‌شده باید جایی برود. تعداد تست هر درس ۱۴۰۶ با دفترچهٔ ثبت‌نام اعلام می‌شود و این صفحه بعد از آن به‌روز می‌شود. درس‌هایی که در ۱۴۰۶ مانده‌اند و در ${fa(last)} بیشترین تست را داشتند: ${kept.slice(0, 4).map(([s, n]) => `${s} (${fa(n)} تست)`).join("، ")}. ولی تعداد تست به‌تنهایی ارزش یک درس را نمی‌گوید: ضریب بستهٔ تخصصی ۴، ریاضیات ۲ و زبان ۱ است؛ ارزش هر تست را در مقالهٔ «ارزش هر تست در ۱۴۰۶» ببین. ملاک نهایی، اطلاعیه‌های رسمی سازمان سنجش است.`));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`کنکور ارشد ${t.short} چند سؤال دارد؟`));
  blocks.push(text(`در ${fa(last)} دفترچه ${fa(total(track, last))} سؤال داشت. در سال‌های قبل از ${fa(Math.min(...years.map((y) => total(track, y))))} تا ${fa(Math.max(...years.map((y) => total(track, y))))} سؤال بوده است. تعداد سؤال ۱۴۰۶ با دفترچهٔ ثبت‌نام اعلام می‌شود.`));
  blocks.push(h3(`پرتست‌ترین درس ارشد ${t.short} کدام است؟`));
  blocks.push(text(`زبان با ${fa(count(track, last, "زبان"))} تست در ${fa(last)}. بعد از آن ${kept.filter(([s]) => s !== "زبان").slice(0, 2).map(([s, n]) => `${s} با ${fa(n)} تست`).join(" و ")}.`));
  blocks.push(h3("بودجه‌بندی هر درس را جدا کجا ببینم؟"));
  blocks.push(text("برای هر درس ۱۴۰۶ صفحهٔ جدا داریم که تعداد تست آن را در همهٔ سال‌های هر دو مجموعه، با تست‌های حذفی و دوکلیدی‌اش، نشان می‌دهد."));

  blocks.push(h2("بودجه‌بندی هر درس"));
  const subjectLinks = Object.entries(SUBJECTS)
    .filter(([s]) => STATS[track][last].subjects[s] || s === "آمار و احتمال مهندسی")
    .map(([s, m]) => ({ label: `${s}: تعداد تست هر سال`, href: `/articles/${m.slug}-questions-per-year` }));
  blocks.push({ type: "link_group", items: [...subjectLinks, { label: track === "ce" ? "بودجه‌بندی ارشد IT" : "بودجه‌بندی ارشد مهندسی کامپیوتر", href: `/articles/${track === "ce" ? "master-it-question-budget" : "master-computer-engineering-question-budget"}` }, ...PRACTICE_LINKS] });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `بودجه‌بندی کنکور ارشد ${t.name}${t.latin}: تعداد تست هر درس از ${fa(years[0])} تا ${fa(last)}`,
    slug,
    summary: `هر درس در کنکور ارشد ${t.name} (مجموعهٔ ${fa(t.code)}) هر سال چند تست داشت؟ شمارش همهٔ دفترچه‌های ${fa(years[0])} تا ${fa(last)} و درس‌هایی که در ۱۴۰۶ می‌مانند یا حذف می‌شوند.`,
    quick_answer: `در ${fa(last)} دفترچهٔ ارشد ${t.name} ${fa(total(track, last))} سؤال داشت؛ ${lastSubjects.map(([s, n]) => `${s}: ${fa(n)}`).join("، ")}. در ۱۴۰۶ ${dropped.length ? `${andList(dropped.map(([s]) => s))} در این مجموعه نیستند` : "همهٔ این درس‌ها می‌مانند"} و تعداد تست هر درس با دفترچهٔ ثبت‌نام اعلام می‌شود.`,
    content_blocks: blocks,
    seo: {
      title: `بودجه‌بندی کنکور ارشد ${t.short}؛ تعداد تست هر درس ${fa(years[0])} تا ${fa(last)}`,
      description: `بودجه‌بندی واقعی کنکور ارشد ${t.name}: تعداد تست هر درس در همهٔ دفترچه‌های ${fa(years[0])} تا ${fa(last)} و تغییرات ۱۴۰۶.`,
    },
    ...META(slug, `تعداد تست هر درس در دفترچه‌های مجموعهٔ ${fa(t.code)}`, ["بودجه‌بندی", track === "ce" ? "مهندسی کامپیوتر" : "فناوری اطلاعات"]),
  };
}

// ------------------------------------------------------- deleted and multi-key

export function specialQuestionsArticle() {
  const slug = "deleted-and-multi-key-questions";
  const rows = (track, kind) => {
    const out = [];
    for (const year of TRACKS[track].years) {
      for (const q of STATS[track][year][kind]) {
        const options = q.options?.length > 1 ? q.options.map(fa).join("، ") : q.options?.length === 1 && kind === "multi" ? `${fa(q.options[0])} (گزینهٔ دیگر در داده ثبت نشده)` : q.options?.length === 1 ? fa(q.options[0]) : "";
        out.push([fa(year), booklet(track, q.b), fa(q.n), q.subject, ...(kind === "deleted" ? [] : [options])]);
      }
    }
    return out;
  };
  const n = (track, kind) => TRACKS[track].years.reduce((a, y) => a + STATS[track][y][kind].length, 0);

  const blocks = [];
  blocks.push(text("اگر تست‌های کنکورهای قبل را با کلید می‌زنی، باید بدانی کدام سؤال در کلید نهایی حذف شد، کدام بیش از یک پاسخ درست داشت و کدام «تأثیر مثبت» گرفت؛ وگرنه درصدی که برای خودت حساب می‌کنی با درصد واقعی آن سال فرق می‌کند. این فهرست از همهٔ دفترچه‌ها و کلیدهای ارشد مهندسی کامپیوتر (۱۳۸۹ تا ۱۴۰۵) و IT (۱۳۸۶ تا ۱۴۰۵) در بانک سؤال کنکور کامپیوتر بیرون آمده است."));
  blocks.push(h2("این سه وضعیت یعنی چه؟"));
  blocks.push(text([
    "• حذف‌شده: سنجش آن سؤال را در کلید نهایی حذف کرده و در درصد کسی حساب نشده است.",
    "• بیش از یک پاسخ درست: کلید نهایی دو یا چند گزینه را درست اعلام کرده؛ هر کدام را زده باشی، درست است.",
    "• تأثیر مثبت: پاسخ این سؤال فقط به نفع داوطلب حساب شده است.",
  ].join("\n")));
  blocks.push(text(`در مجموع ${fa(n("ce", "deleted"))} سؤال حذف‌شده، ${fa(n("ce", "multi"))} سؤال چندکلیدی و ${fa(n("ce", "positive"))} سؤال با تأثیر مثبت در ارشد مهندسی کامپیوتر، و ${fa(n("it", "deleted"))}، ${fa(n("it", "multi"))} و ${fa(n("it", "positive"))} مورد در ارشد IT پیدا کردیم. «دفترچه» در مهندسی کامپیوتر شمارهٔ دفترچه در همان سال است و در IT کد دفترچه، چون شمارهٔ سؤال‌ها به دفترچه بستگی دارد.`));

  for (const track of ["ce", "it"]) {
    const t = TRACKS[track];
    blocks.push(h2(`ارشد ${t.name} (مجموعهٔ ${fa(t.code)})`));
    blocks.push(h3("سؤال‌های حذف‌شده"));
    blocks.push({ type: "table", headers: ["سال", "دفترچه", "سؤال", "درس"], rows: rows(track, "deleted") });
    blocks.push(h3("سؤال‌های با بیش از یک پاسخ درست"));
    blocks.push({ type: "table", headers: ["سال", "دفترچه", "سؤال", "درس", "گزینه‌های درست"], rows: rows(track, "multi") });
    blocks.push(h3("سؤال‌های با تأثیر مثبت"));
    blocks.push({ type: "table", headers: ["سال", "دفترچه", "سؤال", "درس", "گزینهٔ کلید"], rows: rows(track, "positive") });
  }

  blocks.push(h2("کلیدهای اولیه"));
  const initial = (track) => TRACKS[track].years.filter((y) => STATS[track][y].initialKey > 0).map((y) => `${fa(y)}${STATS[track][y].initialKey < STATS[track][y].total ? ` (${fa(STATS[track][y].initialKey)} سؤال)` : ""}`);
  blocks.push(text(`برای ارشد IT سال‌های ${initial("it").join("، ")} و ارشد مهندسی کامپیوتر سال‌های ${initial("ce").join("، ")}، کلیدی که در دست داریم کلید اولیه است، نه نهایی. پس فهرست این سال‌ها ممکن است با کلید نهایی تغییر کند؛ با پیدا شدن کلید نهایی این صفحه به‌روز می‌شود.`));
  // From the initial key to the final key: the years the bank holds both.
  const changes = KEYS.changes.filter((c) => c.track === "ce");
  const kindOf = (c) => (c.deleted ? "حذف شد" : c.final.length > 1 ? "گزینهٔ دیگری هم درست اعلام شد" : c.final[0] !== c.initial ? "پاسخ عوض شد" : "همان پاسخ، با تأثیر مثبت");
  const byKind = (k) => changes.filter((c) => kindOf(c) === k).length;
  const years = [...new Set(changes.map((c) => c.year))];
  const perYear = years.map((y) => `${fa(changes.filter((c) => c.year === y).length)} سؤال از ${fa(total("ce", y))} سؤال در ${fa(y)}`);
  blocks.push(h2("از کلید اولیه تا کلید نهایی چه چیزی عوض می‌شود؟"));
  blocks.push(text(`برای ارشد مهندسی کامپیوتر ${years.map(fa).join(" و ")} هر دو کلید را داریم و می‌شود دید اعتراض‌ها و بازبینی سنجش چه چیزی را عوض کرد: ${perYear.join(" و ")} بین دو کلید تغییر کرد. فقط در ${fa(byKind("پاسخ عوض شد"))} سؤال پاسخ درست کاملاً عوض شد؛ ${fa(byKind("حذف شد"))} سؤال حذف شد، در ${fa(byKind("گزینهٔ دیگری هم درست اعلام شد"))} سؤال گزینهٔ دیگری هم درست اعلام شد و ${fa(byKind("همان پاسخ، با تأثیر مثبت"))} سؤال با همان پاسخ «تأثیر مثبت» گرفت.`));
  blocks.push({
    type: "table",
    headers: ["سال", "سؤال", "درس", "کلید اولیه", "کلید نهایی", "چه شد"],
    rows: changes.map((c) => [fa(c.year), fa(c.n), c.subject, fa(c.initial), c.deleted ? "حذف" : c.final.map(fa).join(" و "), kindOf(c) + (c.positive && kindOf(c) !== "همان پاسخ، با تأثیر مثبت" ? " (با تأثیر مثبت)" : "")]),
  });
  blocks.push(text("یعنی اگر بعد از آزمون با کلید اولیه درصدت را حساب کنی، در این دو سال فقط چند سؤال جابه‌جا شد؛ ولی همین چند سؤال در رتبه‌های نزدیک به هم اثر دارد. اگر مطمئنی کلید اولیهٔ سؤالی غلط است، در مهلت اعتراض با دلیل روشن اعتراض بده."));
  blocks.push(h2("در شبیه‌سازهای سایت"));
  blocks.push(text("در شبیه‌ساز کنکور هر سال در کنکور کامپیوتر، سؤال‌های حذف‌شده نیستند و برای سؤال‌های چندکلیدی هر پاسخ درست اعلام‌شده، درست حساب می‌شود؛ پس درصد شبیه‌ساز با همان قاعدهٔ کلید نهایی حساب می‌شود."));
  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3("اگر سؤالی حذف شده باشد، درصد چطور حساب می‌شود؟"));
  blocks.push(text("سؤال حذف‌شده از تعداد تست آن درس کم می‌شود و درصد بر تعداد باقی‌مانده حساب می‌شود؛ برای همین تعداد تست حساب‌شدهٔ یک درس گاهی یکی کمتر از دفترچه است."));
  blocks.push(h3("اعتراض به کلید اولیه فایده دارد؟"));
  blocks.push(text(`گاهی بله. در ارشد مهندسی کامپیوتر ${years.map(fa).join(" و ")}، ${fa(changes.length)} سؤال بین کلید اولیه و نهایی تغییر کرد که در ${fa(byKind("پاسخ عوض شد"))} مورد پاسخ درست کاملاً عوض شد. اعتراضی که دلیل و منبع روشن داشته باشد بررسی می‌شود.`));
  blocks.push(h3("کلید نهایی کنکورهای قبل را کجا ببینم؟"));
  blocks.push(text("کلیدها روی درگاه سازمان سنجش منتشر می‌شوند. در بانک سؤال کنکور کامپیوتر کلید هر سؤال کنار خودش است و این وضعیت‌ها روی همان سؤال هم نوشته می‌شود."));
  blocks.push({ type: "link_group", items: PRACTICE_LINKS.filter((l) => l.href !== `/articles/${slug}`).concat([{ label: "کلید کنکور ارشد کامپیوتر و IT ۱۴۰۰ تا ۱۴۰۵", href: "/articles/master-computer-answer-keys" }, { label: "بودجه‌بندی ارشد مهندسی کامپیوتر", href: "/articles/master-computer-engineering-question-budget" }, { label: "بودجه‌بندی ارشد IT", href: "/articles/master-it-question-budget" }]) });

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: "سؤال‌های حذفی، دوکلیدی و با تأثیر مثبت کنکور ارشد کامپیوتر و IT؛ همهٔ سال‌ها",
    slug,
    summary: "فهرست کامل سؤال‌هایی که در کلید نهایی ارشد مهندسی کامپیوتر (۱۳۸۹ تا ۱۴۰۵) و IT (۱۳۸۶ تا ۱۴۰۵) حذف شدند، بیش از یک پاسخ درست داشتند یا تأثیر مثبت گرفتند.",
    quick_answer: `در ارشد مهندسی کامپیوتر ۱۳۸۹ تا ۱۴۰۵، ${fa(n("ce", "deleted"))} سؤال در کلید نهایی حذف شد، ${fa(n("ce", "multi"))} سؤال بیش از یک پاسخ درست داشت و ${fa(n("ce", "positive"))} سؤال تأثیر مثبت گرفت؛ در ارشد IT ۱۳۸۶ تا ۱۴۰۵ این عددها ${fa(n("it", "deleted"))}، ${fa(n("it", "multi"))} و ${fa(n("it", "positive"))} است. فهرست هر سال با شمارهٔ دفترچه و سؤال در این صفحه آمده است.`,
    content_blocks: blocks,
    seo: {
      title: "سؤال‌های حذفی و دوکلیدی کنکور ارشد کامپیوتر و IT",
      description: "کدام سؤال‌های ارشد مهندسی کامپیوتر و IT در کلید نهایی حذف شد، دوکلیدی شد یا تأثیر مثبت گرفت؟ فهرست کامل ۱۳۸۶ تا ۱۴۰۵.",
    },
    ...META(slug, "وضعیت حذف، چندکلیدی و تأثیر مثبت سؤال‌ها در کلیدهای سنجش", ["کلید نهایی", "تحلیل آزمون"]),
  };
}
