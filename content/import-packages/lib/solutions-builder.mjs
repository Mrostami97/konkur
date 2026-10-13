// Builds one year's «worked solutions of the computer-engineering master's
// exam» family: one full article with every solved question (the hub) and one
// article per subject still in the 1406 exam. Each year supplies its data
// (lib/solutions-YYYY-data.mjs) and its own sentences (lib/solutions-YYYY.mjs).
// Questions that need their figure carry the booklet crop as an asset; image
// files stay in the owner's bank folder and are added to the import zip by
// bundle.mjs (via packages/<slug>/assets.json).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const BANK = process.env.KONKUR_BANK_ROOT ?? "C:/Users/Error/Documents/Codex/2026-10-03/new-chat";
const CROPS = path.join(BANK, "outputs/content_review/source_crops");
const ALL_KEYS = JSON.parse(readFileSync(new URL("../analysis/keys.json", import.meta.url), "utf8")).ce;
const FA = "۰۱۲۳۴۵۶۷۸۹";
export const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const heading = (level, t) => ({ type: "heading", level, text: t });
const h2 = (t) => heading(2, t);
const h3 = (t) => heading(3, t);

/** The booklet's sections in order (the same in 1404 and 1405), for the whole key at a glance. */
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

export function fileAsset(mediaKey, file) {
  const checksum = createHash("sha256").update(readFileSync(file)).digest("hex");
  const ext = path.extname(file).slice(1);
  return { asset: { media_key: mediaKey, filename: `${mediaKey}.${ext}`, mime_type: ext === "png" ? "image/png" : "image/jpeg", checksum: `sha256:${checksum}` }, file };
}

const in1406 = (key) =>
  key === "english" ? "بله، با ضریب ۱ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶."
    : ["statistics", "discrete"].includes(key) ? "بله، در بستهٔ ریاضیات با ضریب ۲ در مجموعه‌های ۱۲۷۷ و ۱۲۷۶."
      : ["dsa", "ai", "os"].includes(key) ? "بله، در بستهٔ تخصصی با ضریب ۴ در هر دو مجموعهٔ ۱۲۷۷ و ۱۲۷۶."
        : "بله، در بستهٔ تخصصی مجموعهٔ ۱۲۷۷ با ضریب ۴.";

/**
 * cfg: { year, data: {QUESTIONS, SUBJECTS, PASSAGES, BOOKLET, DROPPED, DOC},
 *   keySheets(): [{ mediaKey, file, alt, caption }], text: {...year's sentences} }
 */
export function makeSolutions(cfg) {
  const { year, data, text: T } = cfg;
  const { QUESTIONS, SUBJECTS, PASSAGES, BOOKLET, DROPPED, DOC } = data;
  const Y = fa(year);
  const KEYS = ALL_KEYS[year];
  const HUB = `konkur-${year}-computer-engineering-solutions`;
  const slugOf = (key) => `konkur-${year}-${SUBJECTS[key].slug}-solutions`;
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

  /** The booklet crop of question n as an article asset (and its file for the zip). */
  function cropAsset(n) {
    const prefix = `${DOC}-q-${String(n).padStart(4, "0")}-question-`;
    const file = readdirSync(CROPS).find((f) => f.startsWith(prefix));
    if (!file) throw new Error(`no crop for q${n}`);
    return fileAsset(`konkur${year}-q${String(n).padStart(3, "0")}`, path.join(CROPS, file));
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
      blocks.push({ type: "image", media_key: asset.media_key, alt: `سؤال ${fa(q.n)} کنکور ارشد مهندسی کامپیوتر ${Y} در دفترچه`, caption: `سؤال ${fa(q.n)} در دفترچهٔ ${BOOKLET}` });
    }
    blocks.push(text(q.options.map((o, i) => `${fa(i + 1)}) ${o}`).join("\n")));
    blocks.push(text(answerLine(q)));
    blocks.push(text(q.solution));
    return blocks;
  }

  const SOURCES = (claim) => [
    { source_external_id: "editorial-source-bd8f7cb1262dd65dec24", relation: "SUPPORTS", locator: `دفترچهٔ سؤال و کلید کنکور کارشناسی ارشد مهندسی کامپیوتر (۱۲۷۷) ${Y}، دفترچهٔ ${BOOKLET}`, claim, order: 0 },
    { source_external_id: "editorial-source-08110ffe99548a591190", relation: "SUPPORTS", locator: "بانک سؤال کنکور کامپیوتر؛ متن هر سؤال با تصویر دفترچه مقایسه شده است", claim: T.sourceKeyClaim, order: 1 },
  ];

  const meta = (slug, tags, subjectCodes) => ({
    taxonomy: { major: ["کامپیوتر و IT"], tags: [...tags, "پاسخ تشریحی", `کنکور ${Y}`, "حل تست"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: subjectCodes, topic_codes: [] },
    validity: { exam_year: 1406, time_sensitive: false, source_checked_at: T.checkedAt },
    editorial: { author_slug: "mohammad-rostami" },
    provenance: {
      producer_type: "external_ai",
      producer_name: "حل تشریحی با Claude؛ متن هر سؤال با تصویر دفترچه مقایسه و هر پاسخ مستقل حل شده است — نیازمند بازبینی و تأیید محمد رستمی",
      source_artifact: `content/import-packages/articles/${slug}.mjs`,
    },
    review_status: "draft",
  });

  function subjectArticle(key) {
    const subject = SUBJECTS[key];
    const slug = slugOf(key);
    const qs = QUESTIONS.filter((q) => q.subject === key);
    const out = { assets: [], files: {} };
    const blocks = [];
    const deleted = qs.filter((q) => q.deleted);
    const multi = qs.filter((q) => q.accepted);
    const disputed = qs.filter((q) => q.disputed);
    blocks.push(text(T.subjectIntro(subject, qs)));
    const notes = [];
    if (deleted.length) notes.push(`سؤال ${deleted.map((q) => fa(q.n)).join(" و ")} در کلید نهایی حذف شد و علتش در حل آمده است`);
    if (multi.length) notes.push(`سؤال ${multi.map((q) => fa(q.n)).join(" و ")} دوکلیدی شد و هر دو برداشت را توضیح داده‌ایم`);
    if (disputed.length) notes.push(`در سؤال ${disputed.map((q) => fa(q.n)).join(" و ")} کلید سنجش با برداشت کتاب مرجع نمی‌خواند و هر دو را توضیح داده‌ایم`);
    if (notes.length) blocks.push(text(`${notes.join("؛ ")}.`));
    blocks.push(h2(`کلید ${subject.title} در یک نگاه`));
    blocks.push(keyBlock(SECTIONS.filter(([k]) => k === key), "روی هر خانه، گزینهٔ درست پر شده است؛ حل هر سؤال پایین‌تر آمده."));
    for (const q of qs) blocks.push(...questionBlocks(q, 2, out));
    blocks.push(h2("پرسش‌های رایج"));
    blocks.push(h3(`کنکور ارشد کامپیوتر ${Y} چند سؤال ${subject.title} داشت؟`));
    blocks.push(text(`${fa(qs.length)} سؤال، شمارهٔ ${subject.range} در دفترچهٔ ۱۲۷۷.${deleted.length ? ` ${fa(deleted.length)} سؤال در کلید نهایی حذف شد.` : ""}`));
    blocks.push(h3(`${subject.title} در کنکور ۱۴۰۶ هست؟`));
    blocks.push(text(in1406(key)));
    blocks.push({
      type: "link_group",
      items: [
        { label: `حل تشریحی همهٔ سؤال‌های ${Y} در یک صفحه`, href: `/articles/${HUB}` },
        { label: `صفحهٔ درس ${subject.title}`, href: `/subjects/${subject.code}` },
        { label: "کلید کنکور ارشد کامپیوتر ۱۴۰۰ تا ۱۴۰۵", href: "/articles/master-computer-answer-keys" },
        { label: "شبیه‌ساز کنکورهای سال‌های قبل", href: "/exams" },
        { label: "درس‌نامه‌ها", href: "/lesson-notes" },
        ...(T.subjectLinks ?? []),
      ],
    });
    return {
      article: {
        schema_version: "article.v2",
        external_id: `kunkurcomputer-solutions-${slug}`,
        content_type: "article",
        title: `پاسخ تشریحی ${subject.title} کنکور ارشد مهندسی کامپیوتر ${Y}`,
        slug,
        summary: T.subjectSummary(subject, qs),
        quick_answer: `کنکور ارشد مهندسی کامپیوتر ${Y} ${fa(qs.length)} سؤال ${subject.title} داشت (سؤال‌های ${subject.range}). کلید: ${qs.map((q) => `${fa(q.n)}: ${q.deleted ? "حذف" : q.accepted ? q.accepted.map(fa).join(" و ") : fa(q.answer)}`).join("، ")}. حل هر سؤال در این صفحه آمده است.`,
        content_blocks: blocks,
        seo: { title: `پاسخ تشریحی ${subject.title} کنکور ارشد کامپیوتر ${Y}`, description: T.subjectSeoDescription(subject) },
        sources: SOURCES(`صورت، گزینه‌ها و کلید سؤال‌های ${subject.title}`),
        ...(out.assets.length ? { assets: out.assets } : {}),
        ...meta(slug, [subject.title], [subject.code]),
      },
      files: out.files,
    };
  }

  /** The key sheets as article assets. */
  function keySheetBlocks(out) {
    return cfg.keySheets().map(({ mediaKey, file, alt, caption }) => {
      const { asset } = fileAsset(mediaKey, file);
      out.assets.push(asset);
      out.files[asset.filename] = file;
      return { type: "image", media_key: asset.media_key, alt, caption };
    });
  }

  function hubArticle() {
    const slug = HUB;
    const out = { assets: [], files: {} };
    const blocks = [];
    const covered = QUESTIONS;
    for (const t of T.hubIntro(covered.length, Object.keys(SUBJECTS).length)) blocks.push(text(t));
    blocks.push({ type: "link_group", items: Object.keys(SUBJECTS).map((key) => ({ label: `فقط ${SUBJECTS[key].title}`, href: `/articles/${slugOf(key)}` })) });

    blocks.push(h2(`کلید ${Y} در یک نگاه`));
    blocks.push(text("هر خانه یک سؤال است و گزینهٔ درستش پر شده؛ درست مثل پاسخ‌برگ خودت. کلید هر ۱۱۵ سؤال آمده، حتی درس‌هایی که از ۱۴۰۶ کنار رفته‌اند."));
    blocks.push(keyBlock(SECTIONS, `گزینه‌ها مطابق دفترچهٔ ${BOOKLET}.`));

    if (T.finalChanges) {
      blocks.push(h2("کلید نهایی چه چیزی را عوض کرد؟"));
      blocks.push(text(T.finalChanges));
    }
    blocks.push(h2(T.keySheetsTitle));
    blocks.push(...keySheetBlocks(out));

    for (const [key, from, to] of SECTIONS.filter(([k]) => k)) {
      const subject = SUBJECTS[key];
      const qs = covered.filter((q) => q.subject === key);
      blocks.push(h2(`${subject.title}: سؤال‌های ${fa(from)} تا ${fa(to)}`));
      for (const q of qs) blocks.push(...questionBlocks(q, 3, out));
    }

    blocks.push(h2("سؤال‌هایی که با دقت بیشتری باید خواند"));
    blocks.push(text(T.careful.join("\n")));
    blocks.push(h2("درس‌هایی که در ۱۴۰۶ نیستند"));
    blocks.push(text(`${DROPPED.map(([t, r]) => `${t} (${r})`).join("، ")} از مواد امتحانی ۱۴۰۶ مجموعهٔ ۱۲۷۷ کنار رفته‌اند؛ برای همین حلشان را نیاورده‌ایم و فقط کلیدشان در جدول بالا هست.`));

    blocks.push(h2("پرسش‌های رایج"));
    for (const [q, a] of T.faq) {
      blocks.push(h3(q));
      blocks.push(text(a));
    }
    blocks.push({ type: "link_group", items: T.hubLinks });
    return {
      article: {
        schema_version: "article.v2",
        external_id: `kunkurcomputer-solutions-${slug}`,
        content_type: "article",
        title: `حل تشریحی سؤالات کنکور ارشد مهندسی کامپیوتر ${Y}`,
        slug,
        summary: T.hubSummary(covered.length),
        quick_answer: T.hubQuickAnswer,
        content_blocks: blocks,
        seo: { title: `حل تشریحی سؤالات کنکور ارشد کامپیوتر ${Y}`, description: T.hubSeoDescription },
        sources: SOURCES("صورت، گزینه‌ها و کلید سؤال‌ها"),
        assets: out.assets,
        ...meta(slug, [T.hubTag], Object.values(SUBJECTS).map((s) => s.code)),
      },
      files: out.files,
    };
  }

  return { HUB, slugOf, subjectArticle, hubArticle, keySheetBlocks };
}
