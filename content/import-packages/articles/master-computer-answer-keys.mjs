// The answer keys of the master's exams 1277 (computer engineering) and 1276
// (IT), 1400-1405, from the owner's bank (analysis/keys.json): each key read
// from the booklet's own key page and checked against the question. Each key
// is drawn as an answer sheet (answer_key block).
//
// Which keys are final: the source file says so (CE 1400, 1402, 1403: «کلید
// نهایی»; CE 1405: final key of booklet 135B), or the key carries deletions,
// multiple keys or positive effects, which only a final key announces. CE 1404
// and IT 1404/1405 are Sanjesh's initial key sheets.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { keySheetBlocks } from "../lib/solutions-1405.mjs";

const KEYS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/keys.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const slug = "master-computer-answer-keys";
const YEARS = [1405, 1404, 1403, 1402, 1401, 1400];
const TRACK = { ce: { name: "مهندسی کامپیوتر", code: "۱۲۷۷" }, it: { name: "فناوری اطلاعات (IT)", code: "۱۲۷۶" } };
// keys.json keeps «1» as the CE booklet; the codes of the booklets themselves.
const CE_BOOKLETS = { 1400: "830A", 1402: "934C", 1403: "164C", 1404: "335C", 1405: "135A" };
const FINAL_BY_SOURCE = { ce: [1400, 1402, 1403, 1405] };
// The final key of CE 1405 (booklet 135B) made q86 two-key; in 135A that is options 2 and 3.
const OVERRIDES = { ce: { 1405: { 86: [2, 3] } } };

function stage(track, year) {
  const y = KEYS[track][year];
  if (FINAL_BY_SOURCE[track]?.includes(year) || y.stages.final) return "final";
  if (y.questions.some((q) => q.deleted || q.positive || q.accepted.length > 1)) return "final";
  return "initial";
}

/** One line about the key, said plainly. */
function keyLine(track, year) {
  const y = KEYS[track][year];
  const deleted = y.questions.filter((q) => q.deleted).map((q) => fa(q.n));
  const multi = y.questions.filter((q) => q.accepted.length > 1 || OVERRIDES[track]?.[year]?.[q.n]).map((q) => fa(q.n));
  const positive = y.questions.filter((q) => q.positive).map((q) => fa(q.n));
  const list = (ns) => (ns.length === 1 ? ns[0] : `${ns.slice(0, -1).join("، ")} و ${ns.at(-1)}`);
  const say = (ns, one, many) => `${ns.length === 1 ? "سؤال" : "سؤال‌های"} ${list(ns)} ${ns.length === 1 ? one : many}`;
  const parts = [];
  if (deleted.length) parts.push(say(deleted, "حذف شد", "حذف شدند"));
  if (multi.length) parts.push(say(multi, "دوکلیدی شد", "دوکلیدی شدند"));
  if (positive.length) parts.push(say(positive, "تأثیر مثبت گرفت", "تأثیر مثبت گرفتند"));
  const head = stage(track, year) === "final" ? "کلید نهایی سنجش" : "کلید اولیهٔ سنجش";
  return `${head}؛ ${fa(y.total)} سؤال.${parts.length ? ` ${parts.join("؛ ")}.` : ""}`;
}

/** The booklet's sections from its own section names, as answer-sheet groups. */
function keyBlock(track, year) {
  const y = KEYS[track][year];
  const mixed = stage(track, year) === "final" && Boolean(y.stages.initial) && y.stages.initial < y.total && year !== 1405;
  const groups = [];
  for (const q of y.questions) {
    const name = (q.subject ?? "بدون عنوان").replace(/\s*\(.*?\)\s*$/, "");
    if (groups.at(-1)?.title !== name) groups.push({ title: name, items: [] });
    const override = OVERRIDES[track]?.[year]?.[q.n];
    const answer = q.deleted ? [] : override ?? q.accepted;
    const mark = q.deleted ? "deleted" : answer.length > 1 ? "multi" : q.positive ? "positive" : mixed && q.stage === "initial" ? "initial" : undefined;
    groups.at(-1).items.push({ n: q.n, answer, ...(mark ? { mark } : {}) });
  }
  return { type: "answer_key", groups, ...(mixed ? { caption: "خانه‌هایی که «اولیه» خورده‌اند در برگهٔ کلید نهایی ردیف نداشتند و پاسخشان از کلید اولیه است." } : {}) };
}

const out = { assets: [], files: {} };
const blocks = [];
blocks.push(text("کلید کنکور ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) و فناوری اطلاعات (مجموعهٔ ۱۲۷۶) از ۱۴۰۰ تا ۱۴۰۵، هر کدام مثل یک پاسخ‌برگ: هر خانه یک سؤال است و گزینهٔ درستش پر شده. سؤال‌هایی که کلید نهایی حذف کرد، دوکلیدی کرد یا به آن‌ها تأثیر مثبت داد، روی همان خانه نوشته شده‌اند."));
blocks.push(text("یک نکتهٔ کوچک ولی مهم: اگر تست‌های یک سال را با کلید اولیه تصحیح کنی و سؤال حذف‌شده را هم حساب کنی، درصدت با درصد واقعی آن سال نمی‌خواند. برای همین کنار هر کلید نوشته‌ایم اولیه است یا نهایی."));
blocks.push({
  type: "table",
  headers: ["سال", "مهندسی کامپیوتر (۱۲۷۷)", "IT (۱۲۷۶)"],
  rows: YEARS.map((year) => [fa(year), ...["ce", "it"].map((track) => `${stage(track, year) === "final" ? "نهایی" : "اولیه"}${KEYS[track][year].questions.some((q) => q.deleted) ? `، ${fa(KEYS[track][year].questions.filter((q) => q.deleted).length)} حذفی` : ""}`)]),
});

for (const year of YEARS) {
  blocks.push(h2(`کلید کنکور ارشد کامپیوتر ${fa(year)}`));
  for (const track of ["ce", "it"]) {
    const y = KEYS[track][year];
    const booklet = track === "ce" ? CE_BOOKLETS[year] : y.booklet;
    blocks.push(h3(`${TRACK[track].name}، مجموعهٔ ${TRACK[track].code}${booklet ? `، دفترچهٔ ${booklet}` : ""}`));
    blocks.push(text(keyLine(track, year)));
    blocks.push(keyBlock(track, year));
    if (track === "ce" && year === 1405) {
      blocks.push(text("تصویر کلید اولیه و نهایی ۱۴۰۵ را هم این‌جا گذاشته‌ایم. کلید نهایی مال دفترچهٔ 135B است: شمارهٔ سؤال‌ها همان است ولی ترتیب گزینه‌ها فرق دارد."));
      blocks.push(...keySheetBlocks(out));
    }
  }
}

blocks.push(h2("پرسش‌های رایج"));
blocks.push(h3("کلید نهایی کنکور ارشد کامپیوتر ۱۴۰۵ چه چیزی را عوض کرد؟"));
blocks.push(text("در مهندسی کامپیوتر چهار سؤال (۶۵، ۸۲، ۱۰۲ و ۱۰۵) حذف شد، سؤال ۸۶ دوکلیدی شد (هم ۱۳ و هم ۱۱ پذیرفته شد) و سؤال ۳۳ تأثیر مثبت گرفت. حل تشریحی همهٔ این سؤال‌ها در صفحهٔ حل ۱۴۰۵ آمده است."));
blocks.push(h3("اگر سؤالی «حذف» شده باشد، درصد چطور حساب می‌شود؟"));
blocks.push(text("سؤال حذف‌شده در نمره‌گذاری هیچ‌کس حساب نمی‌شود و درصد آن درس بر تعداد سؤال‌های باقی‌مانده حساب می‌شود."));
blocks.push(h3("کلید اولیه و نهایی چقدر فرق دارند؟"));
blocks.push(text("در ۱۳۹۶ و ۱۴۰۲ که هر دو کلید ارشد مهندسی کامپیوتر را کنار هم گذاشتیم، ۱۲ و ۹ سؤال بین دو کلید تغییر کرد و فقط در ۳ سؤال پاسخ درست کاملاً عوض شد؛ بیشتر تغییرها حذف و دوکلیدی شدن است. جزئیات در صفحهٔ سؤال‌های حذفی و دوکلیدی آمده است."));
blocks.push(h3("تست‌های این سال‌ها را کجا با کلید حل کنم؟"));
blocks.push(text("در بانک سؤال و شبیه‌ساز کنکور کامپیوتر؛ آنجا کلید هر سؤال کنار خودش است و سؤال‌های حذف‌شده و چندکلیدی همان‌طور حساب می‌شوند که در کلید نهایی آمده‌اند."));
blocks.push({
  type: "link_group",
  items: [
    { label: "حل تشریحی سؤالات کنکور ارشد مهندسی کامپیوتر ۱۴۰۵", href: "/articles/konkur-1405-computer-engineering-solutions" },
    { label: "سؤال‌های حذفی و دوکلیدی همهٔ سال‌ها", href: "/articles/deleted-and-multi-key-questions" },
    { label: "بانک سؤال کنکور با کلید", href: "/questions" },
    { label: "شبیه‌ساز کنکورهای سال‌های قبل", href: "/exams" },
    { label: "بودجه‌بندی هوشمند ۱۴۰۶", href: "/budget" },
    { label: "دفترچه، کلید اولیه و کلید نهایی", href: "/guides/booklets-and-answer-keys" },
  ],
});

export const files = out.files;

export default {
  schema_version: "article.v2",
  external_id: `kunkurcomputer-data-${slug}`,
  content_type: "article",
  title: "کلید کنکور ارشد کامپیوتر و IT از ۱۴۰۰ تا ۱۴۰۵؛ پاسخ همهٔ سؤال‌ها",
  slug,
  summary: "کلید کنکور ارشد مهندسی کامپیوتر (۱۲۷۷) و فناوری اطلاعات (۱۲۷۶) از ۱۴۰۰ تا ۱۴۰۵ به شکل پاسخ‌برگ، با سؤال‌های حذف‌شده، دوکلیدی و تأثیر مثبت، و تصویر کلید اولیه و نهایی ۱۴۰۵.",
  quick_answer: "کلید ارشد مهندسی کامپیوتر و IT از ۱۴۰۰ تا ۱۴۰۵ در این صفحه سؤال به سؤال آمده است. کلید مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۳ و ۱۴۰۵ و کلید IT ۱۴۰۰ تا ۱۴۰۳ نهایی است؛ مهندسی کامپیوتر ۱۴۰۴ و IT ۱۴۰۴ و ۱۴۰۵ کلید اولیهٔ سنجش است. در ۱۴۰۵ کلید نهایی سؤال‌های ۶۵، ۸۲، ۱۰۲ و ۱۰۵ را حذف کرد و ۸۶ را دوکلیدی کرد.",
  content_blocks: blocks,
  assets: out.assets,
  seo: {
    title: "کلید کنکور ارشد کامپیوتر و IT ۱۴۰۰ تا ۱۴۰۵",
    description: "پاسخ همهٔ سؤال‌های کنکور ارشد مهندسی کامپیوتر و IT از ۱۴۰۰ تا ۱۴۰۵ به شکل پاسخ‌برگ، با سؤال‌های حذف‌شده و دوکلیدی و تصویر کلید اولیه و نهایی ۱۴۰۵.",
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
