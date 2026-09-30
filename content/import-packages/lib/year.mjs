// Builds one "master's computer engineering exam of year Y" data article from
// analysis/year_stats.json (aggregates of report cards: set 1277, free quota;
// groups >= 10, medians of >= 5). Weighted averages come from the public rank
// model (GPA 17.5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/year_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const dec = (v) => fa(v.toFixed(1));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const BANDS = ["1-30", "31-100", "101-300", "301-1000", "1001-3000"];
const BL = (b) => b.split("-").map(int).join(" تا ");
const RANKS = ["10", "30", "50", "100", "200", "300", "500", "1000", "1500", "2000", "3000"];
const NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"];
const UNI = { "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت", "شهید بهشتی": "شهید بهشتی", "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد", "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان", "الزهرا": "الزهرا", "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز" };

export function yearArticle({ year, slug, tests, notes, tag }) {
  const y = String(year), d = STATS[y];
  const prev = STATS[String(year - 1)], next = STATS[String(year + 1)];
  const blocks = [];
  const nd = (s, code, r) => (s?.need?.[code]?.[r] ?? null);
  const cell = (v) => (v == null ? "—" : pct(v));

  blocks.push(text(
    `«کنکور ارشد کامپیوتر ${fa(year)} چقدر سخت بود؟» را با عدد جواب می‌دهیم. از ${int(d.n)} کارنامهٔ سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) همان سال درصد لازم برای هر رتبه، کارنامهٔ معمول هر گروه رتبه و رتبهٔ قبولی دانشگاه‌ها را درآوردیم.`,
  ));
  blocks.push(text(
    `داده: ${int(d.n)} کارنامهٔ منتشرشده و کارنامهٔ شاگردهای کلاس از ${fa(year)}؛ ${int(d.nTop3000)} کارنامه بهترین رتبهٔ داخل سهمیه‌اش ۳۰۰۰ یا بهتر است. گروه رتبهٔ هر کارنامه با بهترین رتبه‌اش در چهار کد ضریب تعیین شده. فقط آمار تجمیعی می‌آید؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند.` +
      (tests ? ` تعداد تست‌ها در ${fa(year)}: ${tests}.` : ""),
  ));

  blocks.push(h2(`میانگین وزنی لازم برای هر رتبه در ${fa(year)}`));
  blocks.push(text(`این عددها از مدل ابزار تخمین رتبه است: میانگین وزنی‌ای که در آن سال با معدل ۱۷٫۵ در کد ضریب هوش مصنوعی و کد نرم‌افزار همان رتبه را می‌داد. برای مقایسه، ستون ${fa(year - 1)} و ${fa(year + 1)} (کد هوش مصنوعی) هم آمده است. «—» یعنی آن رتبه در دامنهٔ کارنامه‌های آن سال نیست.`));
  blocks.push({
    type: "table",
    headers: ["رتبه", `${fa(year)}، کد هوش مصنوعی`, `${fa(year)}، کد نرم‌افزار`, ...(prev ? [`${fa(year - 1)}، هوش مصنوعی`] : []), ...(next ? [`${fa(year + 1)}، هوش مصنوعی`] : [])],
    rows: RANKS.map((r) => [int(r), cell(nd(d, "2", r)), cell(nd(d, "4", r)), ...(prev ? [cell(nd(prev, "2", r))] : []), ...(next ? [cell(nd(next, "2", r))] : [])]),
  });
  blocks.push(text(notes.need));

  blocks.push(h2("کارنامهٔ معمول هر گروه رتبه"));
  blocks.push(text("میانهٔ درصد هر درس در هر گروه رتبه، به‌علاوهٔ میانهٔ معدل و سهم زبان و ریاضیِ صفر یا منفی."));
  const bands = BANDS.filter((b) => d.bands[b]);
  blocks.push({
    type: "table",
    headers: ["گروه رتبه", "تعداد کارنامه", ...NAMES, "معدل", "ریاضی صفر یا منفی", "زبان صفر یا منفی"],
    rows: bands.map((b) => { const v = d.bands[b]; return [BL(b), int(v.n), ...v.pct.map(pct), dec(v.gpa), pct(100 * v.zeroMath), pct(100 * v.zeroLang)]; }),
  });
  blocks.push(text(notes.card));

  if (d.shift) {
    blocks.push(h2(`${fa(year)} در برابر ${fa(year - 1)}: کدام درس سخت‌تر شد؟`));
    blocks.push(text(`تفاوت میانهٔ درصد هر درس با سال قبل، در همان گروه رتبه (به واحد درصد). عدد منفی یعنی رتبه‌های همان گروه در ${fa(year)} درصد کمتری زدند، یعنی آن درس سخت‌تر بود یا داوطلب‌های آن سال در آن ضعیف‌تر بودند؛ از کارنامه‌ها نمی‌شود این دو را جدا کرد.`));
    blocks.push({
      type: "table",
      headers: ["گروه رتبه", ...NAMES],
      rows: BANDS.filter((b) => d.shift[b]).map((b) => [BL(b), ...d.shift[b].map((v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${int(Math.abs(v))}`)]),
    });
    blocks.push(text(notes.shift));
  }

  if (d.net) {
    blocks.push(h2(`تست خالص هر گروه رتبه در ${fa(year)}`));
    blocks.push(text(`میانهٔ درصد ضرب در تعداد تست هر درس در ${fa(year)} (${NAMES.map((n, j) => `${n} ${d.tests[j] ? int(d.tests[j]) : "نامشخص"}`).join("، ")}). تست خالص یعنی درست منهای یک‌سوم غلط.`));
    blocks.push({
      type: "table",
      headers: ["گروه رتبه", ...NAMES],
      rows: BANDS.filter((b) => d.net[b]).map((b) => [BL(b), ...d.net[b].map((v) => (v == null ? "—" : fa(v.toFixed(1))))]),
    });
  }

  if (d.top100) {
    const t = d.top100;
    const CODE = { 1: "شبکه و امنیت", 2: "هوش مصنوعی", 3: "معماری", 4: "نرم‌افزار" };
    blocks.push(h2(`رتبه‌های زیر ۱۰۰ در ${fa(year)} چه شکلی بودند؟`));
    blocks.push({
      type: "table",
      headers: ["شاخص", "مقدار"],
      rows: [
        ["تعداد کارنامه", int(t.n)],
        ["میانهٔ میانگین چهار تخصصی (نیمهٔ وسط)", `${pct(t.spec)} (${int(t.specQ[0])} تا ${int(t.specQ[1])}٪)`],
        ["معدل (نیمهٔ وسط)", `${dec(t.gpaQ[0])} تا ${dec(t.gpaQ[1])}`],
        ["معدل ۱۹ یا بیشتر", pct(100 * t.ge19)],
        ["ریاضی ۱۵٪+ و زبان ۳۰٪+ هر دو", `${int(t.both)} کارنامه (${pct((100 * t.both) / t.n)})`],
        ["ریاضی زیر ۱۵٪ و زبان زیر ۳۰٪ هر دو", `${int(t.neither)} کارنامه (${pct((100 * t.neither) / t.n)})`],
        ...Object.entries(t.bestCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => [`بهترین رتبه در کد ${CODE[c]}`, `${int(n)} کارنامه`]),
      ],
    });
    blocks.push(text(notes.top));
  }

  const unis = Object.entries(d.adm.unis).sort((a, b) => a[1][1] - b[1][1]);
  if (unis.length) {
    blocks.push(h2(`رتبهٔ قبولی دانشگاه‌ها در ${fa(year)}`));
    blocks.push(text(`میانهٔ رتبهٔ قبولی روزانهٔ سهمیهٔ آزاد در دانشگاه‌هایی که از این سال دست‌کم ۵ کارنامهٔ قبولی داریم. رتبه در کد ضریب گرایش قبول‌شده است و ترکیب گرایش‌ها هر دانشگاه فرق می‌کند؛ برای رتبهٔ هر گرایش به مطالب «رتبهٔ قبولی به تفکیک دانشگاه» مراجعه کن.`));
    blocks.push({
      type: "table",
      headers: ["دانشگاه", "تعداد کارنامهٔ قبولی", "میانهٔ رتبه"],
      rows: unis.map(([u, [n, m]]) => [UNI[u] || u, int(n), int(m)]),
    });
    blocks.push(text(notes.adm));
    const progs = Object.entries(d.adm.progs).sort((a, b) => a[1][1] - b[1][1]);
    if (progs.length) {
      blocks.push(text(`میانهٔ رتبهٔ قبولی هر گرایش در ${fa(year)} (دست‌کم ۵ کارنامه):`));
      blocks.push({ type: "table", headers: ["گرایش", "تعداد کارنامه", "میانهٔ رتبه"], rows: progs.map(([p, [n, m]]) => [p, int(n), int(m)]) });
    }
    const pairs = Object.entries(d.adm.pairs).sort((a, b) => a[1][1] - b[1][1]);
    if (pairs.length) {
      blocks.push(text(`و رشته‌محل‌هایی که در ${fa(year)} دست‌کم ۵ کارنامهٔ قبولی دارند:`));
      blocks.push({ type: "table", headers: ["گرایش", "دانشگاه", "تعداد", "میانهٔ رتبه"], rows: pairs.map(([k, [n, m]]) => { const [p, u] = k.split("|"); return [p, UNI[u] || u, int(n), int(m)]; }) });
    }
  }

  blocks.push(h2(`${fa(year)} برای داوطلب ۱۴۰۶ چه درسی دارد؟`));
  for (const para of notes.lessons) blocks.push(text(para));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`برای رتبهٔ ۱۰۰ ارشد کامپیوتر در ${fa(year)} چند درصد لازم بود؟`));
  blocks.push(text(`با معدل ۱۷٫۵ در کد هوش مصنوعی حدود ${pct(nd(d, "2", "100"))} میانگین وزنی و در کد نرم‌افزار حدود ${pct(nd(d, "4", "100"))}. این عدد از مدل ابزار تخمین رتبه می‌آید، نه از یک کارنامهٔ مشخص.`));
  blocks.push(h3(`برای رتبهٔ ۱۰۰۰ در ${fa(year)} چه درصدی لازم بود؟`));
  blocks.push(text(`حدود ${pct(nd(d, "2", "1000"))} میانگین وزنی در کد هوش مصنوعی و ${pct(nd(d, "4", "1000"))} در کد نرم‌افزار، با معدل ۱۷٫۵.`));
  blocks.push(h3(`رتبه‌های زیر ۱۰۰ در ${fa(year)} چه معدلی داشتند؟`));
  const top = d.bands["1-30"], second = d.bands["31-100"];
  blocks.push(text(`میانهٔ معدل رتبه‌های ۱ تا ۳۰ ${dec(top.gpa)} و رتبه‌های ۳۱ تا ۱۰۰ ${dec(second.gpa)} بود.`));
  blocks.push(h3(`چند درصد رتبه‌های زیر ۱۰۰ در ${fa(year)} ریاضی را صفر زدند؟`));
  blocks.push(text(`${pct(100 * top.zeroMath)} از رتبه‌های ۱ تا ۳۰ و ${pct(100 * second.zeroMath)} از رتبه‌های ۳۱ تا ۱۰۰ ریاضی را صفر یا منفی زده بودند.`));
  if (d.adm.unis["صنعتی شریف"]) {
    blocks.push(h3(`رتبهٔ قبولی شریف در ${fa(year)} چند بود؟`));
    blocks.push(text(`میانهٔ رتبهٔ قبولی روزانهٔ سهمیهٔ آزاد شریف ${int(d.adm.unis["صنعتی شریف"][1])} بود (${int(d.adm.unis["صنعتی شریف"][0])} کارنامه، همهٔ گرایش‌ها).`));
  }
  for (const [q, a] of notes.faq || []) { blocks.push(h3(q)); blocks.push(text(a)); }
  blocks.push(h3("چند کارنامه از این سال داریم؟"));
  blocks.push(text(`${int(d.n)} کارنامهٔ سهمیهٔ آزاد مجموعهٔ ۱۲۷۷ که ${int(d.nTop3000)} تایشان رتبهٔ ۳۰۰۰ یا بهتر دارند، و ${int(d.adm.n)} کارنامهٔ قبولی روزانه.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("اگر آزمون‌های آزمایشی می‌زنی، درصدهایت را در ابزار تخمین رتبه بزن تا رتبه‌ات را در همهٔ سال‌ها کنار هم ببینی. برای برنامه‌ریزی بر اساس این داده‌ها هم در مشاوره کنارت هستیم."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "تحلیل کنکور ۱۴۰۴", href: "/articles/exam-1404-analysis" },
      { label: "تحلیل کنکور ۱۴۰۵", href: "/articles/exam-1405-analysis" },
      { label: "سخت‌ترین کنکور ارشد کامپیوتر کدام سال بود؟", href: "/articles/hardest-master-exam-year" },
      { label: "درصد لازم برای رتبه‌های ۵۰۰ تا ۳۰۰۰", href: "/articles/rank-500-to-3000-percentages" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const answer = `در ${fa(year)} برای رتبهٔ ۱۰۰ ارشد مهندسی کامپیوتر (کد هوش مصنوعی، معدل ۱۷٫۵) حدود ${pct(nd(d, "2", "100"))} میانگین وزنی لازم بود و برای رتبهٔ ۱۰۰۰ حدود ${pct(nd(d, "2", "1000"))}. ${notes.short}`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `تحلیل کنکور ارشد کامپیوتر ${fa(year)} از ${int(d.n)} کارنامه: درصد لازم برای هر رتبه`,
    slug,
    summary: `درصد لازم برای هر رتبه، کارنامهٔ معمول هر گروه رتبه و رتبهٔ قبولی دانشگاه‌ها در کنکور ارشد مهندسی کامپیوتر ${fa(year)}، از ${int(d.n)} کارنامهٔ واقعی.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: [tag, "تحلیل کنکور", "کارنامه و رتبه"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `کنکور ارشد کامپیوتر ${fa(year)}: درصد لازم برای هر رتبه`,
      description: `کنکور ارشد مهندسی کامپیوتر ${fa(year)} چقدر سخت بود؟ درصد لازم برای رتبه‌های ۱۰ تا ۳۰۰۰، کارنامهٔ معمول هر گروه رتبه و رتبهٔ قبولی دانشگاه‌ها.`,
    },
    validity: { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: `کارنامه‌های ارشد مهندسی کامپیوتر ${fa(year)} کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی`,
        claim: `درصدها، میانه‌ها و شمارش‌های این مطلب از کارنامه‌های سهمیهٔ آزاد ${fa(year)}`,
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
