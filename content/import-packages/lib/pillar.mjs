// Builds a pillar (hub) guide from lib/pillars.mjs. Every answer is copied from the
// linked article's own quick_answer (read from packages/<slug>/payload.json), so the
// hub adds structure and internal links, not new facts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PILLARS } from "./pillars.mjs";
import { fa, int, text, h2, h3, LINKS, envelope } from "./fmt.mjs";

const read = (slug) => {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL(`../packages/${slug}/payload.json`, import.meta.url)), "utf8"))[0];
  } catch {
    throw new Error(`pillar needs packages/${slug}/payload.json; build ${slug} first`);
  }
};
const href = (a) => `/${a.content_type === "guide" ? "guides" : "articles"}/${a.slug}`;

export function pillarArticle(slug) {
  const P = PILLARS.find((p) => p.slug === slug);
  if (!P) throw new Error(`unknown pillar ${slug}`);
  const blocks = [text(P.intro)];
  blocks.push({ type: "table", headers: ["بخش", "تعداد مطلب", "برای چه پرسشی؟"], rows: P.clusters.map((c) => [c[0], int(c[2].length), c[1].replace(/:$/, "")]) });
  let total = 0;
  for (const [heading, lead, slugs] of P.clusters) {
    const arts = slugs.map(read);
    total += arts.length;
    blocks.push(h2(heading));
    blocks.push(text(lead));
    for (const a of arts) {
      blocks.push(h3(a.title));
      blocks.push(text(a.quick_answer));
    }
    blocks.push({ type: "link_group", items: arts.map((a) => ({ label: a.title.split(":")[0].split("؟")[0] + (a.title.includes("؟") ? "؟" : ""), href: href(a) })) });
  }

  blocks.push(h2("پرسش‌های پرتکرار"));
  for (const [q, s] of P.faq) {
    const a = read(s);
    blocks.push(h3(q));
    blocks.push(text(a.quick_answer));
  }

  blocks.push(h2("چطور از این راهنما استفاده کنم؟"));
  blocks.push(text("• از بخشی شروع کن که به پرسش تو نزدیک‌تر است و پاسخ کوتاه را بخوان؛ اگر کافی نبود، متن کامل همان مطلب را باز کن.\n• عددها میانه‌ها و شمارش‌های تجمیعی‌اند، نه مرز قطعی. روش و محدودیت‌ها در مطلب «روش تحلیل کارنامه‌ها» آمده است.\n• برای ۱۴۰۶ ضرایب و تعداد تست‌ها عوض می‌شود؛ عددهای سال‌های قبل را با احتیاط تعمیم بده و رتبه‌ات را با ابزار تخمین رتبه بسنج."));
  blocks.push(h2("قدم بعدی"));
  blocks.push(text("درصدهای آزمون‌هایت را در ابزار تخمین رتبه بزن و مطلب‌های مربوط را بخوان. برای برنامه‌ریزی بر اساس وضعیت خودت در مشاوره کنارت هستیم."));
  blocks.push({ type: "link_group", items: [LINKS.calc, { label: "روش تحلیل کارنامه‌ها", href: "/articles/how-we-analyse-report-cards" }, ...PILLARS.filter((p) => p.slug !== slug).slice(0, 3).map((p) => ({ label: p.title.split(":")[0], href: `/guides/${p.slug}` })), LINKS.consult] });

  const clusterNames = P.clusters.map((c) => c[0]).join("، ");
  return envelope({
    contentType: "guide",
    slug: P.slug,
    title: P.title,
    summary: `${P.short}: ${int(total)} مطلب در ${int(P.clusters.length)} بخش (${clusterNames}) با پاسخ کوتاه هر مطلب و لینک متن کامل.`,
    answer: `این راهنما ${int(total)} مطلب دربارهٔ ${P.short} ارشد مهندسی کامپیوتر را در ${int(P.clusters.length)} بخش جمع کرده است: ${clusterNames}. هر بخش پاسخ کوتاه مطلب‌ها را می‌آورد و به متن کامل لینک می‌دهد. عددها از کارنامه‌های منتشرشدهٔ ۱۴۰۰ تا ۱۴۰۵ و جدول رسمی ۱۴۰۶ می‌آیند.`,
    blocks,
    tags: ["راهنمای جامع", P.short],
    seoTitle: P.seoTitle,
    seoDescription: P.seoDescription,
    claim: "فهرست و جمع‌بندی مطلب‌های پیوندشده؛ همهٔ عددها از خود آن مطلب‌ها",
    validity: { exam_year: 1406, time_sensitive: true, source_checked_at: "2026-09-30T00:00:00.000Z", review_due_at: "2026-12-15T00:00:00.000Z" },
  });
}
