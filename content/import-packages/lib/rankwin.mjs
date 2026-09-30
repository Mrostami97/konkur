// Builds one "what does rank ~X of the master's computer engineering exam look
// like" data article from analysis/rank_window_stats.json (aggregates of report
// cards, set 1277, free quota; band = best in-quota rank over the four codes;
// groups >= 10, category counts >= 5). Weighted averages are from the public
// rank model (GPA 17.5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/rank_window_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const dec = (v) => fa(v.toFixed(1));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const NAMES = ["زبان", "ریاضی", "نظریه و سیگنال", "داده‌ساختار، الگوریتم و هوش", "منطقی و معماری", "سیستم عامل، شبکه و پایگاه داده"];
const UNI = { "صنعتی شریف": "شریف", "تهران": "دانشگاه تهران", "امیرکبیر": "امیرکبیر", "علم و صنعت": "علم و صنعت", "شهید بهشتی": "شهید بهشتی", "خواجه‌نصیر": "خواجه‌نصیر", "تربیت مدرس": "تربیت مدرس", "فردوسی مشهد": "فردوسی مشهد", "خوارزمی": "خوارزمی", "صنعتی اصفهان": "صنعتی اصفهان", "الزهرا": "الزهرا", "تبریز": "دانشگاه تبریز", "دانشگاه اصفهان": "دانشگاه اصفهان", "مالک اشتر": "مالک اشتر", "شیراز": "دانشگاه شیراز" };
const uni = (u) => UNI[u] || u;
const CODE = { 1: "شبکه و امنیت", 2: "هوش مصنوعی", 3: "معماری", 4: "نرم‌افزار و بقیه" };
const list = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

export function rankWindowArticle({ key, slug, rank, note, lessons = [], faq = [] }) {
  const d = STATS[key];
  const { lo, hi, center } = d;
  const win = `${int(lo)} تا ${int(hi)}`;
  const blocks = [];
  const yrsN = Object.entries(d.byYear).filter(([, n]) => n);

  blocks.push(text(
    `«با رتبهٔ ${int(rank)} ارشد کامپیوتر کارنامه‌ام چه شکلی است و کجا قبول می‌شوم؟» را از کارنامهٔ کسانی که چنین رتبه‌ای گرفته‌اند جواب می‌دهیم. رتبهٔ ${int(rank)} یعنی بهترین رتبهٔ داخل سهمیهٔ آزاد بین ${win}؛ ${int(d.n)} کارنامهٔ ۱۴۰۰ تا ۱۴۰۵ در این بازه است.`,
  ));
  blocks.push(text(
    `داده: کارنامه‌های سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷)، بازهٔ رتبه‌ها با بهترین رتبهٔ هر کارنامه در چهار کد ضریب تعیین شده. تعداد کارنامه در هر سال: ${yrsN.map(([y, n]) => `${fa(y)}: ${int(n)}`).join("، ")}. فقط آمار تجمیعی می‌آید؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند و شمارش دانشگاه‌ها و گرایش‌ها فقط برای دست‌کم ۵ کارنامه.`,
  ));

  blocks.push(h2(`میانگین وزنی لازم برای رتبهٔ ${int(center)} در هر سال`));
  blocks.push(text("از مدل ابزار تخمین رتبه: میانگین وزنی‌ای که در آن سال با معدل ۱۷٫۵ رتبهٔ مرکز بازه را می‌داد. «—» یعنی این رتبه در دامنهٔ کارنامه‌های آن سال نیست."));
  const years = ["1400", "1401", "1402", "1403", "1404", "1405"];
  blocks.push({
    type: "table",
    headers: ["کد ضریب", ...years.map(fa)],
    rows: [["هوش مصنوعی", ...years.map((y) => (d.need["2"][y] == null ? "—" : pct(d.need["2"][y])))], ["نرم‌افزار", ...years.map((y) => (d.need["4"][y] == null ? "—" : pct(d.need["4"][y])))]],
  });
  blocks.push(text("ضرایب ۱۴۰۶ فرق دارد (زبان ۱، ریاضی ۲، تخصصی ۴)، پس برای سال جدید میانگین وزنی را با ابزار تخمین رتبه حساب کن."));

  blocks.push(h2(`کارنامهٔ معمول رتبه‌های ${win}`));
  blocks.push(text("میانهٔ درصد هر درس و نیمهٔ وسط (چارک اول تا سوم)."));
  const rows = NAMES.map((n, i) => [n, pct(d.box[i][1]), `${int(d.box[i][0])} تا ${int(d.box[i][2])}٪`]);
  rows.push(["میانگین چهار تخصصی", pct(d.spec[1]), `${int(d.spec[0])} تا ${int(d.spec[2])}٪`]);
  rows.push(["معدل", dec(d.gpa[1]), `${dec(d.gpa[0])} تا ${dec(d.gpa[2])}`]);
  blocks.push({ type: "table", headers: ["درس", "میانه", "نیمهٔ وسط"], rows });
  blocks.push(text(
    `${pct(100 * d.zeroMath)} از این کارنامه‌ها ریاضی صفر یا منفی و ${pct(100 * d.zeroLang)} زبان صفر یا منفی داشتند. ${pct(100 * d.ge19)} معدل ۱۹ یا بالاتر و ${pct(100 * d.lt16)} معدل زیر ۱۶ داشتند. ${note}`,
  ));

  const codes = list(d.bestCode);
  const few = (n) => (n < 5 ? "کمتر از ۵" : int(n));
  const py = Object.entries(d.perYear || {});
  if (py.length) {
    blocks.push(h2(`کارنامهٔ رتبه‌های ${win} در هر سال`));
    blocks.push(text("میانهٔ میانگین چهار تخصصی، ریاضی، زبان و معدل در سال‌هایی که دست‌کم ۱۰ کارنامه در این بازه داریم:"));
    blocks.push({ type: "table", headers: ["سال", "تعداد", "میانگین چهار تخصصی", "ریاضی", "زبان", "معدل"], rows: py.map(([y, [n, sp, m, l, g]]) => [fa(y), int(n), pct(sp), pct(m), pct(l), dec(g)]) });
  }
  if (d.net1404) {
    const T = [25, 20, 10, 20, 20, 20];
    blocks.push(h2(`تست خالص رتبه‌های ${win} در ۱۴۰۴`));
    blocks.push(text(`میانهٔ تست خالص هر درس در ${int(d.net1404[0])} کارنامهٔ ۱۴۰۴ این بازه (درست منهای یک‌سوم غلط). جمع این میانه‌ها میانهٔ کل نیست؛ هر ستون جدا خوانده شود.`));
    blocks.push({ type: "table", headers: ["درس", "تعداد تست", "میانهٔ تست خالص"], rows: NAMES.map((n, i) => [n, int(T[i]), fa(d.net1404[1][i].toFixed(1))]) });
  }
  if (d.early && d.late) {
    blocks.push(h2("این بازه در سال‌های اخیر چه تغییری کرد؟"));
    blocks.push(text("نوع کارنامه‌ها بر اساس ریاضی (۱۵٪ یا بیشتر = قوی) و زبان (۳۰٪ یا بیشتر = قوی)، در ۱۴۰۰ تا ۱۴۰۳ و ۱۴۰۴ و ۱۴۰۵:"));
    blocks.push({ type: "table", headers: ["دوره", "تعداد کارنامه", "ریاضی و زبان هر دو قوی", "ریاضی و زبان هر دو ضعیف"], rows: [["۱۴۰۰ تا ۱۴۰۳", d.early], ["۱۴۰۴ و ۱۴۰۵", d.late]].map(([l, [n, b, ne]]) => [l, int(n), `${few(b)}${b >= 5 ? ` (${pct((100 * b) / n)})` : ""}`, `${few(ne)}${ne >= 5 ? ` (${pct((100 * ne) / n)})` : ""}`]) });
  }

  blocks.push(h2("کدام کد ضریب بهترین رتبه را داد؟"));
  blocks.push(text("هر کارنامه چهار رتبه دارد، یکی برای هر کد ضریب. اینکه بهترین رتبه در کدام کد بود، نشان می‌دهد کارنامه‌های این بازه در کدام درس‌ها قوی‌اند:"));
  blocks.push({ type: "table", headers: ["کد ضریب", "تعداد کارنامه", "سهم"], rows: codes.map(([c, n]) => [CODE[c], int(n), pct((100 * n) / d.n)]) });

  const unis = list(d.admUni), progs = list(d.admProg), pairs = list(d.admPairs);
  if (unis.length) {
    blocks.push(h2(`این رتبه‌ها کجا قبول شدند؟`));
    blocks.push(text(
      `از ${int(d.admN)} کارنامهٔ قبولی روزانهٔ سهمیهٔ آزاد که رتبهٔ داخل سهمیهٔ همان گرایش بین ${win} بود، شمارش دانشگاه‌ها و گرایش‌ها (فقط شمارش‌های دست‌کم ۵): رتبه‌ای که در جدول می‌بینی رتبهٔ همان گرایش قبول‌شده است، نه لزوماً بهترین رتبهٔ کارنامه.`,
    ));
    blocks.push({ type: "table", headers: ["دانشگاه", "تعداد قبولی"], rows: unis.map(([u, n]) => [uni(u), int(n)]) });
    if (progs.length) blocks.push({ type: "table", headers: ["گرایش", "تعداد قبولی"], rows: progs.map(([p, n]) => [p, int(n)]) });
    if (pairs.length) {
      blocks.push(text("پرتکرارترین ترکیب‌های گرایش و دانشگاه:"));
      blocks.push({ type: "table", headers: ["گرایش", "دانشگاه", "تعداد قبولی"], rows: pairs.map(([k, n]) => { const [p, u] = k.split("|"); return [p, uni(u), int(n)]; }) });
    }
    blocks.push(text("این‌ها قبولی‌های کارنامه‌های منتشرشده است. همهٔ قبول‌شده‌ها کارنامه‌شان را منتشر نمی‌کنند و ظرفیت هر دانشگاه در هر سال فرق می‌کند؛ پس فهرست کامل نیست."));
  }

  if (lessons.length) { blocks.push(h2(`اگر هدفت رتبهٔ ${int(rank)} است`)); for (const p of lessons) blocks.push(text(p)); }

  blocks.push(h2("پرسش‌های پرتکرار"));
  for (const [q, a] of faq) { blocks.push(h3(q)); blocks.push(text(a)); }
  blocks.push(h3(`رتبهٔ ${int(rank)} ارشد کامپیوتر چند درصد است؟`));
  blocks.push(text(`میانهٔ میانگین چهار درس تخصصی رتبه‌های ${win} ${pct(d.spec[1])} بود (نیمهٔ وسط ${int(d.spec[0])} تا ${int(d.spec[2])}٪). برای میانگین وزنی، جدول بالا را ببین: با معدل ۱۷٫۵ در سال ۱۴۰۴ حدود ${pct(d.need["2"]["1404"] ?? 0)} در کد هوش مصنوعی لازم بود${d.need["2"]["1404"] == null ? "؛ آن سال این رتبه در دامنهٔ داده نیست" : ""}.`));
  blocks.push(h3(`با رتبهٔ ${int(rank)} کدام دانشگاه قبول می‌شوم؟`));
  blocks.push(text(unis.length
    ? `در قبولی‌های این بازه، بیشتر از همه ${unis.slice(0, 3).map(([u, n]) => `${uni(u)} (${int(n)} کارنامه)`).join("، ")} دیده می‌شود. گرایش‌ها فرق زیادی دارند؛ جدول بالا را ببین.`
    : "برای این بازه دانشگاهی با دست‌کم ۵ کارنامهٔ قبولی نداریم."));
  blocks.push(h3(`رتبه‌های ${win} معدل چند دارند؟`));
  blocks.push(text(`میانهٔ معدل ${dec(d.gpa[1])} است (نیمهٔ وسط ${dec(d.gpa[0])} تا ${dec(d.gpa[2])}).`));
  blocks.push(h3(`آیا با ریاضی صفر می‌شود به رتبهٔ ${int(rank)} رسید؟`));
  blocks.push(text(`در ۱۴۰۰ تا ۱۴۰۵ ${pct(100 * d.zeroMath)} کارنامه‌های این بازه ریاضی را صفر یا منفی زده بودند. با ضریب ۲ از ۷ ریاضی در ۱۴۰۶ این عدد را نباید مستقیم به آزمون بعدی تعمیم داد.`));
  blocks.push(h3(`رتبهٔ ${int(rank)} در کدام کد ضریب بهتر می‌شود؟`));
  blocks.push(text(`در این بازه بهترین رتبهٔ کارنامه‌ها بیشتر در کد ${CODE[codes[0][0]]} بود (${int(codes[0][1])} از ${int(d.n)} کارنامه، ${pct((100 * codes[0][1]) / d.n)}) و بعد کد ${CODE[codes[1][0]]} (${int(codes[1][1])}). کد به درس‌هایی بستگی دارد که در آن‌ها قوی هستی؛ ابزار تخمین رتبه رتبهٔ هر چهار کد را با هم می‌دهد.`));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(d.n)} کارنامه با بهترین رتبهٔ ${win}. ${yrsN.map(([y, n]) => `${fa(y)}: ${int(n)}`).join("، ")}.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("درصدهای آزمون‌هایت را در ابزار تخمین رتبه بزن و کارنامه‌ات را با جدول‌های بالا مقایسه کن. برای برنامه‌ریزی تا رسیدن به این رتبه هم در مشاوره کنارت هستیم."));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "رتبهٔ زیر ۱۰۰ چند درصد می‌خواهد؟", href: "/articles/top-rank-percentages" },
      { label: "برای هر رتبه چند تست خالص لازم است؟", href: "/articles/net-tests-per-rank" },
      { label: "رتبهٔ قبولی ارشد کامپیوتر به تفکیک دانشگاه", href: "/articles/admitted-ranks-by-university" },
      { label: "کدام کد ضریب بهتر است؟", href: "/articles/coefficient-codes-explained" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const topU = unis.slice(0, 3).map(([u]) => uni(u)).join("، ");
  const answer = `کارنامهٔ معمول رتبه‌های ${win} ارشد مهندسی کامپیوتر (سهمیهٔ آزاد، ${int(d.n)} کارنامه): میانهٔ میانگین چهار درس تخصصی ${pct(d.spec[1])}، ریاضی ${pct(d.box[1][1])}، زبان ${pct(d.box[0][1])} و معدل ${dec(d.gpa[1])}. ${pct(100 * d.zeroMath)} ریاضی را صفر یا منفی زده بودند.${unis.length ? ` بیشترین قبولی با این رتبه‌ها در ${topU} بود.` : ""}`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `رتبهٔ ${int(rank)} ارشد کامپیوتر (رتبه‌های ${win}): کارنامه و دانشگاه‌های قبولی`,
    slug,
    summary: `کارنامهٔ معمول رتبه‌های ${win} ارشد مهندسی کامپیوتر، میانگین وزنی لازم در هر سال و دانشگاه‌ها و گرایش‌هایی که این رتبه‌ها در آن‌ها قبول شدند؛ از ${int(d.n)} کارنامهٔ ۱۴۰۰ تا ۱۴۰۵.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: ["کارنامه و رتبه", "رتبهٔ قبولی", "تحلیل داده"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `رتبهٔ ${int(rank)} ارشد کامپیوتر: کارنامه و دانشگاه قبولی`,
      description: `رتبهٔ ${int(rank)} ارشد مهندسی کامپیوتر چند درصد است و کجا قبول می‌شود؟ کارنامهٔ معمول رتبه‌های ${win}، میانگین وزنی هر سال و دانشگاه‌های قبولی.`,
    },
    validity: { exam_year: 1406, time_sensitive: false },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: "کارنامه‌های ارشد مهندسی کامپیوتر ۱۴۰۰ تا ۱۴۰۵ کانال Konkur_answer و کارنامه‌های عمومی؛ فقط آمار تجمیعی",
        claim: `کارنامهٔ معمول و قبولی‌های رتبه‌های ${win} در سهمیهٔ آزاد`,
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
