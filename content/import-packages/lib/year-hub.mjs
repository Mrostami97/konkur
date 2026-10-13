// Turns a year's report-card analysis (articles/exam-YYYY-analysis.mjs) into
// the year's page for the computer-engineering master's exam: at a glance
// (questions per subject, which subjects 1406 keeps, links to everything about
// that year), the key as an answer sheet, then the analysis as it was. The slug
// stays; the title names what the page now answers. Data: analysis/bank_stats.json
// (questions per subject) and analysis/keys.json (lib/answer-keys.mjs).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bookletOf, keyBlock, keyLine } from "./answer-keys.mjs";

const BANK = JSON.parse(readFileSync(fileURLToPath(new URL("../analysis/bank_stats.json", import.meta.url)), "utf8")).ce;
const FA = "۰۱۲۳۴۵۶۷۸۹";
const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
const text = (t) => ({ type: "text", text: t });
const h2 = (t) => ({ type: "heading", level: 2, text: t });

/** Subjects of the 1406 exam of set 1277, as bank_stats names them. */
const IN_1406 = new Set(["زبان", "آمار و احتمال مهندسی", "ریاضیات گسسته", "نظریه زبان‌ها و ماشین‌ها", "داده‌ساختارها و الگوریتم‌ها", "هوش مصنوعی", "مدار منطقی", "معماری کامپیوتر", "سیستم‌های عامل"]);
const YEARS = [1400, 1401, 1402, 1403, 1404, 1405];

function hubBlocks(year) {
  const stats = BANK[year];
  const rows = Object.entries(stats.subjects);
  const kept = rows.filter(([name]) => IN_1406.has(name)).reduce((sum, [, n]) => sum + n, 0);
  const booklet = bookletOf("ce", year);
  const blocks = [h2(`کنکور ارشد مهندسی کامپیوتر ${fa(year)} در یک نگاه`)];
  blocks.push(text(`${fa(stats.total)} سؤال${booklet ? ` در دفترچهٔ ${booklet}` : ""}، از ${fa(rows.length)} درس. ${fa(kept)} سؤال از درس‌هایی بود که در کنکور ۱۴۰۶ هم هستند؛ همین‌ها بهترین تمرین برای ۱۴۰۶‌اند. ${keyLine("ce", year).replace(/^(کلید[^؛]*)؛ [۰-۹]+ سؤال\./, "کلید این صفحه، $1 است.")}`));
  blocks.push({
    type: "table",
    headers: ["درس", "تعداد تست", "در کنکور ۱۴۰۶"],
    rows: rows.map(([name, n]) => [name, fa(n), IN_1406.has(name) ? "هست" : "کنار رفت"]),
  });
  const items = [
    ...(year === 1405 ? [{ label: "حل تشریحی سؤالات ۱۴۰۵", href: "/articles/konkur-1405-computer-engineering-solutions" }] : []),
    { label: "کلید همهٔ سال‌ها در یک صفحه", href: "/articles/master-computer-answer-keys" },
    { label: "بودجه‌بندی هوشمند ۱۴۰۶", href: "/budget" },
    { label: "تخمین رتبه با درصدهای خودت", href: "/rank-calculator/master-computer-engineering" },
    { label: "کارنامهٔ رتبهٔ ۱۰۰ ارشد کامپیوتر", href: "/articles/master-computer-rank-100-report-card" },
    { label: "کنکورهای ارشد کامپیوتر سال‌به‌سال", href: "/articles/master-computer-exam-years-guide" },
  ];
  blocks.push({ type: "link_group", items });
  blocks.push(h2(`کلید کنکور ارشد مهندسی کامپیوتر ${fa(year)}`));
  blocks.push(text("هر خانه یک سؤال است و گزینهٔ درستش پر شده؛ سؤال‌هایی که کلید نهایی حذف یا دوکلیدی کرد روی همان خانه نوشته شده‌اند."));
  blocks.push(keyBlock("ce", year));
  return blocks;
}

/** Links to the other years' pages, for the end of the page. */
function otherYears(year) {
  return {
    type: "link_group",
    items: YEARS.filter((y) => y !== year).reverse().map((y) => ({ label: `کنکور ارشد مهندسی کامپیوتر ${fa(y)}`, href: `/articles/exam-${y}-analysis` })),
  };
}

export function withYearHub(year, article) {
  const blocks = article.content_blocks;
  const first = blocks.findIndex((b) => b.type === "heading");
  const cards = article.title.match(/([۰-۹]+) کارنامه/)?.[1];
  return {
    ...article,
    title: `کنکور ارشد مهندسی کامپیوتر ${fa(year)}: کلید، تعداد تست هر درس و درصد هر رتبه${cards ? ` از ${cards} کارنامه` : ""}`,
    summary: `کلید و تعداد تست هر درس کنکور ارشد مهندسی کامپیوتر ${fa(year)}، به‌همراه تحلیل کارنامه‌ها. ${article.summary}`,
    seo: {
      ...article.seo,
      title: `کنکور ارشد کامپیوتر ${fa(year)}: کلید، بودجه و درصد هر رتبه`,
      description: `کلید کنکور ارشد مهندسی کامپیوتر ${fa(year)} به شکل پاسخ‌برگ، تعداد تست هر درس، و درصد لازم برای هر رتبه از روی کارنامه‌های واقعی.`,
    },
    taxonomy: { ...article.taxonomy, tags: [...new Set([...(article.taxonomy.tags ?? []), "کلید", "بودجه‌بندی"])] },
    content_blocks: [...blocks.slice(0, first), ...hubBlocks(year), ...blocks.slice(first), otherYears(year)],
  };
}
