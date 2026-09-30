// Builds one "coefficient code N of the master's computer engineering exam"
// data article from analysis/code_stats.json (aggregates of report cards, set
// 1277, 1400-1405; groups >= 10, category counts and medians >= 5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/code_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const two = (v) => fa(v.toFixed(2));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"];
const UNI = { "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت", "شهید بهشتی": "شهید بهشتی", "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد", "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان", "الزهرا": "الزهرا", "تبریز": "دانشگاه تبریز", "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز", "آزاد علوم و تحقیقات": "آزاد علوم و تحقیقات", "امیرکبیر (واحد گرمسار)": "امیرکبیر (واحد گرمسار)" };
const uni = (u) => UNI[u] || u;
const BL = (b) => b.split("-").map(int).join(" تا ");

export function codeArticle({ code, slug, label, short, intro, note, lessons = [], faq = [] }) {
  const d = STATS[code];
  const W = d.weights, sumW = W.reduce((a, b) => a + b, 0);
  const share = (100 * d.nBest) / d.nTop;
  const blocks = [];
  const progs = Object.entries(d.admProg).sort((a, b) => a[1][1] - b[1][1]);
  const unis = Object.entries(d.admUni).sort((a, b) => a[1][1] - b[1][1]);

  blocks.push(text(intro));
  blocks.push(text(
    `داده: ${int(d.nTop)} کارنامهٔ سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) از ۱۴۰۰ تا ۱۴۰۵ که بهترین رتبه‌شان ۳۰۰۰ یا بهتر است، و ${int(d.admTotal)} کارنامهٔ قبولی روزانه. «بهترین کد» هر کارنامه کدی است که در آن رتبه‌اش از همه بهتر بود (در صورت تساوی، کد با شمارهٔ کمتر). فقط آمار تجمیعی می‌آید؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند و شمارش‌ها و میانه‌های دانشگاه و گرایش دست‌کم ۵.`,
  ));

  blocks.push(h2(`وزن هر درس در ${short}`));
  blocks.push(text(`در ۱۴۰۰ تا ۱۴۰۵، میانگین وزنی این کد جمع ضرب درصدها در این وزن‌هاست تقسیم بر ${int(sumW)}:`));
  blocks.push({ type: "table", headers: ["درس", "ضریب", "سهم از میانگین وزنی"], rows: NAMES.map((n, i) => [n, int(W[i]), pct((100 * W[i]) / sumW)]) });
  blocks.push(text("در جدول رسمی ۱۴۰۶ این چهار کد وجود ندارد؛ مجموعهٔ ۱۲۷۷ یک ترکیب دارد: زبان ۱، ریاضیات ۲ و بستهٔ تخصصی ۴. این مطلب برای فهم سال‌های قبل و کارنامه‌های آن سال‌هاست."));

  blocks.push(h2("چه کارنامه‌هایی این کد را بهترین می‌کنند؟"));
  blocks.push(text(`برای ${int(d.nBest)} از ${int(d.nTop)} کارنامه (${pct(share)}) بهترین رتبه در ${short} بود. سهم این کد در هر گروه رتبه:`));
  blocks.push({
    type: "table",
    headers: ["گروه رتبه", "کارنامه‌هایی که بهترین رتبه‌شان در این کد است", "کل کارنامه‌ها", "سهم"],
    rows: Object.entries(d.bandShare).map(([b, [n, t]]) => [BL(b), int(n), int(t), pct((100 * n) / t)]),
  });
  if (d.box) {
    blocks.push(text(`و میانهٔ درصد این کارنامه‌ها در برابر بقیه (کارنامه‌هایی که بهترین کدشان چیز دیگری است):`));
    blocks.push({ type: "table", headers: ["درس", "بهترین کد همین است", "بقیه"], rows: NAMES.map((n, i) => [n, pct(d.box[i][1]), pct(d.boxOthers[i])]) });
  }
  blocks.push(text(note));

  if (d.byYear) {
    blocks.push(h2(`سهم ${short} در هر سال`));
    blocks.push({ type: "table", headers: ["سال", "کارنامه‌هایی که بهترین رتبه‌شان در این کد است", "کل کارنامه‌ها", "سهم"], rows: Object.entries(d.byYear).map(([y, [n, t]]) => [fa(y), int(n), int(t), pct((100 * n) / t)]) });
  }
  const bc = Object.entries(d.bandCard || {});
  if (bc.length) {
    blocks.push(h2(`کارنامهٔ کسانی که ${short} بهترین کدشان بود`));
    blocks.push(text("میانهٔ درصد هر درس در کارنامه‌هایی که بهترین رتبه‌شان در این کد بود، به تفکیک گروه رتبه (دست‌کم ۱۰ کارنامه):"));
    blocks.push({ type: "table", headers: ["گروه رتبه", "تعداد", ...NAMES], rows: bc.map(([b, [n, ...p]]) => [BL(b), int(n), ...p.map(pct)]) });
  }
  const pc = Object.entries(d.progCard || {}).sort((a, b) => b[1][0] - a[1][0]);
  if (pc.length) {
    blocks.push(text(`و قبول‌شده‌هایی که با این کد قبول شدند، به تفکیک گرایش (دست‌کم ۱۰ کارنامه):`));
    blocks.push({ type: "table", headers: ["گرایش", "تعداد", "میانگین چهار تخصصی", "ریاضی", "زبان"], rows: pc.map(([p, [n, sp, m, l]]) => [p, int(n), pct(sp), pct(m), pct(l)]) });
  }
  if (lessons.length) { blocks.push(h2(`${short} به درد چه کسی می‌خورد؟`)); for (const p of lessons) blocks.push(text(p)); }

  blocks.push(h2("اگر این کد بهترین کدت نباشد"));
  blocks.push(text(
    `رتبهٔ این کد نسبت به بهترین رتبهٔ همان کارنامه: میانه ${two(d.ratio[1])} برابر (نیمهٔ وسط ${two(d.ratio[0])} تا ${two(d.ratio[2])}). در رتبه‌های زیر ۱۰۰ میانه ${two(d.ratioTop100[1])} برابر است (نیمهٔ وسط ${two(d.ratioTop100[0])} تا ${two(d.ratioTop100[2])}). یعنی مثلاً اگر بهترین رتبه‌ات ۱۰۰ باشد، در این کد معمولاً حدود ${int(100 * d.ratioTop100[1])} می‌شود.`,
  ));

  blocks.push(h2("میانگین وزنی لازم برای رتبه‌های ۱۰۰، ۳۰۰ و ۱۰۰۰"));
  blocks.push(text("از مدل ابزار تخمین رتبه، با معدل ۱۷٫۵. «—» یعنی آن رتبه در دامنهٔ کارنامه‌های آن سال نیست."));
  const yrs = ["1400", "1401", "1402", "1403", "1404", "1405"];
  blocks.push({
    type: "table",
    headers: ["رتبه", ...yrs.map(fa)],
    rows: Object.entries(d.need).map(([r, ys]) => [int(r), ...yrs.map((y) => (ys[y] == null ? "—" : pct(ys[y])))]),
  });

  blocks.push(h2("این کد به کدام گرایش‌ها می‌رسد؟"));
  blocks.push(text(`از ${int(d.admTotal)} قبولی روزانهٔ سهمیهٔ آزاد، ${int(d.admN)} تا (${pct((100 * d.admN) / d.admTotal)}) با این کد بود. گرایش‌ها و دانشگاه‌ها (فقط دست‌کم ۵ کارنامه):`));
  blocks.push({ type: "table", headers: ["گرایش", "تعداد کارنامهٔ قبولی", "میانهٔ رتبهٔ قبولی"], rows: progs.map(([p, [n, m]]) => [p, int(n), int(m)]) });
  blocks.push({ type: "table", headers: ["دانشگاه", "تعداد کارنامهٔ قبولی", "میانهٔ رتبهٔ قبولی"], rows: unis.map(([u, [n, m]]) => [uni(u), int(n), int(m)]) });
  blocks.push(text("رتبه‌ها در همین کد و برای همان گرایش‌اند، پس بین دانشگاه‌ها قابل مقایسه‌اند ولی بین کدها نه."));

  blocks.push(h2("پرسش‌های پرتکرار"));
  for (const [q, a] of faq) { blocks.push(h3(q)); blocks.push(text(a)); }
  blocks.push(h3(`ضریب ${int(code)} ارشد کامپیوتر برای کدام گرایش‌هاست؟`));
  blocks.push(text(`برای ${progs.map(([p]) => p).join("، ")}. ${int(d.admN)} قبولی روزانهٔ سهمیهٔ آزاد در داده با این کد بود.`));
  blocks.push(h3(`وزن درس‌ها در کد ${int(code)} چه بود؟`));
  blocks.push(text(`زبان ${int(W[0])}، ریاضی ${int(W[1])}، نظریه و سیگنال ${int(W[2])}، داده‌ساختار، الگوریتم و هوش ${int(W[3])}، منطقی و معماری ${int(W[4])}، سیستم عامل، شبکه و پایگاه داده ${int(W[5])}؛ جمع ${int(sumW)}.`));
  blocks.push(h3("چند درصد کارنامه‌ها بهترین رتبه‌شان در این کد بود؟"));
  blocks.push(text(`${pct(share)} (${int(d.nBest)} از ${int(d.nTop)}). در رتبه‌های ۱ تا ۱۰۰ سهم آن ${pct((100 * d.bandShare["1-100"][0]) / d.bandShare["1-100"][1])} بود.`));
  blocks.push(h3(`برای رتبهٔ ۱۰۰ در کد ${int(code)} چه میانگین وزنی لازم بود؟`));
  blocks.push(text(`در ۱۴۰۴ حدود ${pct(d.need["100"]["1404"])} و در ۱۴۰۳ حدود ${pct(d.need["100"]["1403"])}؛ با معدل ۱۷٫۵ و از مدل ابزار تخمین رتبه.`));
  blocks.push(h3("اگر کد من بهترین نباشد چقدر رتبه بدتر می‌شود؟"));
  blocks.push(text(`میانهٔ نسبت رتبه در این کد به بهترین رتبه ${two(d.ratio[1])} است؛ در رتبه‌های زیر ۱۰۰ ${two(d.ratioTop100[1])}.`));
  blocks.push(h3("در ۱۴۰۶ این کد چه می‌شود؟"));
  blocks.push(text("در جدول رسمی ۱۴۰۶ مجموعهٔ ۱۲۷۷ فقط یک ترکیب ضریب دارد و این چهار کد نیستند. رتبهٔ گرایش‌ها از روی همان ترکیب حساب می‌شود."));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("درصدهای آزمون‌هایت را در ابزار تخمین رتبه بزن تا رتبهٔ هر چهار کد را کنار هم ببینی. برای انتخاب گرایش بر اساس درصدهای خودت هم در مشاوره کنارت هستیم."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "کد ضریب ارشد کامپیوتر: کدام بهتر است؟", href: "/articles/coefficient-codes-explained" },
      { label: "گرایش‌های ارشد کامپیوتر", href: "/articles/master-computer-orientations" },
      { label: "رتبهٔ قبولی به تفکیک دانشگاه", href: "/articles/admitted-ranks-by-university" },
      { label: "تعداد تست و ضریب دروس", href: "/articles/questions-and-coefficients" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const answer = `کد ضریب ${int(code)} ارشد مهندسی کامپیوتر (${label}) در ۱۴۰۰ تا ۱۴۰۵ وزن‌های ${W.map(int).join("، ")} (به ترتیب زبان تا سیستم عامل و شبکه و پایگاه داده، جمع ${int(sumW)}) داشت. برای ${pct(share)} کارنامه‌ها بهترین رتبه در این کد بود. ${int(d.admN)} قبولی روزانه با آن ثبت شد؛ رتبهٔ ۱۰۰ در ۱۴۰۴ حدود ${pct(d.need["100"]["1404"])} میانگین وزنی می‌خواست.`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `کد ضریب ${int(code)} ارشد کامپیوتر (${label}): وزن دروس، رتبه و گرایش‌ها`,
    slug,
    summary: `وزن هر درس، کارنامه‌هایی که این کد بهترینشان است، میانگین وزنی لازم برای هر رتبه و گرایش‌ها و دانشگاه‌های این کد در ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۵.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: ["کد ضریب", "کارنامه و رتبه", "تحلیل داده"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `کد ضریب ${int(code)} ارشد کامپیوتر: وزن دروس و رتبه`,
      description: `کد ضریب ${int(code)} ارشد مهندسی کامپیوتر (${label}): وزن هر درس، کدام کارنامه‌ها با آن بهتر می‌شوند، میانگین وزنی هر رتبه و گرایش‌ها؛ ۱۴۰۰ تا ۱۴۰۵.`,
    },
    validity: { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: "کارنامه‌های ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۵ کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی",
        claim: `وزن‌ها، سهم کارنامه‌ها و قبولی‌ها در کد ضریب ${int(code)}`,
        order: 0,
      },
    ],
    editorial: { author_slug: "mohammad-rostami" },
    provenance: {
      producer_type: "external_ai",
      producer_name: "تحلیل داده با Claude روی پایگاه کارنامه‌های محمد رستمی؛ فقط آمار تجمیعی — نیازمند بازبینی و تأیید محمد رستمی",
      source_artifact: `content/import-packages/articles/${slug}.mjs`,
    },
    review_status: "draft",
  };
}
