import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "../apps/api/node_modules/typescript/lib/typescript.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "apps/web/src/content/editorial.ts");
const phase12SourcePath = resolve(projectRoot, "apps/web/src/content/phase12-corpus.json");
const outputPath = resolve(projectRoot, "apps/api/src/seed-data/editorial-drafts.json");

const source = await readFile(sourcePath, "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const commonJsModule = { exports: {} };
vm.runInNewContext(
  javascript,
  {
    exports: commonJsModule.exports,
    module: commonJsModule,
    require: () => { throw new Error("editorial.ts must not import runtime dependencies"); },
    __filename: sourcePath,
    __dirname: dirname(sourcePath),
    console,
    Date,
  },
  { filename: sourcePath },
);

const { guides, articles, editorialDateIso } = commonJsModule.exports;
const phase12Corpus = JSON.parse(await readFile(phase12SourcePath, "utf8"));
const phase12ReviewedAt = phase12Corpus.reviewedAt
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replaceAll("/", "-");
const phase12Guides = [...phase12Corpus.planningPages, ...phase12Corpus.officialPages].map((page) => ({
  ...page,
  author: "تحریریه kunkur01",
  reviewer: "در انتظار بازبینی انسانی",
  publishedAt: phase12ReviewedAt,
  reviewedAt: phase12ReviewedAt,
  sources: page.sourceIds.map((sourceId) => {
    const item = phase12Corpus.sources[sourceId];
    if (!item) throw new Error(`Unknown Phase 12 source: ${sourceId} (${page.slug})`);
    return { ...item, sourceArtifact: "apps/web/src/content/phase12-corpus.json" };
  }),
  relatedSubjects: page.internalLinks
    .map((item) => item.href.match(/^\/subjects\/([^/?#]+)/)?.[1])
    .filter(Boolean),
  sourceArtifact: "apps/web/src/content/phase12-corpus.json:" + page.slug,
  timeSensitive: page.kind === "OFFICIAL",
  producerType: "external_ai",
}));
const pages = [
  ...guides.map((page) => ({ ...page, contentType: "guide", sourceArtifact: "apps/web/src/content/editorial.ts:" + page.slug, producerType: "human" })),
  ...phase12Guides.map((page) => ({ ...page, contentType: "guide" })),
  ...articles.map((page) => ({ ...page, contentType: "article", sourceArtifact: "apps/web/src/content/editorial.ts:" + page.slug, producerType: "human" })),
];

const toAsciiDigits = (value) => value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
const sourceId = (source) => "editorial-source-" + createHash("sha256")
  .update([source.publisher, source.title, source.url].join("\n"))
  .digest("hex")
  .slice(0, 20);
const clamp = (value, max) => value.length <= max ? value : value.slice(0, max - 1).trim() + "…";
const checkedAt = (value) => {
  const normalized = toAsciiDigits(value ?? "");
  const writtenDate = normalized.match(/(\d{1,2})\s+شهریور\s+1405/);
  const numericDate = normalized.match(/^1405[/-]0?6[/-](\d{1,2})$/);
  const day = Number(writtenDate?.[1] ?? numericDate?.[1]);
  if (Number.isInteger(day) && day >= 1 && day <= 31) {
    // 1 Shahrivar 1405 is 23 August 2026. Date.UTC safely rolls into September.
    return new Date(Date.UTC(2026, 7, 22 + day)).toISOString();
  }
  throw new Error(`Unsupported editorial source review date: ${value}`);
};
const degrees = (degree) => degree === "هر دو" ? ["master", "phd"] : degree === "دکتری" ? ["phd"] : ["master"];

const blocksFor = (sections) => sections.flatMap((section) => {
  const blocks = [{ type: "heading", level: 2, text: section.title }];
  for (const paragraph of section.paragraphs ?? []) blocks.push({ type: "text", text: paragraph });
  if (section.bullets?.length) blocks.push({ type: "text", text: section.bullets.map((item) => "• " + item).join("\n") });
  if (section.table) blocks.push({ type: "table", headers: section.table.headers, rows: section.table.rows });
  if (section.note) blocks.push({ type: "quote", text: section.note });
  return blocks;
});

const allSources = new Map();
for (const page of pages) {
  for (const item of page.sources) {
    const externalId = sourceId(item);
    allSources.set(externalId, {
      externalId,
      kind: item.publisher === "kunkur01" ? "FIRST_PARTY_CHANNEL" : "WEB_PAGE",
      title: item.title,
      publisher: item.publisher,
      canonicalUrl: item.url,
      sourceTier: item.publisher.includes("سنجش") || item.publisher.includes("وزارت علوم") ? "PRIMARY_OFFICIAL" : item.publisher === "kunkur01" ? "FIRST_PARTY" : "SECONDARY",
      checkedAt: checkedAt(item.checkedAt),
      rightsBasis: item.publisher === "kunkur01" ? "OWNED_BY_PUBLISHER" : "LINK_ONLY",
      mayLink: true,
      mayAdapt: item.publisher === "kunkur01",
      commercialUseAllowed: item.publisher === "kunkur01",
      attributionText: item.publisher + " — " + item.title,
      metadata: { importedFrom: item.sourceArtifact ?? "apps/web/src/content/editorial.ts" },
    });
  }
}

const payloads = pages.map((page) => {
  const pageChecked = editorialDateIso(page.reviewedAt) + "T00:00:00.000Z";
  const timeSensitive = page.timeSensitive ?? (page.title.includes("۱۴۰۶") || page.description.includes("۱۴۰۶"));
  const examYear = page.validForYear ?? (page.title.includes("۱۴۰۶") || page.description.includes("۱۴۰۶") ? 1406 : undefined);
  return {
    schema_version: "article.v2",
    external_id: "static-editorial-" + page.slug,
    content_type: page.contentType,
    title: page.title,
    slug: page.slug,
    summary: page.description,
    quick_answer: page.quickAnswer ?? page.sections[0]?.paragraphs?.[0] ?? page.description,
    content_blocks: blocksFor(page.sections),
    taxonomy: {
      major: [page.field],
      tags: [page.category],
      degrees: degrees(page.degree),
      fields: [page.field],
      subject_codes: page.relatedSubjects ?? [],
      topic_codes: [],
    },
    seo: { title: clamp(page.title, 70), description: clamp(page.description, 160) },
    validity: {
      ...(examYear ? { exam_year: examYear } : {}),
      time_sensitive: timeSensitive,
      ...(timeSensitive ? { source_checked_at: pageChecked, review_due_at: "2026-11-30T00:00:00.000Z" } : {}),
    },
    sources: page.sources.map((item, order) => ({
      source_external_id: sourceId(item),
      relation: "SUPPORTS",
      locator: item.title,
      order,
    })),
    provenance: {
      producer_type: page.producerType,
      producer_name: page.producerType === "external_ai" ? "پیش‌نویس دستیار تحریریهٔ kunkur01" : "تحریریه kunkur01",
      source_artifact: page.sourceArtifact,
    },
    review_status: "draft",
  };
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ sources: [...allSources.values()], articles: payloads }, null, 2) + "\n", "utf8");
console.log("Generated " + payloads.length + " editorial drafts and " + allSources.size + " sources.");
