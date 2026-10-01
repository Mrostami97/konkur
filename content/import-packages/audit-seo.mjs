// SEO/AEO audit of built packages: node audit-seo.mjs [slug ...]
// Report structural/content defects and descriptive metrics. Google has no
// ideal word count, fixed title character limit, FAQ quota, or special AEO
// markup requirement. FAQ/table/link counts are observations, not ranking
// scores. See developers.google.com/search/docs/fundamentals/ai-optimization-guide.
import { readdir, readFile } from "node:fs/promises";

const slugs = process.argv.length > 2 ? process.argv.slice(2) : (await readdir("packages")).sort();
const words = (t) => (t.match(/[\p{L}\p{N}]+/gu) || []).length;
const rows = [];
for (const slug of slugs) {
  const payload = JSON.parse(await readFile(`packages/${slug}/payload.json`, "utf8"));
  const a = Array.isArray(payload) ? payload[0] : payload;
  const blocks = a.content_blocks;
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join(" ");
  const h2 = blocks.filter((b) => b.type === "heading" && b.level === 2);
  const faq = [];
  blocks.forEach((b, i) => {
    if (b.type === "heading" && b.level === 3 && /[؟?]\s*$/.test(b.text) && blocks[i + 1]?.type === "text") faq.push(b.text);
  });
  const links = blocks.filter((b) => b.type === "link_group").flatMap((b) => b.items);
  const qa = a.quick_answer || "";
  const firstSentence = qa.split(/[.؟!]\s/)[0];
  const issues = [];
  if (!a.seo.title?.trim()) issues.push("missing SEO title");
  if (!a.seo.description?.trim()) issues.push("missing description");
  if (!qa.trim()) issues.push("missing direct answer");
  if (blocks.some((b) => b.type === "heading" && b.level === 1)) issues.push("body repeats the page H1");
  if (blocks.some((b) => b.type === "image" && !b.alt?.trim())) issues.push("image missing alt text");
  if (!a.sources?.length) issues.push("missing sources");
  if (links.some((item) => !/^\/[A-Za-z0-9][A-Za-z0-9/_-]*(?:[?#][^\s]*)?$/.test(item.href))) issues.push("invalid internal link");
  rows.push({ slug, type: a.content_type, titleLen: a.title.length, seoTitle: a.seo.title.length, desc: a.seo.description.length, answerWords: words(qa), faq: faq.length, h2: h2.length, tables: blocks.filter((b) => b.type === "table").length, links: links.length, words: words(text), issues });
}
console.table(rows.map(({ issues, ...r }) => r));
const counts = {};
for (const r of rows) for (const i of r.issues) { const k = i.replace(/[\d.]+/g, "#"); counts[k] = (counts[k] || 0) + 1; }
console.log("\nissue counts across", rows.length, "articles:", counts);
for (const r of rows.filter((x) => x.issues.length)) console.log(r.slug.padEnd(48), r.issues.join(" | "));
