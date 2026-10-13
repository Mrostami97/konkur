// The answer keys of the master's exams 1277 (computer engineering) and 1276
// (IT), 1400-1405, from the owner's bank (analysis/keys.json): each key read
// from the booklet's own key page and checked against the question. The stage
// of each year's key (final, initial, or not recorded) is printed with it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEYS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/keys.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const slug = "master-computer-answer-keys";
const YEARS = [1405, 1404, 1403, 1402, 1401, 1400];
const TRACK = { ce: { name: "مهندسی کامپیوتر", code: "۱۲۷۷" }, it: { name: "فناوری اطلاعات (IT)", code: "۱۲۷۶" } };

/** What the reader should know about one year's key. */
function status(y) {
  const deleted = y.questions.filter((q) => q.deleted).length;
  const initial = y.stages.initial ?? 0;
  if (y.stages.final === y.total) return "کلید نهایی سنجش.";
  if (initial === y.total) return "کلید اولیهٔ سنجش؛ کلید نهایی هنوز در بانک ما نیست و ممکن است چند پاسخ را تغییر دهد.";
  if (y.stages.final) return `کلید نهایی سنجش؛ برای ${fa(initial)} سؤالی که ردیفشان در فایل کلید نهایی نبود، پاسخ کلید اولیه آمده و با † مشخص شده است.`;
  const base = "منبع ما ننوشته کلید اولیه است یا نهایی";
  if (deleted) return `${base}؛ ولی چون ${fa(deleted)} سؤال حذف‌شده دارد و حذف سؤال فقط در کلید نهایی اعلام می‌شود، به احتمال زیاد کلید نهایی است.${initial ? ` پاسخ ${fa(initial)} سؤال از کلید اولیه است و با † مشخص شده.` : ""}`;
  return `${base}؛ با پیدا شدن کلید نهایی این بخش به‌روز می‌شود.`;
}

function keyTable(track, year) {
  const y = KEYS[track][year];
  const mixed = Boolean(y.stages.initial) && y.stages.initial < y.total;
  const rows = [];
  for (let i = 0; i < y.questions.length; i += 5) {
    const row = [];
    for (const q of y.questions.slice(i, i + 5)) row.push(fa(q.n), (q.deleted ? "حذف" : q.accepted.map(fa).join(" و ")) + (q.positive ? "*" : "") + (mixed && q.stage === "initial" ? "†" : ""));
    while (row.length < 10) row.push("", "");
    rows.push(row);
  }
  return { type: "table", headers: ["سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ"], rows };
}

/** «زبان: ۱ تا ۲۵؛ ریاضیات: ۲۶ تا ۴۵؛ …» from the booklet's own section names. */
function sections(track, year) {
  const ranges = [];
  for (const q of KEYS[track][year].questions) {
    const last = ranges.at(-1);
    if (last && last.name === q.subject) last.to = q.n;
    else ranges.push({ name: q.subject ?? "بدون عنوان", from: q.n, to: q.n });
  }
  return ranges.map((r) => `${r.name.replace(/\s*\(.*?\)\s*$/, "")}: ${fa(r.from)} تا ${fa(r.to)}`).join("؛ ");
}

const blocks = [];
blocks.push(text("کلید کنکور ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) و فناوری اطلاعات (مجموعهٔ ۱۲۷۶) از ۱۴۰۰ تا ۱۴۰۵، سؤال به سؤال. هر کلید از صفحهٔ کلید همان دفترچه در بانک سؤال کنکور کامپیوتر آمده و کنار هر سال نوشته‌ایم کلید نهایی است یا اولیه، چون اگر تست‌های یک سال را با کلید اشتباه تصحیح کنی، درصدت با درصد واقعی آن سال فرق می‌کند."));
blocks.push(text("علامت * یعنی آن سؤال در کلید نهایی «تأثیر مثبت» گرفته، یعنی پاسخش فقط به نفع داوطلب حساب شده است. «۲ و ۴» یعنی هر دو گزینه درست اعلام شده‌اند. «حذف» یعنی سؤال در نمره‌گذاری حساب نشده است. علامت † یعنی پاسخ آن سؤال از کلید اولیه آمده است. شمارهٔ سؤال‌ها مال همان دفترچه‌ای است که کنار هر سال آمده."));

blocks.push(h2("کلید هر سال چقدر قطعی است؟"));
blocks.push({
  type: "table",
  headers: ["سال", "مجموعه", "دفترچه", "وضعیت کلید"],
  rows: YEARS.flatMap((year) => ["ce", "it"].map((track) => [fa(year), TRACK[track].code, fa(KEYS[track][year].booklet), status(KEYS[track][year])])),
});

for (const year of YEARS) {
  blocks.push(h2(`کلید کنکور ارشد کامپیوتر ${fa(year)}`));
  for (const track of ["ce", "it"]) {
    const y = KEYS[track][year];
    blocks.push(h3(`${TRACK[track].name}، مجموعهٔ ${TRACK[track].code}، دفترچهٔ ${fa(y.booklet)}`));
    blocks.push(text(`${fa(y.total)} سؤال. ${sections(track, year)}. ${status(y)}`));
    blocks.push(keyTable(track, year));
  }
}

blocks.push(h2("پرسش‌های رایج"));
blocks.push(h3("کلید کنکور ارشد کامپیوتر ۱۴۰۵ نهایی است؟"));
blocks.push(text(`برای مهندسی کامپیوتر ۱۴۰۵، منبع ما مرحلهٔ کلید را ننوشته، ولی ${fa(KEYS.ce[1405].questions.filter((q) => q.deleted).length)} سؤال حذف‌شده دارد و حذف فقط در کلید نهایی اعلام می‌شود؛ پس به احتمال زیاد نهایی است. کلید IT ۱۴۰۵ که در دست داریم کلید اولیه است.`));
blocks.push(h3("اگر سؤالی «حذف» شده باشد، درصد چطور حساب می‌شود؟"));
blocks.push(text("سؤال حذف‌شده در نمره‌گذاری هیچ‌کس حساب نمی‌شود و درصد آن درس بر تعداد سؤال‌های باقی‌مانده حساب می‌شود."));
blocks.push(h3("کلید اولیه و نهایی چقدر فرق دارند؟"));
blocks.push(text("در دو سالی که هر دو کلید ارشد مهندسی کامپیوتر را داریم (۱۳۹۶ و ۱۴۰۲)، ۱۲ و ۹ سؤال بین دو کلید تغییر کرد و فقط در ۳ سؤال پاسخ درست کاملاً عوض شد. جزئیات در صفحهٔ سؤال‌های حذفی و دوکلیدی آمده است."));
blocks.push(h3("تست‌های این سال‌ها را کجا با کلید حل کنم؟"));
blocks.push(text("در بانک سؤال و شبیه‌ساز کنکور کامپیوتر؛ آنجا کلید هر سؤال کنار خودش است و سؤال‌های حذف‌شده و چندکلیدی همان‌طور حساب می‌شوند که در کلید نهایی آمده‌اند."));
blocks.push({
  type: "link_group",
  items: [
    { label: "سؤال‌های حذفی و دوکلیدی همهٔ سال‌ها", href: "/articles/deleted-and-multi-key-questions" },
    { label: "بانک سؤال کنکور با کلید", href: "/questions" },
    { label: "شبیه‌ساز کنکورهای سال‌های قبل", href: "/exams" },
    { label: "بودجه‌بندی ارشد مهندسی کامپیوتر", href: "/articles/master-computer-engineering-question-budget" },
    { label: "بودجه‌بندی ارشد IT", href: "/articles/master-it-question-budget" },
    { label: "دفترچه، کلید اولیه و کلید نهایی", href: "/guides/booklets-and-answer-keys" },
  ],
});

export default {
  schema_version: "article.v2",
  external_id: `kunkurcomputer-data-${slug}`,
  content_type: "article",
  title: "کلید کنکور ارشد کامپیوتر و IT از ۱۴۰۰ تا ۱۴۰۵؛ پاسخ همهٔ سؤال‌ها",
  slug,
  summary: "کلید کنکور ارشد مهندسی کامپیوتر (۱۲۷۷) و فناوری اطلاعات (۱۲۷۶) از ۱۴۰۰ تا ۱۴۰۵، سؤال به سؤال، با شمارهٔ دفترچه، بخش‌های هر دفترچه، سؤال‌های حذف‌شده و دوکلیدی، و اینکه کلید هر سال نهایی است یا اولیه.",
  quick_answer: "کلید ارشد مهندسی کامپیوتر و IT ۱۴۰۰ تا ۱۴۰۵ در این صفحه سؤال به سؤال آمده است. کلید IT ۱۴۰۰، ۱۴۰۲ و ۱۴۰۳ و مهندسی کامپیوتر ۱۴۰۲ نهایی است؛ کلید IT ۱۴۰۴ و ۱۴۰۵ اولیه است؛ برای بقیهٔ سال‌ها منبع مرحلهٔ کلید را ننوشته، ولی سال‌هایی که سؤال حذف‌شده دارند به احتمال زیاد کلید نهایی‌اند. وضعیت هر سال کنار جدولش آمده است.",
  content_blocks: blocks,
  seo: {
    title: "کلید کنکور ارشد کامپیوتر و IT ۱۴۰۰ تا ۱۴۰۵",
    description: "پاسخ همهٔ سؤال‌های کنکور ارشد مهندسی کامپیوتر و IT از ۱۴۰۰ تا ۱۴۰۵، با سؤال‌های حذف‌شده و دوکلیدی و وضعیت نهایی یا اولیه بودن کلید هر سال.",
  },
  taxonomy: { major: ["کامپیوتر و IT"], tags: ["کلید نهایی", "پاسخنامه", "تحلیل آزمون"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
  validity: { exam_year: 1406, time_sensitive: false, source_checked_at: "2026-10-13T00:00:00.000Z", review_due_at: "2027-06-30T00:00:00.000Z" },
  sources: [
    {
      source_external_id: "editorial-source-bd8f7cb1262dd65dec24",
      relation: "SUPPORTS",
      locator: "دفترچه‌ها و کلیدهای کنکور کارشناسی ارشد مجموعهٔ ۱۲۷۷ و ۱۲۷۶، ۱۴۰۰ تا ۱۴۰۵",
      claim: "پاسخ هر سؤال، سؤال‌های حذف‌شده، چندکلیدی و با تأثیر مثبت",
      order: 0,
    },
    {
      source_external_id: "editorial-source-08110ffe99548a591190",
      relation: "SUPPORTS",
      locator: "بانک سؤال کنکور کامپیوتر، ساخته‌شده از همین دفترچه‌ها و کلیدها و مقایسه‌شده با تصویر اصلی هر سؤال",
      claim: "مرحلهٔ کلید (اولیه یا نهایی) هر سال و بخش‌های هر دفترچه",
      order: 1,
    },
  ],
  editorial: { author_slug: "mohammad-rostami" },
  provenance: {
    producer_type: "external_ai",
    producer_name: "استخراج با Claude از بانک سؤال کنکور کامپیوتر (کلیدهای سنجش)؛ فقط کلیدها، بدون متن سؤال — نیازمند بازبینی و تأیید محمد رستمی",
    source_artifact: `content/import-packages/articles/${slug}.mjs`,
  },
  review_status: "draft",
};
