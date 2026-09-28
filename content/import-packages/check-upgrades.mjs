// Every number in an upgrade's new answer/FAQ must already appear in the
// article's own text (or tables): the overlay may re-phrase, never add facts.
import { readFile } from "node:fs/promises";
import upgrades from "./seo-upgrades.mjs";
const fa = "۰۱۲۳۴۵۶۷۸۹", norm = (s) => s.replace(/[۰-۹]/g, (d) => fa.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, "");
const nums = (s) => [...new Set(norm(s).match(/\d+(?:\.\d+)?/g) || [])];
let bad = 0;
for (const [slug, u] of Object.entries(upgrades)) {
  const orig = (await import(`./articles/${slug}.mjs`)).default;
  const hay = norm(JSON.stringify([orig.content_blocks, orig.quick_answer, orig.summary, orig.title]));
  const pieces = [u.answer, u.description, u.title, ...(u.faq || []).flat()].filter(Boolean);
  const miss = new Set();
  for (const p of pieces) for (const n of nums(p)) if (!hay.includes(n)) miss.add(n);
  const dupQ = (u.faq || []).filter(([q]) => JSON.stringify(orig.content_blocks).includes(q)).map(([q]) => q);
  if (miss.size || dupQ.length) { bad++; console.log(slug.padEnd(42), "missing:", [...miss].join(","), dupQ.length ? "DUP:" + dupQ.join("|") : ""); }
}
console.log("articles with unmatched numbers:", bad);
