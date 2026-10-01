import { articles, editorialDateIso, guides, subjects } from "../content/editorial";
import { phase11DateIso, phase11SubjectContent, type Phase11SubjectSlug } from "../content/phase11";
import { phase12EditorialPages } from "../content/phase12";
import { isMergedGuide, withoutMergedGuides } from "./merged-pages";
import { apiGetPublic } from "./api";
import type { Availability } from "./availability";
import { absoluteUrl, articleModifiedTime } from "./seo";

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

type PublicCourse = {
  slug: string;
  updatedAt?: string | null;
};

type PublicResource = {
  slug: string;
  kind?: string;
  externalUrl?: string | null;
  publishedAt?: string | null;
  reviewedAt?: string | null;
  authorProfile?: { slug: string } | null;
  reviewerProfile?: { slug: string } | null;
};

type PublicAdmissionsCatalogItem = {
  code: string;
  source?: {
    checkedAt?: string | null;
  } | null;
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
    ...withoutMergedGuides([...guides, ...phase12EditorialPages]).filter((guide) => !publishedTypes.has(guide.slug) || publishedTypes.get(guide.slug) === "GUIDE").map((guide) => ({
      loc: absoluteUrl(`/guides/${guide.slug}`),
      lastmod: articleModifiedTime(editorialDateIso(guide.publishedAt), editorialDateIso(guide.reviewedAt)) ?? asIso(editorialDateIso(guide.publishedAt)),
    })),
    ...published
      .filter((article) => article.contentType === "GUIDE" && !isMergedGuide(article.slug))
      .map((article) => ({
        loc: absoluteUrl(`/guides/${article.slug}`),
        lastmod: articleModifiedTime(article.publishedAt, article.reviewedAt) ?? asIso(article.publishedAt),
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
      lastmod: articleModifiedTime(editorialDateIso(article.publishedAt), editorialDateIso(article.reviewedAt)) ?? asIso(editorialDateIso(article.publishedAt)),
    })),
    ...published
      .filter((article) => article.contentType !== "GUIDE")
      .map((article) => ({
        loc: absoluteUrl(`/articles/${article.slug}`),
        lastmod: articleModifiedTime(article.publishedAt, article.reviewedAt) ?? asIso(article.publishedAt),
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

export async function courseSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicCourse>("/courses");
  return {
    complete: loaded !== null,
    entries: uniqueEntries((loaded ?? []).map((course) => ({
      loc: absoluteUrl(`/courses/${course.slug}`),
      lastmod: asIso(course.updatedAt),
    }))),
  };
}

export async function resourceSitemapEntries(): Promise<SitemapCollection> {
  const loaded = await safeList<PublicResource>("/resources");
  const published = loaded ?? [];
  const authors = published.flatMap((resource) => [resource.authorProfile?.slug, resource.reviewerProfile?.slug]).filter((slug): slug is string => Boolean(slug));
  // The free-videos landing page lists only link-cleared external lectures;
  // it is indexable (and so belongs here) only while at least one exists.
  const hasFreeVideos = published.some((resource) => resource.kind === "VIDEO" && Boolean(resource.externalUrl));
  return { complete: loaded !== null, entries: uniqueEntries([
    { loc: absoluteUrl("/resources") },
    ...(hasFreeVideos ? [{ loc: absoluteUrl("/free-videos") }] : []),
    ...published.map((resource) => ({
      loc: absoluteUrl(`/resources/${resource.slug}`),
      lastmod: asIso(resource.reviewedAt ?? resource.publishedAt),
    })),
    ...authors.map((slug) => ({ loc: absoluteUrl(`/authors/${slug}`) })),
  ]) };
}

/**
 * The student-results page, only while it has published rows: with none it
 * renders noindex, and a sitemap must not list a page that asks not to be
 * indexed. An unreachable API leaves it out rather than failing the sitemap.
 */
export async function resultsSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const summary = await apiGetPublic<{ total: number }>("/achievements/summary");
    return summary && summary.total > 0 ? [{ loc: absoluteUrl("/results") }] : [];
  } catch {
    return [];
  }
}

/**
 * Listing pages that render a "coming soon" state -- and noindex -- while
 * their feature has nothing published, keyed by the availability count that
 * decides it. Like the results page, each is listed only while it has content,
 * and an unreachable API leaves them out (the pages are noindex then too).
 */
const LISTING_COUNTS: Record<string, keyof Availability> = {
  "/courses": "courses",
  "/exams": "exams",
  "/instructors": "instructors",
  "/consultations": "consultations",
  "/report-cards": "reportCards",
};

async function loadAvailability(): Promise<Availability | null> {
  try {
    return await apiGetPublic<Availability>("/site/availability");
  } catch {
    return null;
  }
}

/** The given paths, minus listing pages that currently have nothing on them. */
export async function withoutEmptyListings(paths: readonly string[]): Promise<string[]> {
  const availability = await loadAvailability();
  return paths.filter((path) => {
    const key = LISTING_COUNTS[path];
    return !key || Boolean(availability && availability[key]);
  });
}

export async function reportCardSitemapEntries(): Promise<SitemapEntry[]> {
  const paths = await withoutEmptyListings(["/report-cards"]);
  return paths.map((path) => ({ loc: absoluteUrl(path) }));
}

export async function admissionsSitemapEntries(): Promise<SitemapCollection> {
  const [universities, programs] = await Promise.all([
    safeList<PublicAdmissionsCatalogItem>("/universities"),
    safeList<PublicAdmissionsCatalogItem>("/programs"),
  ]);
  return {
    complete: universities !== null && programs !== null,
    entries: uniqueEntries([
      { loc: absoluteUrl("/admissions") },
      { loc: absoluteUrl("/programs") },
      ...(universities ?? []).map((university) => ({
        loc: absoluteUrl(`/universities/${encodeURIComponent(university.code)}`),
        lastmod: asIso(university.source?.checkedAt),
      })),
      ...(programs ?? []).map((program) => ({
        loc: absoluteUrl(`/programs/${encodeURIComponent(program.code)}`),
        lastmod: asIso(program.source?.checkedAt),
      })),
    ]),
  };
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
