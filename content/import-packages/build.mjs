// Validates each article against the site's article.v2 contract and writes an
// import package (payload.json inside a zip is made separately) plus a preview.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Paths are relative to this file so the script works from any checkout; run it
// from this folder after building contracts (pnpm --filter @konkurcom/contracts build).
const repo = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(`${repo}contracts/package.json`);
const { validateArticleV2 } = require(`${repo}contracts/dist/validators.js`);

const drafts = JSON.parse(await (await import("node:fs/promises")).readFile(`${repo}apps/api/src/seed-data/editorial-drafts.json`, "utf8")).articles;
const slugs = process.argv.slice(2);
for (const slug of slugs) {
  const article = (await import(pathToFileURL(`articles/${slug}.mjs`).href)).default;
  // A package that replaces a live article must keep its type and slug: the public
  // URL is /articles/ or /guides/ + slug, and moving it needs the owner's approval.
  const existing = drafts.find((d) => d.external_id === article.external_id);
  if (existing && (existing.content_type !== article.content_type || existing.slug !== article.slug)) {
    console.error(slug, "REFUSED: would move the live URL from", existing.content_type, existing.slug, "to", article.content_type, article.slug);
    process.exitCode = 1;
    continue;
  }
  const result = validateArticleV2(article);
  if (!(result === true || result?.valid === true || result?.ok === true)) {
    console.error(slug, "INVALID", JSON.stringify(result?.errors ?? validateArticleV2.errors ?? result, null, 1).slice(0, 2000));
    process.exitCode = 1;
    continue;
  }
  const dir = `packages/${slug}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/payload.json`, JSON.stringify([article], null, 2));

  const lines = [`# ${article.title}`, "", `> **پاسخ سریع:** ${article.quick_answer}`, "", `_${article.summary}_`, ""];
  for (const b of article.content_blocks) {
    if (b.type === "heading") lines.push(`${"#".repeat(b.level)} ${b.text}`, "");
    else if (b.type === "text") lines.push(b.text, "");
    else if (b.type === "quote") lines.push(`> ${b.text}`, `> — ${b.cite}`, "");
    else if (b.type === "table") lines.push(`| ${b.headers.join(" | ")} |`, `|${b.headers.map(() => "---").join("|")}|`, ...b.rows.map((r) => `| ${r.join(" | ")} |`), "");
    else if (b.type === "link_group") lines.push(...b.items.map((i) => `- [${i.label}](${i.href})`), "");
  }
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  await writeFile(`${dir}/preview.md`, lines.join("\n"));
  console.log(slug, "valid,", words, "words");
}
