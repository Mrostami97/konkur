// Builds one "orientation X of master's computer engineering: admitted ranks by
// university" data article from analysis/program_stats.json (aggregates of the
// public result banks: free quota, daytime, groups >= 10, medians of >= 5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/program_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const dec = (v) => fa(v.toFixed(1));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const UNI = {
  "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت", "شهید بهشتی": "شهید بهشتی",
  "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد", "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان",
  "الزهرا": "الزهرا", "تبریز": "دانشگاه تبریز", "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز",
  "آزاد علوم و تحقیقات": "آزاد علوم و تحقیقات", "امیرکبیر (واحد گرمسار)": "امیرکبیر (واحد گرمسار)",
};
const uni = (u) => UNI[u] || u;
const CODE = { 1: "شبکه و امنیت", 2: "هوش مصنوعی", 3: "معماری", 4: "نرم‌افزار و بقیه" };
const ALL = Object.entries(STATS).sort((a, b) => a[1].rank[1] - b[1].rank[1]);

export function programArticle({ key, slug, name, tag, intro, note, lessons = [], faq = [] }) {
  const d = STATS[key];
  if (!d) throw new Error(`no stats for ${key}`);
  const [q1, med, q3] = d.rank;
  const unis = Object.entries(d.unis).sort((a, b) => a[1][1] - b[1][1]);
  const yrs = Object.entries(d.years);
  const g = d.gpa;
  const names = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"];
  const blocks = [];

  blocks.push(text(intro));
  blocks.push(text(
    `داده: ${int(d.n)} کارنامهٔ قبولی روزانهٔ سهمیهٔ آزاد در گرایش ${name}، ۱۴۰۰ تا ۱۴۰۴، در ${int(d.nUnis)} دانشگاه؛ کارنامه‌های منتشرشدهٔ قبول‌شده‌ها در بانک‌های عمومی و کارنامه‌های شاگردهای کلاس، هر کدام یک بار. رتبه، رتبهٔ داخل سهمیه در کد ضریب گرایش است (${CODE[d.code]}). فقط آمار تجمیعی می‌آید؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند و میانهٔ گروه‌های ۵ تا ۹ کارنامه‌ای با ذکر تعداد آمده. همهٔ قبول‌شده‌ها کارنامه‌شان را منتشر نمی‌کنند، پس این‌ها مرز قطعی قبولی نیستند.`,
  ));

  blocks.push(h2(`رتبهٔ قبولی ${name} در هر دانشگاه`));
  blocks.push({
    type: "table",
    headers: ["دانشگاه", "تعداد کارنامه", "میانهٔ رتبهٔ قبولی"],
    rows: unis.map(([u, [n, m]]) => [uni(u), int(n), int(m)]).concat([["همهٔ دانشگاه‌ها", int(d.n), int(med)]]),
  });
  const first = unis[0], last = unis[unis.length - 1];
  blocks.push(text(
    `${uni(first[0])} با میانهٔ ${int(first[1][1])} رقابتی‌ترین و ${uni(last[0])} با ${int(last[1][1])} آسان‌ترین دانشگاه دارای دست‌کم ۵ کارنامه در این گرایش است. میانهٔ همهٔ ${int(d.n)} کارنامه ${int(med)} و نیمهٔ وسطشان بین ${int(q1)} و ${int(q3)} است؛ چون ترکیب دانشگاه‌ها در هر سال عوض می‌شود، این عدد کلی فقط یک خلاصهٔ کلی است و رتبهٔ دانشگاه مقصدت مهم‌تر است.`,
  ));

  if (yrs.length >= 2) {
    blocks.push(h2("رتبهٔ قبولی در سال‌های مختلف"));
    blocks.push({ type: "table", headers: ["سال", "تعداد کارنامه", "میانهٔ رتبهٔ قبولی"], rows: yrs.map(([y, [n, m]]) => [fa(y), int(n), int(m)]) });
    blocks.push(text("میانهٔ هر سال هم به سختی آن سال بستگی دارد و هم به اینکه کارنامهٔ کدام دانشگاه‌ها منتشر شده؛ روند را با احتیاط بخوان. سال‌هایی که در جدول نیامده کمتر از ۵ کارنامه دارند."));
  }

  blocks.push(h2("کارنامهٔ معمول قبول‌شده‌ها"));
  blocks.push(text("میانهٔ درصد قبول‌شده‌های این گرایش در هر درس. «میانگین چهار تخصصی» میانهٔ میانگین ساده‌ی چهار دسته‌درس تخصصی هر کارنامه است."));
  blocks.push({ type: "table", headers: ["درس", "میانهٔ درصد"], rows: names.map((n, i) => [n, pct(d.pct[i])]).concat([["میانگین چهار تخصصی", pct(d.spec)]]) });
  const needs = ["1403", "1404", "1405"].map((y) => [y, d.need[y]]).filter(([, v]) => v != null);
  blocks.push(text(
    `${pct(100 * d.zeroMath)} قبول‌شده‌ها ریاضی صفر یا منفی داشتند و ${pct(100 * d.zeroLang)} زبان صفر یا منفی. میانهٔ معدل ${dec(g.med)} بود؛ ${pct(100 * g.lt16)} معدل زیر ۱۶ و ${pct(100 * g.ge19)} معدل ۱۹ یا بیشتر داشتند. ` +
      (needs.length
        ? `طبق مدل ابزار تخمین رتبه، برای رسیدن به رتبهٔ میانهٔ این گرایش (${int(med)}) با معدل ۱۷٫۵ در کد ${CODE[d.code]} میانگین وزنی ${needs.map(([y, v]) => `حدود ${pct(v)} در ${fa(y)}`).join("، ")} لازم بود. ` : "") +
      note,
  ));

  const uc = Object.entries(d.uniCard || {}).sort((a, b) => b[1][1] - a[1][1]);
  if (uc.length > 1) {
    blocks.push(h2(`کارنامهٔ قبول‌شده‌های ${name} در هر دانشگاه`));
    blocks.push(text("میانهٔ میانگین چهار تخصصی، ریاضی و زبان قبول‌شده‌های این گرایش در هر دانشگاه (دست‌کم ۵ کارنامه). این جدول نشان می‌دهد برای هر دانشگاه تقریباً چه کارنامه‌ای لازم بوده:"));
    blocks.push({ type: "table", headers: ["دانشگاه", "تعداد", "میانگین چهار تخصصی", "ریاضی", "زبان"], rows: uc.map(([u, [n, sp, m, l]]) => [uni(u), int(n), pct(sp), pct(m), pct(l)]) });
  }
  if (d.buckets) {
    const B = ["۱ تا ۱۰۰", "۱۰۱ تا ۳۰۰", "۳۰۱ تا ۶۰۰", "بدتر از ۶۰۰"];
    const few = (n) => (n === 0 ? "۰" : n < 5 ? "کمتر از ۵" : int(n));
    blocks.push(h2(`قبول‌شده‌های ${name} چه رتبه‌هایی داشتند؟`));
    blocks.push({ type: "table", headers: ["بازهٔ رتبه", "تعداد کارنامهٔ قبولی"], rows: B.map((b, i) => [b, few(d.buckets[i])]) });
    blocks.push(text(`نیمهٔ وسط قبول‌شده‌ها میانگین چهار تخصصی ${int(d.specQ[0])} تا ${int(d.specQ[1])}٪ داشتند. شمارش‌های کمتر از ۵ را دقیق نمی‌آوریم.`));
  }
  const extra = [];
  if (d.night) extra.push(`در دورهٔ شبانه ${int(d.night[0])} کارنامهٔ قبولی این گرایش داریم با میانهٔ رتبهٔ ${int(d.night[1])}.`);
  if (d.q5) extra.push(`در سهمیهٔ ۵٪ ${int(d.q5[0])} کارنامهٔ قبولی روزانه داریم با میانهٔ رتبهٔ داخل سهمیه ${int(d.q5[1])}؛ رتبهٔ سهمیه با رتبهٔ آزاد قابل مقایسه نیست.`);
  if (d.w1406) extra.push(`اگر قبول‌شده‌های روزانهٔ ۱۴۰۳ و ۱۴۰۴ این گرایش (${int(d.w1406[0])} کارنامه) با فرمول رسمی ۱۴۰۶، یعنی (زبان + ۲ × ریاضی + ۴ × تخصصی) ÷ ۷ و بدون معدل، حساب شوند، میانهٔ میانگین وزنی‌شان ${pct(d.w1406[1])} است. این مرز قبولی ۱۴۰۶ نیست، فقط جای قبول‌شده‌های اخیر را با فرمول جدید نشان می‌دهد.`);
  if (extra.length) { blocks.push(h2("شبانه، سهمیهٔ ۵٪ و ضرایب ۱۴۰۶")); blocks.push(text(extra.join(" "))); }
  if (lessons.length) { blocks.push(h2(`اگر ${name} می‌خواهی`)); for (const p of lessons) blocks.push(text(p)); }

  blocks.push(h2(`${name} در برابر گرایش‌های دیگر`));
  blocks.push({
    type: "table",
    headers: ["گرایش", "تعداد کارنامه", "سهم از قبولی‌ها", "میانهٔ رتبه", "نیمهٔ وسط"],
    rows: ALL.map(([p, s]) => [p, int(s.n), pct(100 * s.share), int(s.rank[1]), `${int(s.rank[0])} تا ${int(s.rank[2])}`]),
  });
  blocks.push(text("فقط گرایش‌هایی که دست‌کم ۲۰ کارنامهٔ قبولی روزانه دارند در جدول آمده‌اند. رتبه‌ها در کد ضریب همان گرایش‌اند و مستقیم با هم قابل مقایسه نیستند؛ جدول فقط اندازهٔ رقابت را نشان می‌دهد."));

  blocks.push(h2("پرسش‌های پرتکرار"));
  for (const [q, a] of faq) { blocks.push(h3(q)); blocks.push(text(a)); }
  blocks.push(h3(`رتبهٔ قبولی ارشد ${name} چند است؟`));
  blocks.push(text(`میانهٔ رتبهٔ قبولی روزانهٔ سهمیهٔ آزاد ${int(med)} بود (${int(d.n)} کارنامه، ${int(d.nUnis)} دانشگاه) و نیمهٔ وسط قبول‌شده‌ها رتبه‌ای بین ${int(q1)} و ${int(q3)} داشتند.`));
  blocks.push(h3(`کدام دانشگاه ${name} را آسان‌تر می‌دهد؟`));
  blocks.push(text(`در این داده ${uni(last[0])} با میانهٔ ${int(last[1][1])} (${int(last[1][0])} کارنامه) آسان‌ترین دانشگاه دارای دست‌کم ۵ کارنامه است و ${uni(first[0])} با ${int(first[1][1])} رقابتی‌ترین. دانشگاه‌های با کمتر از ۵ کارنامه در جدول نیامده‌اند.`));
  blocks.push(h3(`قبول‌شده‌های ${name} چه معدلی دارند؟`));
  blocks.push(text(`میانهٔ معدل ${dec(g.med)} بود (نیمهٔ وسط ${dec(g.q[0])} تا ${dec(g.q[2])})؛ ${pct(100 * g.lt16)} معدل زیر ۱۶ داشتند.`));
  blocks.push(h3(`با ریاضی صفر می‌شود ${name} قبول شد؟`));
  blocks.push(text(`در این داده ${pct(100 * d.zeroMath)} قبول‌شده‌ها ریاضی را صفر یا منفی زده بودند. از ۱۴۰۶ سهم ریاضی در میانگین وزنی حدود دو برابر می‌شود، پس این عدد را نباید مستقیم به آزمون بعدی تعمیم داد.`));
  blocks.push(h3(`${name} چند درصد از قبولی‌ها را دارد؟`));
  blocks.push(text(`${pct(100 * d.share)} از ${int(d.total)} کارنامهٔ قبولی روزانهٔ سهمیهٔ آزاد؛ این سهم از کارنامه‌های منتشرشده می‌آید و همهٔ ظرفیت واقعی را نشان نمی‌دهد.`));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(d.n)} کارنامه. ${Object.entries(d.yearsN).filter(([, n]) => n).map(([y, n]) => `${fa(y)}: ${int(n)}`).join("، ")}. کارنامهٔ ۱۴۰۵ هنوز به نتیجهٔ قبولی وصل نشده و در این آمار نیست.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("درصدهای آزمون‌هایت را در ابزار تخمین رتبه بزن و رتبه‌ات را با جدول‌های بالا مقایسه کن. برای انتخاب گرایش و دانشگاه بر اساس درصدهای خودت هم در مشاوره کنارت هستیم."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "رتبهٔ قبولی ارشد کامپیوتر به تفکیک دانشگاه", href: "/articles/admitted-ranks-by-university" },
      { label: "گرایش‌های ارشد کامپیوتر", href: "/articles/master-computer-orientations" },
      { label: "کدام کد ضریب بهتر است؟", href: "/articles/coefficient-codes-explained" },
      { label: "میانگین وزنی لازم برای قبولی هر دانشگاه", href: "/articles/admission-percentages-by-university" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const answer = `میانهٔ رتبهٔ قبولی روزانهٔ ارشد ${name} در ۱۴۰۰ تا ۱۴۰۴ برابر ${int(med)} بود؛ نیمهٔ وسط قبول‌شده‌ها بین ${int(q1)} و ${int(q3)} (از ${int(d.n)} کارنامه). ${uni(first[0])} با میانهٔ ${int(first[1][1])} رقابتی‌ترین و ${uni(last[0])} با ${int(last[1][1])} آسان‌ترین دانشگاه دارای دست‌کم ۵ کارنامه بود. قبول‌شدهٔ معمول میانگین چهار درس تخصصی ${pct(d.spec)} و معدل ${dec(g.med)} داشت.`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `ارشد ${name}: رتبهٔ قبولی هر دانشگاه از ${int(d.n)} کارنامه`,
    slug,
    summary: `رتبهٔ قبولی روزانهٔ ارشد ${name} در هر دانشگاه، درصد و معدل قبول‌شده‌ها و مقایسه با گرایش‌های دیگر در ۱۴۰۰ تا ۱۴۰۴، از ${int(d.n)} کارنامهٔ واقعی.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: [tag, "گرایش‌ها", "رتبهٔ قبولی", "کارنامه و رتبه"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `ارشد ${name}: رتبهٔ قبولی هر دانشگاه`,
      description: `رتبهٔ قبولی ارشد ${name} در هر دانشگاه، درصد و معدل قبول‌شده‌ها و مقایسه با گرایش‌های دیگر در ۱۴۰۰ تا ۱۴۰۴ از ${int(d.n)} کارنامهٔ واقعی.`,
    },
    validity: { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: "کارنامه‌های قبولی ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۴ کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی",
        claim: `رتبه، درصد و معدل قبول‌شده‌های روزانهٔ سهمیهٔ آزاد گرایش ${name}`,
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
