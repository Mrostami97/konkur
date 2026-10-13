// Builds the «worked solutions of the 1405 computer-engineering master's exam»
// family: one hub and one article per subject still in the 1406 exam. Data in
// solutions-1405-data.mjs. Questions that need their figure carry the booklet
// crop as an asset; the image files stay in the owner's bank folder and are
// added to the import zip by bundle.mjs (via packages/<slug>/assets.json).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { BOOKLET, DROPPED, PASSAGES, QUESTIONS, SUBJECTS } from "./solutions-1405-data.mjs";

const BANK = process.env.KONKUR_BANK_ROOT ?? "C:/Users/Error/Documents/Codex/2026-10-03/new-chat";
const CROPS = path.join(BANK, "outputs/content_review/source_crops");
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });

export const HUB = "konkur-1405-computer-engineering-solutions";
export const slugOf = (key) => `konkur-1405-${SUBJECTS[key].slug}-solutions`;

/** The booklet crop of question n as an article asset (and its file for the zip). */
function cropAsset(n) {
  const prefix = `doc-0d6b4ac841e02bf1-q-${String(n).padStart(4, "0")}-question-`;
  const file = readdirSync(CROPS).find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`no crop for q${n}`);
  const full = path.join(CROPS, file);
  const checksum = createHash("sha256").update(readFileSync(full)).digest("hex");
  const filename = `konkur1405-q${String(n).padStart(3, "0")}.jpg`;
  return { asset: { media_key: `konkur1405-q${String(n).padStart(3, "0")}`, filename, mime_type: "image/jpeg", checksum: `sha256:${checksum}` }, file: full };
}

function answerLine(q) {
  if (q.deleted) return `این سؤال در کلید نهایی حذف شد (کلید اولیه: گزینهٔ ${fa(q.initial)}).`;
  return `پاسخ: گزینهٔ ${fa(q.answer)}.${q.note ? ` ${q.note}` : ""}`;
}

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

export function subjectArticle(key) {
  const subject = SUBJECTS[key];
  const slug = slugOf(key);
  const qs = QUESTIONS.filter((q) => q.subject === key);
  const assets = [];
  const files = {};
  const blocks = [];
  const deleted = qs.filter((q) => q.deleted);
  const disputed = qs.filter((q) => q.disputed);
  blocks.push(text(`پاسخ تشریحی همهٔ ${fa(qs.length)} سؤال ${subject.title} کنکور کارشناسی ارشد مهندسی کامپیوتر ۱۴۰۵ (مجموعهٔ ۱۲۷۷، سؤال‌های ${subject.range}). صورت و گزینه‌های هر سؤال با تصویر دفترچه مقایسه شده و هر پاسخ جداگانه حل و با کلید سنجش تطبیق داده شده است. در ۱۴۰۵ کلید اولیه و نهایی در همهٔ پاسخ‌ها یکی بودند؛ فقط چند سؤال در کلید نهایی حذف شدند.`));
  if (deleted.length || disputed.length) {
    const parts = [];
    if (deleted.length) parts.push(`سؤال ${deleted.map((q) => fa(q.n)).join(" و ")} در کلید نهایی حذف شد و علتش در حل آمده است`);
    if (disputed.length) parts.push(`در سؤال ${disputed.map((q) => fa(q.n)).join(" و ")} کلید سنجش با برداشت کتاب مرجع نمی‌خواند و هر دو را توضیح داده‌ایم`);
    blocks.push(text(`${parts.join("؛ ")}.`));
  }
  for (const q of qs) {
    const passage = Object.values(PASSAGES).find((p) => p.before === q.n);
    if (passage) {
      blocks.push(h2(passage.title));
      for (const para of passage.text.split("\n")) blocks.push({ type: "quote", text: para });
    }
    blocks.push(h2(`سؤال ${fa(q.n)}`));
    blocks.push(text(q.stem));
    if (q.image) {
      const { asset, file } = cropAsset(q.n);
      assets.push(asset);
      files[asset.filename] = file;
      blocks.push({ type: "image", media_key: asset.media_key, alt: `سؤال ${fa(q.n)} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ در دفترچه`, caption: `سؤال ${fa(q.n)} در دفترچهٔ ${BOOKLET}` });
    }
    blocks.push(text(q.options.map((o, i) => `${fa(i + 1)}) ${o}`).join("\n")));
    blocks.push(text(answerLine(q)));
    blocks.push(text(q.solution));
  }
  blocks.push(h2("پرسش‌های رایج"));
  blocks.push(h3(`کنکور ارشد کامپیوتر ۱۴۰۵ چند سؤال ${subject.title} داشت؟`));
  blocks.push(text(`${fa(qs.length)} سؤال، شمارهٔ ${subject.range} در دفترچهٔ ۱۲۷۷.${deleted.length ? ` ${fa(deleted.length)} سؤال در کلید نهایی حذف شد.` : ""}`));
  blocks.push(h3(`${subject.title} در کنکور ۱۴۰۶ هست؟`));
  blocks.push(text(key === "english" ? "بله، با ضریب ۱ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶." : ["statistics", "discrete"].includes(key) ? "بله، در بستهٔ ریاضیات با ضریب ۲ در مجموعه‌های ۱۲۷۷ و ۱۲۷۶." : ["dsa", "ai", "os"].includes(key) ? "بله، در بستهٔ تخصصی با ضریب ۴ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶." : "بله، در بستهٔ تخصصی مجموعهٔ ۱۲۷۷ با ضریب ۴."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "پاسخ تشریحی همهٔ درس‌های ۱۴۰۵", href: `/articles/${HUB}` },
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
      summary: `حل قدم‌به‌قدم همهٔ ${fa(qs.length)} سؤال ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، با کلید اولیه و نهایی و توضیح سؤال‌های حذف‌شده.`,
      quick_answer: `کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ ${fa(qs.length)} سؤال ${subject.title} داشت (سؤال‌های ${subject.range}). کلید: ${qs.map((q) => `${fa(q.n)}: ${q.deleted ? "حذف" : fa(q.answer)}`).join("، ")}. حل هر سؤال در این صفحه آمده است.`,
      content_blocks: blocks,
      seo: { title: `پاسخ تشریحی ${subject.title} کنکور ارشد کامپیوتر ۱۴۰۵`, description: `حل تشریحی همهٔ سؤال‌های ${subject.title} کنکور ارشد مهندسی کامپیوتر ۱۴۰۵، سؤال به سؤال، با کلید نهایی و توضیح سؤال‌های حذف‌شده.` },
      sources: SOURCES(`صورت، گزینه‌ها و کلید سؤال‌های ${subject.title}`),
      ...(assets.length ? { assets } : {}),
      ...meta(slug, [subject.title], [subject.code]),
    },
    files,
  };
}

export function hubArticle() {
  const slug = HUB;
  const blocks = [];
  const covered = QUESTIONS;
  blocks.push(text("پاسخ تشریحی کنکور کارشناسی ارشد مهندسی کامپیوتر ۱۴۰۵ (مجموعهٔ ۱۲۷۷)، درس به درس. فقط درس‌هایی را حل کرده‌ایم که در کنکور ۱۴۰۶ هم هستند؛ پنج درسی که از ۱۴۰۶ کنار رفته‌اند در پایین صفحه فهرست شده‌اند. صورت هر سؤال با تصویر دفترچه مقایسه و هر پاسخ جداگانه حل شده است."));
  blocks.push(h2("حل هر درس"));
  blocks.push({
    type: "table",
    headers: ["درس", "سؤال‌ها", "تعداد"],
    rows: Object.entries(SUBJECTS).map(([key, s]) => [s.title, s.range, fa(covered.filter((q) => q.subject === key).length)]),
  });
  blocks.push({ type: "link_group", items: Object.keys(SUBJECTS).map((key) => ({ label: `پاسخ تشریحی ${SUBJECTS[key].title}`, href: `/articles/${slugOf(key)}` })) });
  blocks.push(h2("کلید اولیه و نهایی ۱۴۰۵"));
  blocks.push(text("در ۱۴۰۵ کلید اولیه و نهایی پاسخ هیچ سؤالی را عوض نکردند. کلید نهایی فقط چهار سؤال را حذف کرد (۶۵ داده‌ساختار، ۸۲ مدار منطقی، ۱۰۲ سیستم عامل و ۱۰۵ شبکه) و به سؤال ۳۳ آمار «تأثیر مثبت» داد. علت حذف هر کدام در حل همان درس آمده است."));
  blocks.push(h2("کلید همهٔ سؤال‌های حل‌شده"));
  const rows = [];
  for (let i = 0; i < covered.length; i += 5) {
    const row = [];
    for (const q of covered.slice(i, i + 5)) row.push(fa(q.n), q.deleted ? "حذف" : fa(q.answer) + (q.note ? "*" : ""));
    while (row.length < 10) row.push("", "");
    rows.push(row);
  }
  blocks.push({ type: "table", headers: ["سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ", "سؤال", "پاسخ"], rows });
  blocks.push(text("* تأثیر مثبت در کلید نهایی."));
  blocks.push(h2("سؤال‌هایی که باید با دقت بیشتری خواند"));
  blocks.push(text([
    "• سؤال ۷۳ (هوش مصنوعی): کلید سنجش گزینهٔ ۲ است، ولی طبق تعریف‌های کتاب راسل و نورویگ دو گزاره درست است و گزینهٔ ۳ به دست می‌آید. هر دو برداشت در حل آمده است.",
    "• سؤال ۸۶ (معماری): جواب ۱۳ با این فرض است که ثبات در یک پالس هم نوشته و هم خوانده نمی‌شود؛ با فرض نیم‌پالس جواب ۱۱ می‌شد.",
    "• سؤال ۱۰۰ (سیستم عامل): compare_and_swap مقدار قبلی را برمی‌گرداند (تعریف کتاب سیلبرشاتس) و به همین دلیل جواب ۵۰ است، نه ۱۲.",
  ].join("\n")));
  blocks.push(h2("درس‌هایی که در ۱۴۰۶ نیستند"));
  blocks.push(text(`این سؤال‌های ۱۴۰۵ را حل نکرده‌ایم، چون درسشان در مواد امتحانی ۱۴۰۶ مجموعهٔ ۱۲۷۷ نیست: ${DROPPED.map(([t, r]) => `${t} (${r})`).join("، ")}. کلیدشان در صفحهٔ کلید کنکور آمده است.`));
  blocks.push(h2("پرسش‌های رایج"));
  blocks.push(h3("کلید نهایی کنکور ارشد کامپیوتر ۱۴۰۵ با کلید اولیه چه فرقی داشت؟"));
  blocks.push(text("هیچ پاسخی عوض نشد؛ کلید نهایی چهار سؤال (۶۵، ۸۲، ۱۰۲ و ۱۰۵) را حذف کرد و به سؤال ۳۳ تأثیر مثبت داد."));
  blocks.push(h3("بهتر است حل‌ها را کی بخوانم؟"));
  blocks.push(text("اول سؤال‌های هر درس را خودت با زمان حل کن و پاسخت را بنویس، بعد حل را بخوان. حل خواندن بدون تلاش قبلی، حس فهمیدن می‌دهد ولی در جلسهٔ آزمون کمک زیادی نمی‌کند."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "کلید کنکور ارشد کامپیوتر ۱۴۰۰ تا ۱۴۰۵", href: "/articles/master-computer-answer-keys" },
      { label: "کنکور ۱۴۰۵ از نگاه کارنامه‌ها", href: "/articles/exam-1405-analysis" },
      { label: "تغییرات کنکور ۱۴۰۶", href: "/guides/master-exam-changes-1406" },
      { label: "درس‌نامه‌ها", href: "/lesson-notes" },
    ],
  });
  return {
    article: {
      schema_version: "article.v2",
      external_id: `kunkurcomputer-solutions-${slug}`,
      content_type: "article",
      title: "پاسخ تشریحی کنکور ارشد مهندسی کامپیوتر ۱۴۰۵؛ همهٔ درس‌های ۱۴۰۶",
      slug,
      summary: `حل تشریحی ${fa(covered.length)} سؤال کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ در ۹ درسی که در کنکور ۱۴۰۶ هم هستند، با کلید اولیه و نهایی، سؤال‌های حذف‌شده و سؤال‌های محل بحث.`,
      quick_answer: "پاسخ تشریحی سؤال‌های کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ برای همهٔ درس‌هایی که در ۱۴۰۶ مانده‌اند (زبان، آمار، گسسته، نظریه، داده‌ساختار و الگوریتم، هوش، مدار منطقی، معماری و سیستم عامل) در صفحه‌های همین مجموعه آمده است. در ۱۴۰۵ کلید نهایی هیچ پاسخی را عوض نکرد و فقط سؤال‌های ۶۵، ۸۲، ۱۰۲ و ۱۰۵ را حذف کرد.",
      content_blocks: blocks,
      seo: { title: "پاسخ تشریحی کنکور ارشد کامپیوتر ۱۴۰۵", description: "حل تشریحی سؤال‌های کنکور ارشد مهندسی کامپیوتر ۱۴۰۵ درس به درس، با کلید اولیه و نهایی و توضیح سؤال‌های حذف‌شده و محل بحث." },
      sources: SOURCES("صورت، گزینه‌ها و کلید سؤال‌ها"),
      ...meta(slug, ["کلید نهایی"], Object.values(SUBJECTS).map((s) => s.code)),
    },
    files: {},
  };
}
