import { articles, editorialDateIso, guides, subjects } from "../content/editorial";
import { phase11DateIso, phase11SubjectContent, type Phase11SubjectSlug } from "../content/phase11";
import { phase12EditorialPages } from "../content/phase12";
import { apiGetPublic } from "./api";
import { absoluteUrl } from "./seo";

type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
};

export type SitemapCollection = {
  entries: SitemapEntry[];
  complete: boolean;
};

type PublicArticle = {
  slug: string;
  contentType?: string | null;
  publishedAt?: string | null;
  reviewedAt?: string | null;
  updatedAt?: string | null;
  authorProfile?: { slug: string } | null;
  reviewerProfile?: { slug: string } | null;
};

type PublicTaxonomy = {
  slug: string;
  updatedAt?: string | null;
};

type PublicResource = {
  slug: string;
  publishedAt?: string | null;
  reviewedAt?: string | null;
  authorProfile?: { slug: string } | null;
  reviewerProfile?: { slug: string } | null;
};

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '\"': "&quot;",
  })[character] ?? character);
}

function asIso(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function uniqueEntries(entries: SitemapEntry[]) {
  const result = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    const existing = result.get(entry.loc);
    if (!existing || (entry.lastmod && (!existing.lastmod || entry.lastmod > existing.lastmod))) {
      result.set(entry.loc, entry);
    }
  }
  return [...result.values()].sort((left, right) => left.loc.localeCompare(right.loc));
}

async function safeList<T>(path: string): Promise<T[] | null> {
  try {
    const value = await apiGetPublic<T[]>(path);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export async function guideSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicArticle>("/articles");
  const published = loaded ?? [];
  const publishedTypes = new Map(published.map((article) => [article.slug, article.contentType]));
  return { complete: loaded !== null, entries: uniqueEntries([
    { loc: absoluteUrl("/guides") },
    ...[...guides, ...phase12EditorialPages].filter((guide) => !publishedTypes.has(guide.slug) || publishedTypes.get(guide.slug) === "GUIDE").map((guide) => ({
      loc: absoluteUrl(`/guides/${guide.slug}`),
      lastmod: asIso(editorialDateIso(guide.reviewedAt)),
    })),
    ...published
      .filter((article) => article.contentType === "GUIDE")
      .map((article) => ({
        loc: absoluteUrl(`/guides/${article.slug}`),
        lastmod: asIso(article.reviewedAt ?? article.updatedAt ?? article.publishedAt),
      })),
  ]) };
}

export async function articleSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicArticle>("/articles");
  const published = loaded ?? [];
  const publishedTypes = new Map(published.map((article) => [article.slug, article.contentType]));
  const authors = published.flatMap((article) => [article.authorProfile?.slug, article.reviewerProfile?.slug]).filter((slug): slug is string => Boolean(slug));
  return { complete: loaded !== null, entries: uniqueEntries([
    { loc: absoluteUrl("/articles") },
    ...articles.filter((article) => !publishedTypes.has(article.slug) || publishedTypes.get(article.slug) !== "GUIDE").map((article) => ({
      loc: absoluteUrl(`/articles/${article.slug}`),
      lastmod: asIso(editorialDateIso(article.reviewedAt)),
    })),
    ...published
      .filter((article) => article.contentType !== "GUIDE")
      .map((article) => ({
        loc: absoluteUrl(`/articles/${article.slug}`),
        lastmod: asIso(article.reviewedAt ?? article.updatedAt ?? article.publishedAt),
      })),
    ...authors.map((slug) => ({ loc: absoluteUrl(`/authors/${slug}`) })),
  ]) };
}

export async function subjectSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicTaxonomy>("/subjects");
  const published = loaded ?? [];
  return { complete: loaded !== null, entries: uniqueEntries([
    { loc: absoluteUrl("/subjects") },
    ...subjects.map((subject) => {
      const phase11 = phase11SubjectContent[subject.slug as Phase11SubjectSlug];
      return {
        loc: absoluteUrl(`/subjects/${subject.slug}`),
        lastmod: phase11 ? asIso(phase11DateIso(phase11.reviewedAt)) : undefined,
      };
    }),
    ...published.map((subject) => ({ loc: absoluteUrl(`/subjects/${subject.slug}`), lastmod: asIso(subject.updatedAt) })),
  ]) };
}

export async function topicSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicTaxonomy>("/topics");
  const published = loaded ?? [];
  return { complete: loaded !== null, entries: uniqueEntries(published.map((topic) => ({
    loc: absoluteUrl(`/topics/${topic.slug}`),
    lastmod: asIso(topic.updatedAt),
  }))) };
}

export async function resourceSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicResource>("/resources");
  const published = loaded ?? [];
  const authors = published.flatMap((resource) => [resource.authorProfile?.slug, resource.reviewerProfile?.slug]).filter((slug): slug is string => Boolean(slug));
  return { complete: loaded !== null, entries: uniqueEntries([
    { loc: absoluteUrl("/resources") },
    ...published.map((resource) => ({
      loc: absoluteUrl(`/resources/${resource.slug}`),
      lastmod: asIso(resource.reviewedAt ?? resource.publishedAt),
    })),
    ...authors.map((slug) => ({ loc: absoluteUrl(`/authors/${slug}`) })),
  ]) };
}

export function reportCardSitemapEntries() {
  return [{ loc: absoluteUrl("/report-cards") }];
}

export function sitemapXml(entries: SitemapEntry[]) {
  const urls = uniqueEntries(entries).map((entry) => (
    `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}</url>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function sitemapResponse(entries: SitemapEntry[], complete = true) {
  return new Response(sitemapXml(entries), {
    status: complete ? 200 : 503,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": complete ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      ...(complete ? {} : { "Retry-After": "300" }),
    },
  });
}
