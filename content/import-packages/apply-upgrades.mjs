// Overlay of SEO/AEO upgrades (snippet-length title/description, a direct short
// answer, extra FAQ pairs, extra internal links) applied by build.mjs on top of
// each article. Kept in seo-upgrades.mjs so the article sources stay readable.
import upgrades from "./seo-upgrades.mjs";
import { PILLARS, pillarOf } from "./lib/pillars.mjs";

// Courses live on the site (checked against /api/courses before adding).
const COURSES = [
  {
    items: [
      { label: "دورهٔ درس‌نامهٔ ساختمان داده و الگوریتم", href: "/courses/data-structures-algorithms" },
      { label: "دورهٔ حل تست ساختمان داده و الگوریتم", href: "/courses/data-structures-algorithms-tests" },
    ],
    slugs: [
      "data-structures-algorithms-percentage-by-rank", "hashing-longest-chain", "recurrences-master-theorem",
      "union-find-linear-sorting", "amortized-analysis", "huffman-code-greedy", "np-complete-reductions",
      "coefficient-code-2-artificial-intelligence", "coefficient-code-4-software", "master-computer-references-1406",
      "master-computer-1406-preparation-guide", "master-computer-subjects-and-coefficients-guide",
      "small-orientations-bioinformatics-algorithms-data-science", "strongest-and-weakest-specialised-subject",
    ],
  },
];

export function applyUpgrade(slug, article) {
  const u = upgrades[slug] || {};
  const a = structuredClone(article);
  if (u.title) a.seo.title = u.title;
  if (u.description) a.seo.description = u.description;
  if (u.answer) a.quick_answer = u.answer;
  const blocks = a.content_blocks;
  if (u.faq?.length) {
    // insert after the last existing FAQ answer; otherwise before the final h2
    let at = -1;
    blocks.forEach((b, i) => {
      if (b.type === "heading" && b.level === 3 && /[؟?]\s*$/.test(b.text) && blocks[i + 1]?.type === "text") at = i + 1;
    });
    if (at < 0) throw new Error(`${slug}: no FAQ block to extend`);
    const extra = u.faq.flatMap(([q, ans]) => [{ type: "heading", level: 3, text: q }, { type: "text", text: ans }]);
    blocks.splice(at + 1, 0, ...extra);
  }
  if (u.links?.length) {
    const groups = blocks.filter((b) => b.type === "link_group");
    const g = groups[groups.length - 1];
    if (!g) throw new Error(`${slug}: no link_group to extend`);
    for (const [label, href] of u.links) if (!g.items.some((i) => i.href === href)) g.items.push({ label, href });
  }
  // published courses: link the articles about their subject to them (first in the list)
  for (const c of COURSES) {
    if (!c.slugs.includes(slug)) continue;
    const g = blocks.filter((b) => b.type === "link_group").pop();
    if (g) for (const item of [...c.items].reverse()) if (!g.items.some((i) => i.href === item.href)) g.items.unshift(item);
  }
  // link every cluster article back to its hub guide(s)
  if (!PILLARS.some((p) => p.slug === slug)) {
    const g = blocks.filter((b) => b.type === "link_group").pop();
    if (g) for (const p of pillarOf(slug).slice(0, 2)) if (!g.items.some((i) => i.href === `/guides/${p.slug}`)) g.items.push({ label: `راهنمای کامل: ${p.short}`, href: `/guides/${p.slug}` });
  }
  return a;
}
