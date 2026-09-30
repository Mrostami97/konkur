// Builds "rank by percentage of one box" data articles (specialised package,
// maths, language) from analysis/metric_stats.json: set 1277, free quota, 1403
// and 1404 cards with best in-quota rank <= 3000; groups >= 10.
import { int, pct, text, h2, h3, LINKS, envelope, SRC_1406, load } from "./fmt.mjs";

const S = load("../analysis/metric_stats.json", import.meta.url);

export function metricArticle({ key, slug, name, seoName, bandLabels, intro, note, y1406, faqLead, lessons = [], faq = [] }) {
  const rows = S[key];
  const ok = rows.map((r, i) => ({ ...r, label: bandLabels[i] })).filter((r) => r.rank);
  const small = rows.map((r, i) => ({ ...r, label: bandLabels[i] })).filter((r) => !r.rank);
  const first = ok[0], last = ok[ok.length - 1];
  const fmtRank = (r) => `${int(r.rank[0])} تا ${int(r.rank[2])}`;
  const blocks = [];

  blocks.push(text(intro));
  blocks.push(text(
    `داده: ${int(S.n)} کارنامهٔ سهمیهٔ آزاد ارشد مهندسی کامپیوتر (مجموعهٔ ۱۲۷۷) از ۱۴۰۳ (${int(S.byYear["1403"])} کارنامه) و ۱۴۰۴ (${int(S.byYear["1404"])}) که بهترین رتبهٔ داخل سهمیه‌شان ۳۰۰۰ یا بهتر است. این دو سال را انتخاب کردیم چون تعداد تست‌هایشان معلوم و ساختارشان به ۱۴۰۶ نزدیک‌تر است. «درصد تخصصی» میانگین چهار دسته‌درس تخصصی با وزن تعداد تست همان سال است. فقط آمار تجمیعی؛ گروه‌ها دست‌کم ۱۰ کارنامه‌اند.`,
  ));
  blocks.push(text("هشدار مهم: این کارنامه‌ها همهٔ داوطلب‌ها نیستند؛ بیشتر آن‌هایی‌اند که رتبهٔ خوبی گرفته و کارنامه‌شان را منتشر کرده‌اند. پس فقط ترتیب و اندازهٔ نسبی گروه‌ها معنی دارد، نه احتمال. و چون درصدها به هم وابسته‌اند، رابطه‌ها فقط همبستگی‌اند، نه اثر تنهای یک درس."));

  blocks.push(h2(`رتبه به‌ازای درصد ${name}`));
  blocks.push(text(`کارنامه‌ها را بر اساس درصد ${name} دسته‌بندی کردیم و میانهٔ بهترین رتبه‌شان را آوردیم. ستون‌های آخر میانهٔ دو درس دیگر را نشان می‌دهد تا ببینی گروه‌ها در چه چیزهای دیگری فرق دارند:`));
  blocks.push({
    type: "table",
    headers: [`درصد ${name}`, "تعداد کارنامه", "میانهٔ بهترین رتبه", "نیمهٔ وسط رتبه", "میانهٔ تخصصی", "میانهٔ ریاضی", "میانهٔ زبان"],
    rows: ok.map((r) => [r.label, int(r.n), int(r.rank[1]), fmtRank(r), pct(r.spec), pct(r.math), pct(r.lang)]),
  });
  if (small.length) blocks.push(text(`گروه‌های ${small.map((r) => `«${r.label}» (${int(r.n)} کارنامه)`).join(" و ")} کمتر از ۱۰ کارنامه دارند و در جدول نیامده‌اند.`));
  blocks.push(text(note));

  const yr = rows.map((r, i) => ({ ...r, label: bandLabels[i] })).filter((r) => r.y1403 && (r.y1403[1] != null || r.y1404[1] != null));
  if (yr.length) {
    blocks.push(h2(`همان درصد ${name}، در ۱۴۰۳ و ۱۴۰۴`));
    blocks.push(text("میانهٔ بهترین رتبه برای هر دسته، جدا برای هر سال. «—» یعنی کمتر از ۱۰ کارنامه در آن سال:"));
    blocks.push({ type: "table", headers: [`درصد ${name}`, "۱۴۰۳: تعداد", "۱۴۰۳: میانهٔ رتبه", "۱۴۰۴: تعداد", "۱۴۰۴: میانهٔ رتبه"], rows: yr.map((r) => [r.label, int(r.y1403[0]), r.y1403[1] == null ? "—" : int(r.y1403[1]), int(r.y1404[0]), r.y1404[1] == null ? "—" : int(r.y1404[1])]) });
  }
  if (lessons.length) { blocks.push(h2("این جدول‌ها چه می‌گویند؟")); for (const p of lessons) blocks.push(text(p)); }

  blocks.push(h2("چطور از این جدول استفاده کنم؟"));
  blocks.push(text(`• درصد ${name} آزمون‌های آزمایشی‌ات را پیدا کن و ردیف مربوط را بخوان؛ به «نیمهٔ وسط» نگاه کن، نه فقط میانه.
• به دو ستون آخر هم نگاه کن: اگر درس‌های دیگرت از میانهٔ آن ردیف پایین‌تر است، رتبه‌ات معمولاً بدتر از میانه می‌شود.
• جدول را با آزمون آزمایشی قبل از ۱۴۰۶ مقایسه نکن؛ ضرایب ۱۴۰۶ فرق دارد.
• برای تخمین رتبه از هر شش درصد و معدل، از ابزار تخمین رتبه استفاده کن.`));
  blocks.push(h2("در ۱۴۰۶ چه چیزی عوض می‌شود؟"));
  blocks.push(text(y1406));

  blocks.push(h2("پرسش‌های پرتکرار"));
  blocks.push(h3(faqLead.q1));
  blocks.push(text(faqLead.a1));
  for (const [q, a] of faq) { blocks.push(h3(q)); blocks.push(text(a)); }
  blocks.push(h3(`با ${faqLead.lowLabel} چه رتبه‌ای می‌آوردند؟`));
  blocks.push(text(`میانهٔ بهترین رتبهٔ کارنامه‌های «${first.label}» ${int(first.rank[1])} بود (نیمهٔ وسط ${fmtRank(first)}؛ ${int(first.n)} کارنامه).`));
  blocks.push(h3(`با ${faqLead.highLabel} چه رتبه‌ای می‌آوردند؟`));
  blocks.push(text(`میانهٔ بهترین رتبهٔ کارنامه‌های «${last.label}» ${int(last.rank[1])} بود (نیمهٔ وسط ${fmtRank(last)}؛ ${int(last.n)} کارنامه).`));
  blocks.push(h3("آیا این رابطه علت و معلول است؟"));
  blocks.push(text("نه. کارنامه‌هایی که در یک درس بالاترند معمولاً در درس‌های دیگر هم بالاترند؛ جدول بالا میانهٔ دو درس دیگر را کنارش گذاشته تا ببینی."));
  blocks.push(h3("این کارنامه‌ها همهٔ داوطلب‌ها هستند؟"));
  blocks.push(text("نه؛ فقط کارنامه‌های منتشرشده با رتبهٔ ۳۰۰۰ یا بهتر. برای همین احتمال قبولی یا رتبه را نمی‌شود مستقیم از آن‌ها خواند."));
  blocks.push(h3("چند کارنامه پشت این عددها است؟"));
  blocks.push(text(`${int(S.n)} کارنامه از ۱۴۰۳ و ۱۴۰۴. کوچک‌ترین گروهی که در جدول آمده ${int(Math.min(...ok.map((r) => r.n)))} کارنامه دارد.`));

  blocks.push(h2("قدم بعدی"));
  blocks.push(text("درصدهای آزمون‌هایت را در ابزار تخمین رتبه بزن. اگر می‌خواهی ببینی ضعف یا قوتت در کدام درس بیشتر به رتبه‌ات لطمه یا کمک می‌زند، در مشاوره کنارت هستیم."));
  blocks.push({ type: "link_group", items: [LINKS.calc, LINKS.value, LINKS.skip, LINKS.top, LINKS.net, LINKS.consult] });

  const answer = `در کارنامه‌های ۱۴۰۳ و ۱۴۰۴ ارشد کامپیوتر، میانهٔ بهترین رتبهٔ کارنامه‌های «${first.label}» در ${name} ${int(first.rank[1])} و کارنامه‌های «${last.label}» ${int(last.rank[1])} بود. ${answerTail(key, ok)} این‌ها فقط کارنامه‌های منتشرشده‌اند و رابطه‌ها همبستگی‌اند، نه اثر تنهای یک درس.`;

  return envelope({
    slug,
    title: `رتبه به‌ازای درصد ${name} در ارشد کامپیوتر: ${int(S.n)} کارنامه ۱۴۰۳ و ۱۴۰۴`,
    summary: `کارنامه‌های ۱۴۰۳ و ۱۴۰۴ ارشد مهندسی کامپیوتر را بر اساس درصد ${name} دسته‌بندی کردیم و میانهٔ رتبه و درصد دو درس دیگر هر دسته را آوردیم.`,
    answer,
    blocks,
    tags: [name, "تحلیل داده"],
    seoTitle: `رتبه به‌ازای درصد ${seoName || name}: ارشد کامپیوتر`,
    seoDescription: `با چند درصد ${name} چه رتبه‌ای در ارشد کامپیوتر می‌آوردند؟ میانهٔ رتبه و نیمهٔ وسط هر دسته از ${int(S.n)} کارنامهٔ ۱۴۰۳ و ۱۴۰۴.`,
    claim: `میانهٔ رتبهٔ کارنامه‌ها به تفکیک درصد ${name}`,
    extraSources: [SRC_1406],
    validity: { exam_year: 1406, time_sensitive: true, source_checked_at: "2026-09-29T00:00:00.000Z", review_due_at: "2026-12-15T00:00:00.000Z" },
  });
}

function answerTail(key, ok) {
  const mid = ok[Math.floor(ok.length / 2)];
  if (key === "spec") return "هر ۱۰ واحد درصد تخصصی رتبه را حدود ۲ تا ۴ برابر بهتر می‌کرد.";
  if (key === "math") return "این گروه‌ها در زبان و تخصصی هم فرق داشتند، پس همهٔ فاصله به ریاضی برنمی‌گردد.";
  return "رابطهٔ زبان با رتبه در این دو سال ضعیف و تا حدی غیریکنواخت بود.";
}
