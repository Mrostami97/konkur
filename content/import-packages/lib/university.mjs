// Builds one "master's computer engineering at <university>" data article from
// analysis/uni_stats.json (aggregates of the public result banks: free quota,
// daytime, groups >= 10, medians of groups >= 5 only). The numbers come from
// the file; the prose only reads them.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/uni_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const dec = (v) => fa(v.toFixed(1));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const ORDER = Object.keys(STATS).sort((a, b) => STATS[a].order - STATS[b].order);
const LABEL = {
  "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت",
  "شهید بهشتی": "شهید بهشتی", "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد",
  "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان", "الزهرا": "الزهرا", "تبریز": "دانشگاه تبریز",
  "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز",
};
const label = (k) => LABEL[k] || k;

export function universityArticle({ key, slug, name, short, note }) {
  const d = STATS[key];
  if (!d) throw new Error(`no stats for ${key}`);
  const [q1, med, q3] = d.rank;
  const progs = Object.entries(d.progs).sort((a, b) => a[1][1] - b[1][1]);
  const best = progs[0], worst = progs[progs.length - 1];
  const ai = d.progs["هوش مصنوعی"];
  const yrs = Object.entries(d.years);
  const idx = ORDER.indexOf(key);
  const prev = ORDER[idx - 1], next = ORDER[idx + 1];
  const g = d.gpa;
  const blocks = [];

  blocks.push(text(
    `«با چه رتبه‌ای در ${name} قبول می‌شوم؟» جواب درست از کارنامهٔ کسانی درمی‌آید که واقعاً قبول شده‌اند. اینجا ${int(d.n)} کارنامهٔ قبولی روزانهٔ سهمیهٔ آزاد ارشد مهندسی کامپیوتر ${name} از ۱۴۰۰ تا ۱۴۰۴ را جمع کردیم و رتبه، درصدها و معدلشان را خلاصه کردیم.`,
  ));
  blocks.push(text(
    "داده: کارنامه‌های منتشرشدهٔ قبول‌شده‌ها در بانک‌های عمومی و کارنامه‌های شاگردهای کلاس، هر کارنامه یک بار. رتبه همان رتبهٔ داخل سهمیه در کد ضریب گرایش قبول‌شده است. فقط آمار تجمیعی می‌آید؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند و میانهٔ گروه‌های ۵ تا ۹ کارنامه‌ای با ذکر تعداد آمده. همهٔ قبول‌شده‌ها کارنامه‌شان را منتشر نمی‌کنند، پس این عددها مرز قطعی قبولی نیستند.",
  ));

  blocks.push(h2(`رتبهٔ قبولی ${short} به تفکیک گرایش`));
  blocks.push({
    type: "table",
    headers: ["گرایش", "تعداد کارنامه", "میانهٔ رتبهٔ قبولی"],
    rows: progs.map(([p, [n, m]]) => [p, int(n), int(m)]).concat([["همهٔ گرایش‌ها", int(d.n), int(med)]]),
  });
  blocks.push(text(
    progs.length > 1
      ? `فاصلهٔ گرایش‌ها را جدی بگیر: در ${short} ${best[0]} با میانهٔ ${int(best[1][1])} رقابتی‌ترین و ${worst[0]} با میانهٔ ${int(worst[1][1])} آسان‌ترین گرایشی است که دست‌کم ۵ کارنامه دارد؛ حدود ${dec(worst[1][1] / best[1][1])} برابر فاصله. نیمهٔ وسط قبول‌شده‌های همهٔ گرایش‌ها رتبه‌ای بین ${int(q1)} و ${int(q3)} داشتند.`
      : `نیمهٔ وسط قبول‌شده‌ها رتبه‌ای بین ${int(q1)} و ${int(q3)} داشتند و میانه ${int(med)} بود.`,
  ));

  const needRows = progs.filter(([p]) => d.need?.[p]).map(([p]) => [p, ...["1403", "1404", "1405"].map((y) => (d.need[p][y] == null ? "—" : pct(d.need[p][y])))]);
  if (needRows.length) {
    blocks.push(h2("میانگین وزنی لازم برای رتبهٔ میانهٔ هر گرایش"));
    blocks.push(text("اگر بخواهی با درصدهایت به رتبهٔ میانهٔ هر گرایش برسی، چه میانگین وزنی لازم بود؟ این عددها از مدل ابزار تخمین رتبه است (معدل ۱۷٫۵ و کد ضریب همان گرایش): میانگین وزنی‌ای که در آن سال همان رتبهٔ میانه را می‌داد. «—» یعنی آن رتبه در دامنهٔ داده‌های آن سال نیست."));
    blocks.push({ type: "table", headers: ["گرایش", "۱۴۰۳", "۱۴۰۴", "۱۴۰۵"], rows: needRows });
    blocks.push(text("میانگین وزنی هر سال با ضرایب همان سال حساب می‌شود و برای ۱۴۰۶ که ضرایب عوض می‌شود مستقیم قابل استفاده نیست؛ برای سال جدید از ابزار تخمین رتبه استفاده کن."));
  }

  if (yrs.length >= 2) {
    blocks.push(h2("رتبهٔ قبولی در سال‌های مختلف"));
    blocks.push({
      type: "table",
      headers: ["سال", "تعداد کارنامه", "میانهٔ رتبهٔ قبولی"],
      rows: yrs.map(([y, [n, m]]) => [fa(y), int(n), int(m)]),
    });
    blocks.push(text(
      "میانهٔ هر سال هم به سختی آن سال بستگی دارد و هم به اینکه کارنامهٔ کدام گرایش‌ها بیشتر منتشر شده؛ پس روند را با احتیاط بخوان. برای سال‌هایی که در جدول نیامده کمتر از ۵ کارنامه داریم.",
    ));
  }

  blocks.push(h2("کارنامهٔ معمول قبول‌شده‌ها"));
  blocks.push(text("میانهٔ درصد قبول‌شده‌ها در هر درس. «میانگین چهار تخصصی» میانهٔ میانگین ساده‌ی چهار دسته‌درس تخصصی هر کارنامه است."));
  const names = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"];
  blocks.push({
    type: "table",
    headers: ["درس", "میانهٔ درصد"],
    rows: names.map((n, i) => [n, pct(d.pct[i])]).concat([["میانگین چهار تخصصی", pct(d.spec)]]),
  });
  const pn = [];
  pn.push(`${pct(100 * d.zeroMath)} قبول‌شده‌ها ریاضی صفر یا منفی داشتند و ${pct(100 * d.zeroLang)} زبان صفر یا منفی.`);
  if (g) pn.push(`میانهٔ معدل ${dec(g.med)} بود (نیمهٔ وسط ${dec(g.q[0])} تا ${dec(g.q[2])})؛ ${pct(100 * g.lt16)} معدل زیر ۱۶ و ${pct(100 * g.ge19)} معدل ۱۹ یا بیشتر داشتند.`);
  blocks.push(text(`${pn.join(" ")} ${note}`));

  blocks.push(h2(`${short} در میان دانشگاه‌ها`));
  blocks.push(text(
    `از ${fa(ORDER.length)} دانشگاهی که دست‌کم ۱۰ کارنامهٔ قبولی روزانه دارند، ${short} از نظر میانهٔ رتبه ${fa(d.order)}‌ام است.` +
      (prev ? ` قبل از آن ${label(prev)} با میانهٔ ${int(STATS[prev].rank[1])}` : "") +
      (next ? `${prev ? " و بعد از آن" : " بعد از آن"} ${label(next)} با میانهٔ ${int(STATS[next].rank[1])} قرار دارد.` : ".") +
      " مقایسهٔ همهٔ دانشگاه‌ها در مطلب «رتبهٔ قبولی ارشد کامپیوتر به تفکیک دانشگاه» آمده است.",
  ));

  const other = d.other ? Object.entries(d.other) : [];
  if (other.length || d.quota5) {
    blocks.push(h2("دوره‌های دیگر و سهمیه‌ها"));
    const lines = [];
    for (const [per, [n, m]] of other) lines.push(`در دورهٔ «${per}» ${int(n)} کارنامهٔ قبولی سهمیهٔ آزاد داریم با میانهٔ رتبهٔ ${int(m)}؛ این رتبه هم‌مقیاس رتبهٔ روزانه است و فقط به این دوره مربوط می‌شود.`);
    if (d.quota5) lines.push(`در سهمیهٔ ۵٪ ${int(d.quota5[0])} کارنامهٔ قبولی روزانه داریم با میانهٔ رتبهٔ داخل سهمیه ${int(d.quota5[1])}. رتبهٔ داخل سهمیه را نمی‌شود با رتبهٔ آزاد مقایسه کرد.`);
    blocks.push(text(lines.join(" ")));
  }

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`رتبهٔ قبولی ارشد کامپیوتر ${short} چند است؟`));
  blocks.push(text(`میانهٔ رتبهٔ قبولی روزانهٔ سهمیهٔ آزاد ${int(med)} بود (${int(d.n)} کارنامه، ۱۴۰۰ تا ۱۴۰۴) و نیمهٔ وسط قبول‌شده‌ها رتبه‌ای بین ${int(q1)} و ${int(q3)} داشتند. رتبه در کد ضریب همان گرایش حساب می‌شود.`));
  blocks.push(h3(ai ? `برای هوش مصنوعی ${short} چه رتبه‌ای لازم است؟` : `کدام گرایش ${short} آسان‌تر قبول می‌شود؟`));
  blocks.push(text(ai
    ? `میانهٔ رتبهٔ قبولی هوش مصنوعی ${short} ${int(ai[1])} بود (${int(ai[0])} کارنامه). در همین دانشگاه ${worst[0]} میانهٔ ${int(worst[1][1])} داشت.`
    : `در این داده ${worst[0]} با میانهٔ ${int(worst[1][1])} آسان‌ترین گرایش دارای دست‌کم ۵ کارنامه است و ${best[0]} با ${int(best[1][1])} رقابتی‌ترین.`));
  if (g) {
    blocks.push(h3(`قبول‌شده‌های ${short} چه معدلی دارند؟`));
    blocks.push(text(`میانهٔ معدل ${dec(g.med)} بود؛ ${pct(100 * g.lt16)} معدل زیر ۱۶ و ${pct(100 * g.ge19)} معدل ۱۹ یا بالاتر داشتند. اثر معدل را در مطلب «تأثیر معدل در کنکور ارشد کامپیوتر» حساب کرده‌ایم.`));
  }
  blocks.push(h3(`با ریاضی صفر می‌شود در ${short} قبول شد؟`));
  blocks.push(text(`در این داده ${pct(100 * d.zeroMath)} قبول‌شده‌ها ریاضی صفر یا منفی داشتند و میانهٔ ریاضی ${pct(d.pct[1])} بود. ولی از ۱۴۰۶ ضریب ریاضی دو برابر می‌شود و این عددها را نباید مستقیم به آزمون بعدی تعمیم داد.`));
  blocks.push(h3(`${short} چقدر سخت‌تر از دانشگاه‌های دیگر است؟`));
  blocks.push(text(`از نظر میانهٔ رتبهٔ قبولی، ${fa(d.order)}‌امین دانشگاه از ${fa(ORDER.length)} دانشگاه بررسی‌شده است. این فقط سختی ورود را می‌سنجد، نه کیفیت آموزش.`));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(d.n)} کارنامهٔ قبولی روزانهٔ سهمیهٔ آزاد در ۱۴۰۰ تا ۱۴۰۴. ${Object.entries(d.yearsN).filter(([, n]) => n).map(([y, n]) => `${fa(y)}: ${int(n)}`).join("، ")}. کارنامهٔ ۱۴۰۵ هنوز به نتیجهٔ قبولی وصل نشده و در این آمار نیست.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("اگر درصدهای آزمون‌هایت را داری، در ابزار تخمین رتبه بزن ببین رتبه‌ات کجاست و بعد با جدول‌های بالا مقایسه‌اش کن. برای انتخاب گرایش و دانشگاه با توجه به درصدهای خودت هم در مشاوره کنارت هستیم."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "رتبهٔ قبولی ارشد کامپیوتر به تفکیک دانشگاه", href: "/articles/admitted-ranks-by-university" },
      { label: "میانگین وزنی لازم برای قبولی هر دانشگاه", href: "/articles/admission-percentages-by-university" },
      { label: "معدل قبول‌شده‌ها", href: "/articles/master-admission-low-gpa" },
      { label: "گرایش‌های ارشد کامپیوتر", href: "/articles/master-computer-orientations" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const answer = `میانهٔ رتبهٔ قبولی روزانهٔ ارشد مهندسی کامپیوتر ${name} در ۱۴۰۰ تا ۱۴۰۴ برابر ${int(med)} بود؛ نیمهٔ وسط قبول‌شده‌ها بین ${int(q1)} و ${int(q3)} (از ${int(d.n)} کارنامه). ${progs.length > 1 ? `${best[0]} با میانهٔ ${int(best[1][1])} رقابتی‌ترین و ${worst[0]} با ${int(worst[1][1])} آسان‌ترین گرایش بود. ` : ""}قبول‌شدهٔ معمول میانگین چهار درس تخصصی ${pct(d.spec)}${g ? ` و معدل ${dec(g.med)}` : ""} داشت.`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `ارشد کامپیوتر ${name}: رتبه و درصد قبولی هر گرایش از ${int(d.n)} کارنامه`,
    slug,
    summary: `میانهٔ رتبهٔ قبولی، رتبهٔ هر گرایش، درصد و معدل قبول‌شده‌های روزانهٔ ارشد مهندسی کامپیوتر ${name} در ۱۴۰۰ تا ۱۴۰۴، از ${int(d.n)} کارنامهٔ واقعی.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: ["دانشگاه‌ها", "رتبهٔ قبولی", "کارنامه و رتبه"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `ارشد کامپیوتر ${short}: رتبه و درصد قبولی هر گرایش`,
      description: `رتبهٔ قبولی هر گرایش ارشد مهندسی کامپیوتر ${name}، درصد و معدل قبول‌شده‌ها در ۱۴۰۰ تا ۱۴۰۴ از ${int(d.n)} کارنامهٔ واقعی؛ میانه و نیمهٔ وسط.`,
    },
    validity: { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: "کارنامه‌های قبولی ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۴ کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی",
        claim: `رتبه، درصد و معدل قبول‌شده‌های روزانهٔ سهمیهٔ آزاد ${name}`,
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
