import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EditorialPageView } from "../../../components/EditorialPageView";
import {
  PublicArticleView,
  publicArticlePath,
  type PublicArticleRecord,
  type RelatedPublicItem,
} from "../../../components/PublicContent";
import { findEditorialPage, guides } from "../../../content/editorial";
import {
  findPhase12EditorialPage,
  findPhase12Page,
  phase12EditorialPages,
} from "../../../content/phase12";
import { PUBLIC_PAGE_REVALIDATE, apiGetPublic } from "../../../lib/api";
import { loadGuideReviews, withReview } from "../../../lib/guide-reviews";
import { canonicalHref, isMergedGuide, withoutMergedGuides } from "../../../lib/merged-pages";
import { pageMetadata } from "../../../lib/seo";
import { relatedTaxonomyItems } from "../../../lib/related-taxonomy";

interface TaxonomyEntry {
  code: string;
  slug: string;
  title: string;
}

// Rendered on a page's first request and then served from cache for
// PUBLIC_PAGE_REVALIDATE seconds. Nothing is prerendered at build (the image is
// built without the API); the empty list is what makes the route cacheable.
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}
const cached = { revalidate: PUBLIC_PAGE_REVALIDATE };

async function loadGuide(slug: string) {
  try {
    return { article: await apiGetPublic<PublicArticleRecord>(`/articles/${encodeURIComponent(slug)}`, cached), unavailable: false };
  } catch {
    return { article: null, unavailable: true };
  }
}

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await pendingParams;
  const result = await loadGuide(params.slug);
  if (result.article) {
    return pageMetadata({
      title: result.article.seoTitle ?? result.article.title,
      description: result.article.seoDescription ?? result.article.summary,
      path: publicArticlePath(result.article),
      type: "article",
      publishedTime: result.article.publishedAt,
      modifiedTime: result.article.reviewedAt,
    });
  }
  const staticGuide = findEditorialPage(params.slug) ?? findPhase12EditorialPage(params.slug);
  if (staticGuide && [...guides, ...phase12EditorialPages].some((item) => item.slug === params.slug)) {
    return pageMetadata({ title: staticGuide.title, description: staticGuide.description, path: `/guides/${staticGuide.slug}`, type: "article" });
  }
  return {};
}

async function relatedTaxonomy(article: PublicArticleRecord): Promise<RelatedPublicItem[]> {
  try {
    const [subjects, topics] = await Promise.all([
      apiGetPublic<TaxonomyEntry[]>("/subjects", cached),
      apiGetPublic<TaxonomyEntry[]>("/topics", cached),
    ]);
    return relatedTaxonomyItems(article, subjects ?? [], topics ?? []);
  } catch {
    return relatedTaxonomyItems(article);
  }
}

export default async function GuidePage({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
  // next.config.mjs answers these first; this keeps the merge if that layer is bypassed.
  if (isMergedGuide(params.slug)) permanentRedirect(canonicalHref(`/guides/${params.slug}`));
  const result = await loadGuide(params.slug);
  const phase12 = findPhase12Page(params.slug);
  if (result.article) {
    // An article reached here is redirected to /articles by middleware.ts; if
    // that list was stale, the page still shows it, with its own canonical.
    const view = <PublicArticleView article={result.article} related={await relatedTaxonomy(result.article)} />;
    return phase12 ? <div data-phase12="verified-guide">{view}</div> : view;
  }
  const baseGuide = findEditorialPage(params.slug) ?? findPhase12EditorialPage(params.slug);
  const staticGuide = baseGuide && withReview(baseGuide, (await loadGuideReviews(cached)).get(baseGuide.slug));
  if (!staticGuide || ![...guides, ...phase12EditorialPages].some((item) => item.slug === params.slug)) {
    if (result.unavailable) throw new Error("Public content service is unavailable");
    notFound();
  }
  const view = (
    <EditorialPageView
      page={staticGuide}
      basePath="/guides"
      related={phase12?.internalLinks.map((item) => ({
        href: canonicalHref(item.href),
        title: item.title,
        label: item.label,
        summary: item.description,
      }))}
      showOfficialDisclaimer={!phase12 || phase12.kind === "OFFICIAL"}
    />
  );
  return phase12 ? <div data-phase12="verified-guide">{view}</div> : view;
}
