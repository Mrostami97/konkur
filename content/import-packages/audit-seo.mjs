// SEO/AEO audit of built packages: node audit-seo.mjs [slug ...]
// Flags what search and answer engines reward: a snippet-length title and
// description, a short direct answer first, real question headings with answers
// (FAQ), tables, internal links and enough depth. Thresholds are guidance
// (Google shows ~60 title characters and ~155 description characters; answer
// engines quote a direct answer of roughly 40-70 words).
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
  if (a.seo.title.length > 60) issues.push(`seo.title ${a.seo.title.length}>60`);
  if (a.seo.description.length < 110) issues.push(`desc ${a.seo.description.length}<110`);
  if (a.seo.description.length > 165) issues.push(`desc ${a.seo.description.length}>165`);
  if (words(qa) > 85) issues.push(`answer ${words(qa)}w>85`);
  if (words(firstSentence) > 40) issues.push(`1st sentence ${words(firstSentence)}w`);
  if (faq.length < 6) issues.push(`faq ${faq.length}<6`);
  if (links.length < 5) issues.push(`links ${links.length}<5`);
  if (blocks.filter((b) => b.type === "table").length === 0) issues.push("no table");
  if (h2.length < 5) issues.push(`h2 ${h2.length}<5`);
  if (words(text) < 900) issues.push(`words ${words(text)}<900`);
  rows.push({ slug, type: a.content_type, titleLen: a.title.length, seoTitle: a.seo.title.length, desc: a.seo.description.length, answerWords: words(qa), faq: faq.length, h2: h2.length, tables: blocks.filter((b) => b.type === "table").length, links: links.length, words: words(text), issues });
}
console.table(rows.map(({ issues, ...r }) => r));
const counts = {};
for (const r of rows) for (const i of r.issues) { const k = i.replace(/[\d.]+/g, "#"); counts[k] = (counts[k] || 0) + 1; }
console.log("\nissue counts across", rows.length, "articles:", counts);
for (const r of rows.filter((x) => x.issues.length)) console.log(r.slug.padEnd(48), r.issues.join(" | "));
