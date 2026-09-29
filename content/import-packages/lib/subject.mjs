// Builds one "percentage of subject X by rank" data article from
// analysis/subject_stats.json (aggregates of report cards: set 1277, free quota,
// band = best in-quota rank over the four codes; groups >= 10, medians of >= 5).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STATS = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/subject_stats.json", import.meta.url)), "utf8"));
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]).replace(/\./g, "٫");
const int = (v) => fa(Math.round(v));
const one = (v) => fa((Math.round(v * 10) / 10).toFixed(1));
const pct = (v) => `${int(v)}٪`;
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });
const h3 = (t) => ({ type: "heading", level: 3, text: t });
const BANDS = ["1-30", "31-100", "101-300", "301-1000", "1001-3000"];
const BL = (b) => b.split("-").map(int).join(" تا ");
const YEARS = ["1400", "1401", "1402", "1403", "1404", "1405"];
const ORDER = Object.entries(STATS).sort((a, b) => b[1].corr - a[1].corr).map(([k]) => k);

export function subjectArticle({ idx, slug, name, seoName, tag, intro, note, y1406, perTest }) {
  const d = STATS[String(idx)];
  const R = d.recent, O = d.old;
  const blocks = [];
  const tests404 = R["1404|1-30"].tests, tests405 = R["1405|1-30"].tests;

  blocks.push(text(intro));
  blocks.push(text(
    `داده: کارنامه‌های سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) از ۱۴۰۰ تا ۱۴۰۵؛ ${int(d.nAll)} کارنامه بهترین رتبهٔ داخل سهمیه‌اش ۳۰۰۰ یا بهتر است. گروه رتبه با بهترین رتبهٔ کارنامه در چهار کد ضریب تعیین شده. ${name} در ۱۴۰۴ ${int(tests404)} تست و در ۱۴۰۵ ${int(tests405)} تست داشت. فقط آمار تجمیعی می‌آید و گروه‌ها دست‌کم ۱۰ کارنامه‌اند.`,
  ));

  blocks.push(h2(`درصد ${name} رتبه‌ها در سال‌های مختلف`));
  blocks.push(text("میانهٔ درصد هر گروه رتبه، به تفکیک سال. «—» یعنی کمتر از ۵ کارنامه؛ برای ۱۴۰۵ کارنامه‌ای پایین‌تر از رتبهٔ ۳۰۰ نداریم."));
  blocks.push({
    type: "table",
    headers: ["گروه رتبه", ...YEARS.map(fa)],
    rows: BANDS.map((b) => [BL(b), ...YEARS.map((y) => (d.byYear[b][y] ? pct(d.byYear[b][y][1]) : "—"))]),
  });
  blocks.push(text(note.years));

  blocks.push(h2("آزمون‌های اخیر: چارک‌ها و تست خالص"));
  blocks.push(text("برای ۱۴۰۴ و ۱۴۰۵ عدد کامل‌تر را ببین. «تست خالص» میانهٔ درصد ضرب در تعداد تست آن سال است، یعنی درست منهای یک‌سوم غلط."));
  const recentRows = [];
  for (const y of ["1404", "1405"]) {
    for (const b of BANDS) {
      const r = R[`${y}|${b}`];
      if (r) recentRows.push([`${fa(y)}، ${BL(b)}`, int(r.n), pct(r.med), `${int(r.q1)} تا ${int(r.q3)}٪`, pct(100 * r.zero), `حدود ${int(r.net)} از ${int(r.tests)}`]);
    }
  }
  blocks.push({ type: "table", headers: ["سال و گروه رتبه", "تعداد کارنامه", "میانه", "نیمهٔ وسط (چارک اول تا سوم)", "صفر یا منفی", "تست خالص"], rows: recentRows });
  blocks.push(text(note.recent));

  blocks.push(text("برای مقایسه، سال‌های ۱۴۰۰ تا ۱۴۰۳ را یک‌جا بگذار:"));
  blocks.push({
    type: "table",
    headers: ["گروه رتبه", "تعداد کارنامه", "میانه", "چارک سوم", "صفر یا منفی"],
    rows: BANDS.map((b) => [BL(b), int(O[b].n), pct(O[b].med), pct(O[b].q3), pct(100 * O[b].zero)]),
  });
  blocks.push(text(note.old));

  const pos = ORDER.indexOf(String(idx)) + 1;
  blocks.push(h2(`${name} با رتبهٔ نهایی چقدر همراه است؟`));
  blocks.push(text(
    `در ${int(d.nAll)} کارنامهٔ رتبهٔ ۳۰۰۰ یا بهتر، همبستگی رتبه‌ای درصد ${name} با بهترین رتبه ${fa(d.corr.toFixed(2))} است (۱ یعنی کامل، ۰ یعنی بی‌ارتباط). از شش جعبهٔ کارنامه، این درس ${fa(pos)}‌امین همراه رتبه است. همبستگی علت نیست: درسی که با رتبه همراه است لزوماً بیشترین وزن را در محاسبه ندارد؛ یعنی فقط می‌گوید رتبه‌های خوب در آن چه‌قدر از بقیه جدا می‌شوند.`,
  ));

  blocks.push(h2("در ۱۴۰۶ چه چیزی عوض می‌شود؟"));
  blocks.push(text(y1406));
  blocks.push(text(perTest));

  blocks.push(h2("پرسش‌های پرتکرار"));
  const r1 = (y, b) => R[`${y}|${b}`];
  blocks.push(h3(`رتبهٔ زیر ۱۰۰ در ${name} چند درصد می‌زند؟`));
  blocks.push(text(`در ۱۴۰۴ میانهٔ رتبه‌های ۱ تا ۳۰ ${pct(r1("1404", "1-30").med)} و رتبه‌های ۳۱ تا ۱۰۰ ${pct(r1("1404", "31-100").med)} بود؛ در ۱۴۰۵ به‌ترتیب ${pct(r1("1405", "1-30").med)} و ${pct(r1("1405", "31-100").med)}. نیمهٔ وسط این گروه‌ها پهن است، پس این عددها هدف قطعی نیستند.`));
  blocks.push(h3(`رتبهٔ ۱۰۱ تا ۳۰۰ در ${name} چند درصد دارد؟`));
  blocks.push(text(`در ۱۴۰۴ میانه ${pct(r1("1404", "101-300").med)} (نیمهٔ وسط ${int(r1("1404", "101-300").q1)} تا ${int(r1("1404", "101-300").q3)}٪) و در ۱۴۰۵ ${pct(r1("1405", "101-300").med)} بود.`));
  blocks.push(h3(`چند تست خالص ${name} برای رتبهٔ خوب لازم است؟`));
  blocks.push(text(`در ۱۴۰۴ میانهٔ رتبه‌های ۳۱ تا ۱۰۰ حدود ${int(r1("1404", "31-100").net)} تست خالص از ${int(tests404)} و رتبه‌های ۱۰۱ تا ۳۰۰ حدود ${int(r1("1404", "101-300").net)} تست خالص داشتند. تست خالص یعنی درست منهای یک‌سوم غلط.`));
  blocks.push(h3(`چند درصد رتبه‌های خوب ${name} را صفر می‌زنند؟`));
  blocks.push(text(`در ۱۴۰۰ تا ۱۴۰۳، ${pct(100 * O["31-100"].zero)} رتبه‌های ۳۱ تا ۱۰۰ و ${pct(100 * O["101-300"].zero)} رتبه‌های ۱۰۱ تا ۳۰۰ این درس را صفر یا منفی زده بودند. در ۱۴۰۴ این سهم‌ها ${pct(100 * r1("1404", "31-100").zero)} و ${pct(100 * r1("1404", "101-300").zero)} شد.`));
  blocks.push(h3(`آیا ${name} برای رتبه مهم است؟`));
  blocks.push(text(`همبستگی رتبه‌ای آن با بهترین رتبه ${fa(d.corr.toFixed(2))} است؛ ${fa(pos)}‌امین از شش درس. اهمیتش در ۱۴۰۶ به ضریب و تعداد تست بستگی دارد؛ بخش «در ۱۴۰۶ چه چیزی عوض می‌شود؟» را ببین.`));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(d.nAll)} کارنامهٔ سهمیهٔ آزاد که بهترین رتبه‌شان ۳۰۰۰ یا بهتر است. کوچک‌ترین گروه ۱۰ کارنامه دارد؛ گروه‌های کوچک را با احتیاط بخوان.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text(`درصد ${name} آزمون‌های آزمایشی‌ات را کنار جدول‌های بالا بگذار. اگر نمی‌دانی وقتت را بین درس‌ها چطور تقسیم کنی، در مشاوره با هم برنامه می‌چینیم.`));
  blocks.push({
    type: "link_group",
    items: [
      { label: "ابزار تخمین رتبهٔ ارشد مهندسی کامپیوتر", href: "/rank-calculator/master-computer-engineering" },
      { label: "ارزش هر تست در ۱۴۰۶", href: "/articles/value-of-a-test-1406" },
      { label: "برای هر رتبه چند تست خالص لازم است؟", href: "/articles/net-tests-per-rank" },
      { label: "رتبهٔ زیر ۱۰۰ چند درصد می‌خواهد؟", href: "/articles/top-rank-percentages" },
      { label: "کدام درس را می‌شود نخواند؟", href: "/articles/which-subject-to-skip" },
      { label: "تعداد تست و ضریب دروس", href: "/articles/questions-and-coefficients" },
      { label: "مشاوره", href: "/consultations" },
    ],
  });

  const a4 = r1("1404", "31-100"), a5 = r1("1405", "31-100"), b4 = r1("1404", "101-300"), b5 = r1("1405", "101-300");
  const answer = `در ۱۴۰۴ و ۱۴۰۵ رتبه‌های ۳۱ تا ۱۰۰ ارشد مهندسی کامپیوتر در ${name} میانهٔ ${int(a4.med)} تا ${int(a5.med)} درصد داشتند (حدود ${int(a4.net)} تا ${int(a5.net)} تست خالص). رتبه‌های ۱۰۱ تا ۳۰۰ میانهٔ ${int(b4.med)} تا ${int(b5.med)} درصد داشتند. این درس با همبستگی ${fa(d.corr.toFixed(2))} ${fa(pos)}‌امین درس همراه رتبه است.`;

  return {
    schema_version: "article.v2",
    external_id: `kunkurcomputer-data-${slug}`,
    content_type: "article",
    title: `درصد ${name} رتبه‌های ارشد کامپیوتر: از ${int(d.nAll)} کارنامه`,
    slug,
    summary: `رتبه‌های ۱ تا ۳۰۰۰ ارشد مهندسی کامپیوتر در ${name} چند درصد زده‌اند؟ میانه، چارک‌ها، تست خالص و سهم صفر در ۱۴۰۰ تا ۱۴۰۵ از ${int(d.nAll)} کارنامه.`,
    quick_answer: answer,
    content_blocks: blocks,
    taxonomy: { major: ["کامپیوتر و IT"], tags: [tag, "کارنامه و رتبه", "تحلیل داده"], degrees: ["master"], fields: ["کامپیوتر و IT"], subject_codes: [], topic_codes: [] },
    seo: {
      title: `درصد ${seoName || name} رتبه‌های ارشد کامپیوتر: ${int(d.nAll)} کارنامه`,
      description: `رتبه‌های زیر ۱۰۰ و ۳۰۰ ارشد مهندسی کامپیوتر در ${name} چند درصد زدند؟ میانه، چارک‌ها و تست خالص ۱۴۰۰ تا ۱۴۰۵ و تغییر ۱۴۰۶.`,
    },
    validity: { exam_year: 1406, time_sensitive: true, source_checked_at: "2026-09-29T00:00:00.000Z", review_due_at: "2026-12-15T00:00:00.000Z" },
    sources: [
      {
        source_external_id: "editorial-source-08110ffe99548a591190",
        relation: "SUPPORTS",
        locator: "فایل‌های کارنامهٔ ارشد مهندسی کامپیوتر ۱۴۰۰ و ۱۴۰۱ کانال Konkur_answer و کارنامه‌های عمومی ۱۴۰۰ تا ۱۴۰۵؛ فقط آمار تجمیعی",
        claim: `میانه‌ها، چارک‌ها و شمارش‌های ${name} از کارنامه‌های سهمیهٔ آزاد با رتبهٔ ۳۰۰۰ یا بهتر`,
        order: 0,
      },
      {
        source_external_id: "editorial-source-50f3b52142efac0715d8",
        relation: "SUPPORTS",
        locator: "اطلاعیه و جدول مجموعه‌های امتحانی کارشناسی ارشد ناپیوسته سال ۱۴۰۶",
        claim: "ضرایب زبان ۱، ریاضیات ۲ و بستهٔ تخصصی ۴ و فهرست مواد مجموعهٔ ۱۲۷۷ در ۱۴۰۶",
        order: 1,
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
