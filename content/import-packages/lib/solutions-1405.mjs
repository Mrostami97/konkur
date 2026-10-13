// Builds the «worked solutions of the 1405 computer-engineering master's exam»
// family: one full article with every solved question (the hub) and one
// article per subject still in the 1406 exam. Data in solutions-1405-data.mjs.
// Questions that need their figure carry the booklet crop as an asset; the key
// sheets come from analysis/key_images_1405.mjs. Image files stay in the
// owner's bank folder and are added to the import zip by bundle.mjs (via
// packages/<slug>/assets.json).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { BOOKLET, DROPPED, PASSAGES, QUESTIONS, SUBJECTS } from "./solutions-1405-data.mjs";

const BANK = process.env.KONKUR_BANK_ROOT ?? "C:/Users/Error/Documents/Codex/2026-10-03/new-chat";
const CROPS = path.join(BANK, "outputs/content_review/source_crops");
const KEY_IMAGES = path.join(BANK, "outputs/1405/site_assets");
const KEYS = JSON.parse(readFileSync(new URL("../analysis/keys.json", import.meta.url), "utf8")).ce[1405];
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const heading = (level, t) => ({ type: "heading", level, text: t });
const h2 = (t) => heading(2, t);
const h3 = (t) => heading(3, t);

export const HUB = "konkur-1405-computer-engineering-solutions";
export const slugOf = (key) => `konkur-1405-${SUBJECTS[key].slug}-solutions`;

/** The booklet's sections in order, for the whole key at a glance. */
const SECTIONS = [
  ["english", 1, 25],
  [null, 26, 32, "ریاضی عمومی ۱ و ۲"],
  ["statistics", 33, 39],
  ["discrete", 40, 45],
  ["automata", 46, 50],
  [null, 51, 55, "سیگنال‌ها و سیستم‌ها"],
  ["dsa", 56, 67],
  ["ai", 68, 75],
  ["logic", 76, 82],
  ["architecture", 83, 89],
  [null, 90, 95, "الکترونیک دیجیتال"],
  ["os", 96, 102],
  [null, 103, 108, "شبکه‌های کامپیوتری"],
  [null, 109, 115, "پایگاه داده‌ها"],
];

const positive = (q) => Boolean(q.note?.includes("تأثیر مثبت"));

/** One question of the answer key as the answer_key block draws it. */
function keyItem(n) {
  const q = QUESTIONS.find((x) => x.n === n);
  if (q) {
    if (q.deleted) return { n, answer: [], mark: "deleted" };
    if (q.accepted) return { n, answer: q.accepted, mark: "multi" };
    return { n, answer: [q.answer], ...(positive(q) ? { mark: "positive" } : {}) };
  }
  const k = KEYS.questions.find((x) => x.n === n);
  if (k.deleted) return { n, answer: [], mark: "deleted" };
  return { n, answer: k.accepted, ...(k.positive ? { mark: "positive" } : {}) };
}

function keyBlock(sections, caption) {
  return {
    type: "answer_key",
    ...(caption ? { caption } : {}),
    groups: sections.map(([key, from, to, title]) => ({
      title: key ? SUBJECTS[key].title : `${title} (در ۱۴۰۶ نیست)`,
      items: Array.from({ length: to - from + 1 }, (_, i) => keyItem(from + i)),
    })),
  };
}

function fileAsset(mediaKey, file) {
  const checksum = createHash("sha256").update(readFileSync(file)).digest("hex");
  const ext = path.extname(file).slice(1);
  return { asset: { media_key: mediaKey, filename: `${mediaKey}.${ext}`, mime_type: ext === "png" ? "image/png" : "image/jpeg", checksum: `sha256:${checksum}` }, file };
}

/** The booklet crop of question n as an article asset (and its file for the zip). */
function cropAsset(n) {
  const prefix = `doc-0d6b4ac841e02bf1-q-${String(n).padStart(4, "0")}-question-`;
  const file = readdirSync(CROPS).find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`no crop for q${n}`);
  return fileAsset(`konkur1405-q${String(n).padStart(3, "0")}`, path.join(CROPS, file));
}

function answerLine(q) {
  if (q.deleted) return `در کلید نهایی حذف شد (در کلید اولیه گزینهٔ ${fa(q.initial)} بود).`;
  if (q.accepted) return `پاسخ: گزینهٔ ${q.accepted.map(fa).join(" و ")}؛ کلید نهایی هر دو را درست حساب کرد (کلید اولیه فقط گزینهٔ ${fa(q.answer)}).`;
  return `پاسخ: گزینهٔ ${fa(q.answer)}.${q.note ? ` ${q.note}` : ""}`;
}

/** The blocks of one question: its passage when one starts here, stem, figure, options, answer, solution. */
function questionBlocks(q, level, out) {
  const blocks = [];
  const passage = Object.values(PASSAGES).find((p) => p.before === q.n);
  if (passage) {
    blocks.push(heading(level, passage.title));
    for (const para of passage.text.split("\n")) blocks.push({ type: "quote", text: para });
  }
  blocks.push(heading(level, `سؤال ${fa(q.n)}`));
  blocks.push(text(q.stem));
  if (q.image) {
    const { asset, file } = cropAsset(q.n);
    out.assets.push(asset);
    out.files[asset.filename] = file;
    blocks.push({ type: "image", media_key: asset.media_key, alt: `سؤال ${fa(q.n)} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ در دفترچه`, caption: `سؤال ${fa(q.n)} در دفترچهٔ ${BOOKLET}` });
  }
  blocks.push(text(q.options.map((o, i) => `${fa(i + 1)}) ${o}`).join("\n")));
  blocks.push(text(answerLine(q)));
  blocks.push(text(q.solution));
  return blocks;
}

/** What the final key changed, said once, the same way everywhere. */
const FINAL_CHANGES = [
  "• سؤال‌های ۶۵ (داده‌ساختار)، ۸۲ (مدار منطقی)، ۱۰۲ (سیستم عامل) و ۱۰۵ (شبکه) حذف شدند و برای هیچ‌کس حساب نشدند.",
  "• سؤال ۸۶ (معماری) دوکلیدی شد: هم ۱۳ و هم ۱۱ درست حساب شد، چون صورت سؤال نگفته بود ثبات در یک پالس هم نوشته و هم خوانده می‌شود یا نه.",
  "• سؤال ۳۳ (آمار) «تأثیر مثبت» گرفت: پاسخش فقط به نفع کسانی حساب شد که آن را زده بودند.",
].join("\n");

const SOURCES = (claim) => [
  { source_external_id: "editorial-source-bd8f7cb1262dd65dec24", relation: "SUPPORTS", locator: `دفترچهٔ سؤال و کلید کنکور کارشناسی ارشد مهندسی کامپیوتر (۱۲۷۷) ۱۴۰۵، دفترچهٔ ${BOOKLET}`, claim, order: 0 },
  { source_external_id: "editorial-source-08110ffe99548a591190", relation: "SUPPORTS", locator: "بانک سؤال کنکور کامپیوتر؛ متن هر سؤال با تصویر دفترچه مقایسه شده است", claim: "کلید اولیه و نهایی و سؤال‌های حذف‌شده", order: 1 },
];

const meta = (slug, tags, subjectCodes) => ({
  taxonomy: { major: ["کامپیوتر و IT"], tags: [...tags, "پاسخ تشریحی", "کنکور ۱۴۰۵", "حل تست"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: subjectCodes, topic_codes: [] },
  validity: { exam_year: 1406, time_sensitive: false, source_checked_at: "2026-10-13T00:00:00.000Z" },
  editorial: { author_slug: "mohammad-rostami" },
  provenance: {
    producer_type: "external_ai",
    producer_name: "حل تشریحی با Claude؛ متن هر سؤال با تصویر دفترچه مقایسه و هر پاسخ مستقل حل شده است — نیازمند بازبینی و تأیید محمد رستمی",
    source_artifact: `content/import-packages/articles/${slug}.mjs`,
  },
  review_status: "draft",
});

const in1406 = (key) =>
  key === "english" ? "بله، با ضریب ۱ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶."
    : ["statistics", "discrete"].includes(key) ? "بله، در بستهٔ ریاضیات با ضریب ۲ در مجموعه‌های ۱۲۷۷ و ۱۲۷۶."
      : ["dsa", "ai", "os"].includes(key) ? "بله، در بستهٔ تخصصی با ضریب ۴ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶."
        : "بله، در بستهٔ تخصصی مجموعهٔ ۱۲۷۷ با ضریب ۴.";

export function subjectArticle(key) {
  const subject = SUBJECTS[key];
  const slug = slugOf(key);
  const qs = QUESTIONS.filter((q) => q.subject === key);
  const out = { assets: [], files: {} };
  const blocks = [];
  const deleted = qs.filter((q) => q.deleted);
  const multi = qs.filter((q) => q.accepted);
  const disputed = qs.filter((q) => q.disputed);
  blocks.push(text(`همهٔ ${fa(qs.length)} تست ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ (مجموعهٔ ۱۲۷۷، سؤال‌های ${subject.range})، یکی‌یکی حل شده‌اند. صورت هر سؤال را با دفترچه مقایسه کرده‌ایم و هر جا کلید نهایی چیزی را عوض کرده، همان‌جا گفته‌ایم چرا. پیشنهاد ما: اول خودت با زمان حل کن، بعد حل را بخوان.`));
  const notes = [];
  if (deleted.length) notes.push(`سؤال ${deleted.map((q) => fa(q.n)).join(" و ")} در کلید نهایی حذف شد و علتش در حل آمده است`);
  if (multi.length) notes.push(`سؤال ${multi.map((q) => fa(q.n)).join(" و ")} دوکلیدی شد و هر دو برداشت را توضیح داده‌ایم`);
  if (disputed.length) notes.push(`در سؤال ${disputed.map((q) => fa(q.n)).join(" و ")} کلید سنجش با برداشت کتاب مرجع نمی‌خواند و هر دو را توضیح داده‌ایم`);
  if (notes.length) blocks.push(text(`${notes.join("؛ ")}.`));
  blocks.push(h2(`کلید ${subject.title} در یک نگاه`));
  blocks.push(keyBlock(SECTIONS.filter(([k]) => k === key), "روی هر خانه، گزینهٔ درست پر شده است؛ حل هر سؤال پایین‌تر آمده."));
  for (const q of qs) blocks.push(...questionBlocks(q, 2, out));
  blocks.push(h2("پرسش‌های رایج"));
  blocks.push(h3(`کنکور ارشد کامپیوتر ۱۴۰۵ چند سؤال ${subject.title} داشت؟`));
  blocks.push(text(`${fa(qs.length)} سؤال، شمارهٔ ${subject.range} در دفترچهٔ ۱۲۷۷.${deleted.length ? ` ${fa(deleted.length)} سؤال در کلید نهایی حذف شد.` : ""}`));
  blocks.push(h3(`${subject.title} در کنکور ۱۴۰۶ هست؟`));
  blocks.push(text(in1406(key)));
  blocks.push({
    type: "link_group",
    items: [
      { label: "حل تشریحی همهٔ سؤال‌های ۱۴۰۵ در یک صفحه", href: `/articles/${HUB}` },
      { label: `صفحهٔ درس ${subject.title}`, href: `/subjects/${subject.code}` },
      { label: "کلید کنکور ارشد کامپیوتر ۱۴۰۰ تا ۱۴۰۵", href: "/articles/master-computer-answer-keys" },
      { label: "شبیه‌ساز کنکورهای سال‌های قبل", href: "/exams" },
      { label: "درس‌نامه‌ها", href: "/lesson-notes" },
    ],
  });
  const title = `پاسخ تشریحی ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵`;
  return {
    article: {
      schema_version: "article.v2",
      external_id: `kunkurcomputer-solutions-${slug}`,
      content_type: "article",
      title,
      slug,
      summary: `حل قدم‌به‌قدم همهٔ ${fa(qs.length)} سؤال ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، با کلید اولیه و نهایی و توضیح سؤال‌هایی که کلید نهایی عوض کرد.`,
      quick_answer: `کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ ${fa(qs.length)} سؤال ${subject.title} داشت (سؤال‌های ${subject.range}). کلید: ${qs.map((q) => `${fa(q.n)}: ${q.deleted ? "حذف" : q.accepted ? q.accepted.map(fa).join(" و ") : fa(q.answer)}`).join("، ")}. حل هر سؤال در این صفحه آمده است.`,
      content_blocks: blocks,
      seo: { title: `پاسخ تشریحی ${subject.title} کنکور ارشد کامپیوتر ۱۴۰۵`, description: `حل تشریحی همهٔ سؤال‌های ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، سؤال به سؤال، با کلید نهایی و توضیح سؤال‌های حذف‌شده.` },
      sources: SOURCES(`صورت، گزینه‌ها و کلید سؤال‌های ${subject.title}`),
      ...(out.assets.length ? { assets: out.assets } : {}),
      ...meta(slug, [subject.title], [subject.code]),
    },
    files: out.files,
  };
}

/** The key sheets as article assets; shared with the answer-keys article. */
export function keySheetBlocks(out) {
  const initial = fileAsset("konkur1405-key-initial-135a", path.join(KEY_IMAGES, "key-1405-initial-135A.png"));
  const final = fileAsset("konkur1405-key-final-135b", path.join(KEY_IMAGES, "key-1405-final-135B.png"));
  for (const { asset, file } of [initial, final]) {
    out.assets.push(asset);
    out.files[asset.filename] = file;
  }
  return [
    { type: "image", media_key: initial.asset.media_key, alt: "کلید اولیهٔ کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، دفترچهٔ 135A", caption: "کلید اولیهٔ سنجش برای دفترچهٔ 135A (دروس اختصاصی، مجموعهٔ ۱۲۷۷). شمارهٔ گزینه‌های همین صفحه با این دفترچه است." },
    { type: "image", media_key: final.asset.media_key, alt: "کلید نهایی کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، دفترچهٔ 135B", caption: "کلید نهایی، از دفترچهٔ 135B. شمارهٔ سؤال‌ها در دو دفترچه یکی است ولی ترتیب گزینه‌ها فرق دارد؛ برای همین گزینه‌های این برگه با 135A نمی‌خواند. حذف‌ها، دوکلیدی شدن ۸۶ و تأثیر مثبت ۳۳ را از همین برگه برداشته‌ایم." },
  ];
}

export function hubArticle() {
  const slug = HUB;
  const out = { assets: [], files: {} };
  const blocks = [];
  const covered = QUESTIONS;
  blocks.push(text(`همهٔ تست‌های کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ (مجموعهٔ ۱۲۷۷) که درسشان در کنکور ۱۴۰۶ هم هست، این‌جا یک‌جا و سؤال به سؤال حل شده‌اند: ${fa(covered.length)} سؤال از ${fa(Object.keys(SUBJECTS).length)} درس، از زبان تا سیستم عامل. صورت هر سؤال با دفترچه مقایسه شده و هر جا کلید نهایی چیزی را عوض کرده، علتش کنار همان سؤال آمده است.`));
  blocks.push(text("اگر حوصلهٔ یک صفحهٔ بلند را نداری، هر درس صفحهٔ جدای خودش را هم دارد (پیوندها پایین همین بخش). و یک توصیه: این دفترچه بهترین شبیه‌ساز کنکور ۱۴۰۶ است؛ اول خودت با زمان حلش کن، بعد سراغ حل‌ها بیا."));
  blocks.push({ type: "link_group", items: Object.keys(SUBJECTS).map((key) => ({ label: `فقط ${SUBJECTS[key].title}`, href: `/articles/${slugOf(key)}` })) });

  blocks.push(h2("کلید ۱۴۰۵ در یک نگاه"));
  blocks.push(text("هر خانه یک سؤال است و گزینهٔ درستش پر شده؛ درست مثل پاسخ‌برگ خودت. کلید هر ۱۱۵ سؤال آمده، حتی درس‌هایی که از ۱۴۰۶ کنار رفته‌اند."));
  blocks.push(keyBlock(SECTIONS, `گزینه‌ها مطابق دفترچهٔ ${BOOKLET}.`));

  blocks.push(h2("کلید نهایی چه چیزی را عوض کرد؟"));
  blocks.push(text(FINAL_CHANGES));
  blocks.push(h2("تصویر کلید اولیه و نهایی"));
  blocks.push(...keySheetBlocks(out));

  for (const [key, from, to] of SECTIONS.filter(([k]) => k)) {
    const subject = SUBJECTS[key];
    const qs = covered.filter((q) => q.subject === key);
    blocks.push(h2(`${subject.title}: سؤال‌های ${fa(from)} تا ${fa(to)}`));
    for (const q of qs) blocks.push(...questionBlocks(q, 3, out));
  }

  blocks.push(h2("سؤال‌هایی که با دقت بیشتری باید خواند"));
  blocks.push(text([
    "• سؤال ۷۳ (هوش مصنوعی): کلید سنجش گزینهٔ ۲ است، ولی با تعریف‌های کتاب راسل و نورویگ دو گزاره درست است و گزینهٔ ۳ به دست می‌آید. هر دو برداشت در حل آمده است.",
    "• سؤال ۸۶ (معماری): ۱۳ یا ۱۱، بسته به این‌که ثبات در یک پالس هم نوشته و هم خوانده شود یا نه؛ کلید نهایی هر دو را پذیرفت.",
    "• سؤال ۱۰۰ (سیستم عامل): compare_and_swap مقدار قبلی را برمی‌گرداند (تعریف کتاب سیلبرشاتس) و به همین دلیل جواب ۵۰ است، نه ۱۲.",
  ].join("\n")));
  blocks.push(h2("درس‌هایی که در ۱۴۰۶ نیستند"));
  blocks.push(text(`${DROPPED.map(([t, r]) => `${t} (${r})`).join("، ")} از مواد امتحانی ۱۴۰۶ مجموعهٔ ۱۲۷۷ کنار رفته‌اند؛ برای همین حلشان را نیاورده‌ایم و فقط کلیدشان در جدول بالا هست.`));

  blocks.push(h2("پرسش‌های رایج"));
  blocks.push(h3("کلید نهایی کنکور ارشد کامپیوتر ۱۴۰۵ با کلید اولیه چه فرقی داشت؟"));
  blocks.push(text("چهار سؤال (۶۵، ۸۲، ۱۰۲ و ۱۰۵) حذف شد، سؤال ۸۶ دوکلیدی شد (هم ۱۳ و هم ۱۱) و سؤال ۳۳ تأثیر مثبت گرفت."));
  blocks.push(h3("چرا گزینه‌های کلید نهایی با دفترچهٔ من نمی‌خواند؟"));
  blocks.push(text("کلید نهایی‌ای که این‌جا آمده مال دفترچهٔ 135B است و ترتیب گزینه‌هایش با 135A فرق دارد؛ شمارهٔ سؤال‌ها یکی است. کلید بالای صفحه را با گزینه‌های 135A نوشته‌ایم."));
  blocks.push(h3("بهتر است حل‌ها را کی بخوانم؟"));
  blocks.push(text("اول سؤال‌های هر درس را خودت با زمان حل کن و پاسخت را بنویس، بعد حل را بخوان. حل خواندن بدون تلاش قبلی، حس فهمیدن می‌دهد ولی در جلسهٔ آزمون کمک زیادی نمی‌کند."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "کلید کنکور ارشد کامپیوتر ۱۴۰۰ تا ۱۴۰۵", href: "/articles/master-computer-answer-keys" },
      { label: "کنکور ۱۴۰۵ از نگاه کارنامه‌ها", href: "/articles/exam-1405-analysis" },
      { label: "بودجه‌بندی هوشمند ۱۴۰۶", href: "/budget" },
      { label: "تغییرات کنکور ۱۴۰۶", href: "/guides/master-exam-changes-1406" },
      { label: "درس‌نامه‌ها", href: "/lesson-notes" },
    ],
  });
  return {
    article: {
      schema_version: "article.v2",
      external_id: `kunkurcomputer-solutions-${slug}`,
      content_type: "article",
      title: "حل تشریحی سؤالات کنکور ارشد مهندسی کامپیوتر ۱۴۰۵",
      slug,
      summary: `همهٔ ${fa(covered.length)} تست کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ در درس‌هایی که در ۱۴۰۶ هم هستند، یک‌جا و سؤال به سؤال حل شده؛ با کلید کامل به شکل پاسخ‌برگ، تصویر کلید اولیه و نهایی، و هر چه کلید نهایی عوض کرد.`,
      quick_answer: "حل تشریحی کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ برای همهٔ درس‌هایی که در ۱۴۰۶ مانده‌اند (زبان، آمار، گسسته، نظریه، داده‌ساختار و الگوریتم، هوش، مدار منطقی، معماری و سیستم عامل) در همین صفحه آمده است. کلید نهایی سؤال‌های ۶۵، ۸۲، ۱۰۲ و ۱۰۵ را حذف کرد، سؤال ۸۶ را دوکلیدی کرد و به سؤال ۳۳ تأثیر مثبت داد.",
      content_blocks: blocks,
      seo: { title: "حل تشریحی سؤالات کنکور ارشد کامپیوتر ۱۴۰۵", description: "حل تشریحی همهٔ سؤال‌های کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ در یک صفحه، با کلید اولیه و نهایی، تصویر کلیدها و توضیح سؤال‌های حذف‌شده و دوکلیدی." },
      sources: SOURCES("صورت، گزینه‌ها و کلید سؤال‌ها"),
      assets: out.assets,
      ...meta(slug, ["کلید نهایی"], Object.values(SUBJECTS).map((s) => s.code)),
    },
    files: out.files,
  };
}
