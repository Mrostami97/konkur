import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "apps/web/src/content/editorial.ts");
const phase12SourcePath = resolve(projectRoot, "apps/web/src/content/phase12-corpus.json");
const phase13SourcePath = resolve(projectRoot, "apps/web/src/content/phase13-corpus.json");
const phase17SourcePath = resolve(projectRoot, "apps/web/src/content/phase17-corpus.json");
const outputPath = resolve(projectRoot, "apps/api/src/seed-data/editorial-drafts.json");

let editorialModule;
if (process.features.typescript) {
  // Node 22.6+ can strip erasable TypeScript syntax itself. Keeping this path
  // lets editors regenerate the fixture without a prior workspace install.
  editorialModule = await import(pathToFileURL(sourcePath).href);
} else {
  // CI currently runs Node 20, so use the workspace-pinned compiler there.
  const { default: ts } = await import("../apps/api/node_modules/typescript/lib/typescript.js");
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
  editorialModule = commonJsModule.exports;
}

const { guides, articles, editorialDateIso } = editorialModule;
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
const phase13Corpus = JSON.parse(await readFile(phase13SourcePath, "utf8"));
const phase13Pages = [...phase13Corpus.decisionPages, ...phase13Corpus.caseStudies].map((page) => ({
  ...page,
  sections: page.kind === "CASE_STUDY" ? [
    {
      title: "معیار مستند این نمونه",
      paragraphs: [`معیار ثبت‌شده: ${page.metric}`],
      note: "این معیار فقط همان گزارش پیوندشده را توصیف می‌کند و تضمین یا پیش‌بینی نتیجهٔ داوطلب دیگری نیست.",
    },
    {
      title: "افشای تعارض منافع",
      paragraphs: [
        "منبع این مطالعهٔ موردی از آرشیو متعلق به مدرس و عرضه‌کنندهٔ دوره است؛ بنابراین ادعای عملکرد، تطبیق یا سابقه را گزارش دست‌اولِ دارای نفع تجاری بدان، نه ارزیابی مستقل.",
      ],
      note: "انتشار یا بازاستفاده از کارنامه و تصویر دانشجو منوط به ثبت رضایت صریح و قابل لغو است؛ تا پیش از آن، منبع فقط به‌صورت پیوند ارجاعی استفاده می‌شود.",
    },
    ...page.sections,
  ] : page.sections,
  author: "تحریریه kunkur01",
  reviewer: "در انتظار بازبینی انسانی",
  sources: page.sourceIds.map((sourceId) => {
    const item = phase13Corpus.sources[sourceId];
    if (!item) throw new Error(`Unknown Phase 13 source: ${sourceId} (${page.slug})`);
    const existingPhase12Source = Object.values(phase12Corpus.sources).find((candidate) =>
      candidate.publisher === item.publisher
      && candidate.title === item.title
      && candidate.url === item.url,
    );
    return {
      ...item,
      sourceArtifact: existingPhase12Source
        ? "apps/web/src/content/phase12-corpus.json"
        : "apps/web/src/content/phase13-corpus.json",
    };
  }),
  relatedSubjects: page.internalLinks
    .map((item) => item.href.match(/^\/subjects\/([^/?#]+)/)?.[1])
    .filter(Boolean),
  sourceArtifact: "apps/web/src/content/phase13-corpus.json:" + page.slug,
  producerType: "external_ai",
}));
const phase17Corpus = JSON.parse(await readFile(phase17SourcePath, "utf8"));
if (phase17Corpus.publicationStatus !== "DRAFT" || phase17Corpus.humanReviewRequired !== true) {
  throw new Error("Phase 17 content must remain DRAFT until a real human review is recorded");
}
const phase17Guides = phase17Corpus.pages.map((page) => ({
  ...page,
  author: "تحریریه kunkur01",
  reviewer: "در انتظار بازبینی انسانی",
  sources: page.sourceIds.map((sourceId) => {
    const item = phase17Corpus.sources[sourceId];
    if (!item) throw new Error(`Unknown Phase 17 source: ${sourceId} (${page.slug})`);
    const existingPhase12Source = Object.values(phase12Corpus.sources).find((candidate) =>
      candidate.publisher === item.publisher
      && candidate.title === item.title
      && candidate.url === item.url,
    );
    const existingPhase13Source = Object.values(phase13Corpus.sources).find((candidate) =>
      candidate.publisher === item.publisher
      && candidate.title === item.title
      && candidate.url === item.url,
    );
    return {
      ...item,
      sourceArtifact: existingPhase12Source
        ? "apps/web/src/content/phase12-corpus.json"
        : existingPhase13Source
          ? "apps/web/src/content/phase13-corpus.json"
          : "apps/web/src/content/phase17-corpus.json",
    };
  }),
  relatedSubjects: page.relatedSubjectCodes,
  sourceArtifact: "apps/web/src/content/phase17-corpus.json:" + page.slug,
  timeSensitive: true,
  producerType: "external_ai",
}));
const pages = [
  ...guides.map((page) => ({ ...page, contentType: "guide", sourceArtifact: "apps/web/src/content/editorial.ts:" + page.slug, producerType: "human" })),
  ...phase12Guides.map((page) => ({ ...page, contentType: "guide" })),
  ...phase13Pages.filter((page) => page.kind === "DECISION").map((page) => ({ ...page, contentType: "guide" })),
  ...phase17Guides.map((page) => ({ ...page, contentType: "guide" })),
  ...articles.map((page) => ({ ...page, contentType: "article", sourceArtifact: "apps/web/src/content/editorial.ts:" + page.slug, producerType: "human" })),
  ...phase13Pages.filter((page) => page.kind === "CASE_STUDY").map((page) => ({ ...page, contentType: "case_study" })),
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
const publishedAt = (value) => {
  const normalized = toAsciiDigits(value ?? "");
  const writtenDate = normalized.match(/^(\d{1,2})\s+تیر\s+1405$/);
  const day = Number(writtenDate?.[1]);
  if (Number.isInteger(day) && day >= 1 && day <= 31) {
    // 1 Tir 1405 is 22 June 2026. Date.UTC safely rolls into July.
    return new Date(Date.UTC(2026, 5, 21 + day)).toISOString();
  }
  const esfandDate = normalized.match(/^(\d{1,2})\s+اسفند\s+1404$/);
  const esfandDay = Number(esfandDate?.[1]);
  if (Number.isInteger(esfandDay) && esfandDay >= 1 && esfandDay <= 29) {
    // 1 Esfand 1404 is 20 February 2026. Date.UTC safely rolls into March.
    return new Date(Date.UTC(2026, 1, 19 + esfandDay)).toISOString();
  }
  // A year-only value is useful provenance but is not precise enough for a
  // DateTime column; retain it in metadata without inventing a month/day.
  if (/^\d{4}$/.test(normalized)) return undefined;
  throw new Error(`Unsupported editorial source publication date: ${value}`);
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
    const isReusableFirstParty = item.publisher === "kunkur01";
    const isFirstPartyMetadata = isReusableFirstParty
      || item.publisher.includes("آرشیو مستندات آموزشی محمد رستمی");
    const isPrimaryOfficial = item.publisher.includes("سنجش")
      || item.publisher.includes("وزارت علوم")
      || item.publisher.includes("سامانه ملی قوانین");
    const itemPublishedAt = item.publishedAt ? publishedAt(item.publishedAt) : undefined;
    allSources.set(externalId, {
      externalId,
      kind: isFirstPartyMetadata ? "FIRST_PARTY_CHANNEL" : "WEB_PAGE",
      title: item.title,
      publisher: item.publisher,
      canonicalUrl: item.url,
      sourceTier: isPrimaryOfficial ? "PRIMARY_OFFICIAL" : isFirstPartyMetadata ? "FIRST_PARTY" : "SECONDARY",
      checkedAt: checkedAt(item.checkedAt),
      ...(itemPublishedAt ? { publishedAt: itemPublishedAt } : {}),
      rightsBasis: isReusableFirstParty ? "OWNED_BY_PUBLISHER" : "LINK_ONLY",
      mayLink: true,
      mayAdapt: isReusableFirstParty,
      commercialUseAllowed: isReusableFirstParty,
      attributionText: item.publisher + " — " + item.title,
      metadata: {
        importedFrom: item.sourceArtifact ?? "apps/web/src/content/editorial.ts",
        ...(item.supportedClaim ? { supportedClaim: item.supportedClaim } : {}),
        ...(item.publishedAt ? { publishedAtText: item.publishedAt } : {}),
      },
    });
  }
}

const payloads = pages.map((page) => {
  const pageChecked = page.reviewedAt
    ? editorialDateIso(page.reviewedAt) + "T00:00:00.000Z"
    : page.sources.map((item) => checkedAt(item.checkedAt)).sort().at(-1);
  const timeSensitive = page.timeSensitive ?? (page.title.includes("۱۴۰۶") || page.description.includes("۱۴۰۶"));
  const examYear = page.examYear ?? page.validForYear ?? (page.title.includes("۱۴۰۶") || page.description.includes("۱۴۰۶") ? 1406 : undefined);
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
      ...(item.supportedClaim ? { claim: item.supportedClaim } : {}),
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
