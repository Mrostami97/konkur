// Builds an "how many kinds of report card does a rank band have" data article
// from analysis/archetype_stats.json: four types by maths and language strength
// (thresholds are round numbers near the band's medians); set 1277, free quota,
// 1400-1405; groups >= 10.
import { int, dec, pct, text, h2, h3, LINKS, envelope, load } from "./fmt.mjs";

const S = load("../analysis/archetype_stats.json", import.meta.url);
const T = [["both", "ریاضی و زبان هر دو قوی"], ["math", "فقط ریاضی قوی"], ["lang", "فقط زبان قوی"], ["neither", "ریاضی و زبان هر دو ضعیف"]];

export function archetypeArticle({ key, slug, band, title, seoTitle, intro, notes }) {
  const d = S[key], c = d.cfg;
  const share = (t) => d.types[t].share * 100;
  const blocks = [];
  const early = (t) => (100 * d.types[t].nEarly) / d.early, late = (t) => (100 * d.types[t].nLate) / d.late;

  blocks.push(text(intro));
  blocks.push(text(
    `داده: ${int(d.n)} کارنامهٔ سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) از ۱۴۰۰ تا ۱۴۰۵ که بهترین رتبهٔ داخل سهمیه‌شان ${band} است. هر کارنامه را با دو آستانه به یکی از چهار نوع تقسیم کردیم: ریاضی «قوی» یعنی ${int(c.math)}٪ یا بیشتر و زبان «قوی» یعنی ${int(c.lang)}٪ یا بیشتر. آستانه‌ها عدد گرد و نزدیک میانهٔ همین گروه‌اند و قانون رسمی نیستند. فقط آمار تجمیعی؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند.`,
  ));

  blocks.push(h2("چهار نوع کارنامه"));
  blocks.push({
    type: "table",
    headers: ["نوع کارنامه", "تعداد", "سهم", "میانهٔ رتبه", "میانگین چهار تخصصی", "میانهٔ ریاضی", "میانهٔ زبان", "میانهٔ معدل"],
    rows: T.map(([t, label]) => {
      const v = d.types[t];
      return [label, int(v.n), pct(100 * v.share), v.rank ? int(v.rank[1]) : "—", v.spec ? pct(v.spec[1]) : "—", v.math != null ? pct(v.math) : "—", v.lang != null ? pct(v.lang) : "—", v.gpa ? dec(v.gpa) : "—"];
    }),
  });
  blocks.push(text(notes.types));

  blocks.push(h2("این ترکیب در سال‌ها عوض شد"));
  blocks.push(text(`سهم هر نوع در ۱۴۰۰ تا ۱۴۰۳ (${int(d.early)} کارنامه) و در ۱۴۰۴ و ۱۴۰۵ (${int(d.late)} کارنامه):`));
  blocks.push({
    type: "table",
    headers: ["نوع کارنامه", "۱۴۰۰ تا ۱۴۰۳", "۱۴۰۴ و ۱۴۰۵"],
    rows: T.map(([t, label]) => [label, `${int(d.types[t].nEarly)} کارنامه (${pct(early(t))})`, `${int(d.types[t].nLate)} کارنامه (${pct(late(t))})`]),
  });
  blocks.push(text(notes.shift));

  blocks.push(h2("از این تقسیم‌بندی چه بگیریم؟"));
  blocks.push(text(notes.use));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(`رتبه‌های ${band} بیشتر چه کارنامه‌ای دارند؟`));
  const big = T.map(([t, label]) => [t, label]).sort((a, b) => d.types[b[0]].share - d.types[a[0]].share)[0];
  blocks.push(text(`بزرگ‌ترین گروه «${big[1]}» است: ${int(d.types[big[0]].n)} از ${int(d.n)} کارنامه (${pct(share(big[0]))}).`));
  blocks.push(h3(`چند درصد رتبه‌های ${band} ریاضی و زبان هر دو را ضعیف دارند؟`));
  blocks.push(text(`${pct(share("neither"))} در کل شش سال؛ ${pct(early("neither"))} در ۱۴۰۰ تا ۱۴۰۳ و ${pct(late("neither"))} در ۱۴۰۴ و ۱۴۰۵.`));
  blocks.push(h3(`چند درصد هر دو را قوی دارند؟`));
  blocks.push(text(`${pct(share("both"))} در کل؛ ${pct(early("both"))} در ۱۴۰۰ تا ۱۴۰۳ و ${pct(late("both"))} در ۱۴۰۴ و ۱۴۰۵.`));
  blocks.push(h3("ریاضی قوی و زبان ضعیف چطور؟"));
  blocks.push(text(`${pct(share("math"))} کارنامه‌ها؛ میانهٔ رتبه‌شان ${d.types.math.rank ? int(d.types.math.rank[1]) : "—"}.`));
  blocks.push(h3("این آستانه‌ها معیار رسمی‌اند؟"));
  blocks.push(text(`نه. ریاضی ${int(c.math)}٪ و زبان ${int(c.lang)}٪ را چون نزدیک میانهٔ همین گروه‌اند انتخاب کردیم؛ آستانه‌های دیگر تقسیم را کمی عوض می‌کند.`));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(d.n)} کارنامه (${int(d.early)} از ۱۴۰۰ تا ۱۴۰۳ و ${int(d.late)} از ۱۴۰۴ و ۱۴۰۵). نمونه فقط کارنامه‌های منتشرشده است.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("ببین کارنامه‌ات به کدام نوع نزدیک‌تر است و با ضرایب ۱۴۰۶ چه تغییری می‌کند. برای برنامه‌ریزی بر اساس نوع کارنامه‌ات در مشاوره کنارت هستیم."));
  blocks.push({ type: "link_group", items: [LINKS.calc, { label: "ضرایب ۱۴۰۶: چه کسانی جلو می‌افتند؟", href: "/articles/who-wins-under-1406-weights" }, LINKS.skip, LINKS.lang, LINKS.top, LINKS.consult] });

  const answer = `در کارنامه‌های ۱۴۰۰ تا ۱۴۰۵، ${pct(share("neither"))} رتبه‌های ${band} ریاضی (زیر ${int(c.math)}٪) و زبان (زیر ${int(c.lang)}٪) هر دو را ضعیف داشتند و ${pct(share("both"))} هر دو را قوی. این ترکیب عوض شد: ریاضی و زبانِ هر دو ضعیف از ${pct(early("neither"))} در ۱۴۰۰ تا ۱۴۰۳ به ${pct(late("neither"))} در ۱۴۰۴ و ۱۴۰۵ رسید و هر دو قوی از ${pct(early("both"))} به ${pct(late("both"))}.`;

  return envelope({
    slug,
    title,
    summary: `رتبه‌های ${band} ارشد مهندسی کامپیوتر را بر اساس قوی یا ضعیف بودن ریاضی و زبان به چهار نوع کارنامه تقسیم کردیم: سهم هر نوع، رتبه و درصدهایش و تغییرش در ۱۴۰۰ تا ۱۴۰۵.`,
    answer,
    blocks,
    tags: ["ریاضی", "زبان", "تحلیل داده"],
    seoTitle,
    seoDescription: `رتبه‌های ${band} ارشد مهندسی کامپیوتر چه نوع کارنامه‌ای دارند؟ چهار نوع بر اساس ریاضی و زبان، سهم و درصدهای هر نوع و تغییر ۱۴۰۰ تا ۱۴۰۵.`,
    claim: `سهم و میانه‌های چهار نوع کارنامه در رتبه‌های ${band}`,
    validity: { exam_year: 1406, time_sensitive: true, source_checked_at: "2026-09-29T00:00:00.000Z", review_due_at: "2026-12-15T00:00:00.000Z" },
  });
}
