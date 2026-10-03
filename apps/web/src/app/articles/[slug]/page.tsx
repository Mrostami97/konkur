import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { EditorialPageView } from "../../../components/EditorialPageView";
import {
  PublicArticleView,
  publicArticlePath,
  type PublicArticleRecord,
  type RelatedPublicItem,
} from "../../../components/PublicContent";
import { apiGetPublic } from "../../../lib/api";
import { articles, findEditorialPage } from "../../../content/editorial";
import { pageMetadata } from "../../../lib/seo";
import { relatedTaxonomyItems } from "../../../lib/related-taxonomy";

interface TaxonomyEntry {
  code: string;
  slug: string;
  title: string;
}

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

async function loadArticle(slug: string) {
  try {
    return { article: await apiGetPublic<PublicArticleRecord>(`/articles/${encodeURIComponent(slug)}`), unavailable: false };
  } catch {
    return { article: null, unavailable: true };
  }
}

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await pendingParams;
  const result = await loadArticle(params.slug);
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
  const legacy = findEditorialPage(params.slug);
  if (legacy && articles.some((item) => item.slug === params.slug)) {
    return pageMetadata({ title: legacy.title, description: legacy.description, path: `/articles/${legacy.slug}`, type: "article" });
  }
  return {};
}

async function relatedTaxonomy(article: PublicArticleRecord): Promise<RelatedPublicItem[]> {
  try {
    const [subjects, topics] = await Promise.all([
      apiGetPublic<TaxonomyEntry[]>("/subjects"),
      apiGetPublic<TaxonomyEntry[]>("/topics"),
    ]);
    return relatedTaxonomyItems(article, subjects ?? [], topics ?? []);
  } catch {
    return relatedTaxonomyItems(article);
  }
}

export default async function ArticlePage({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
  const result = await loadArticle(params.slug);
  if (result.article) {
    if (result.article.contentType === "GUIDE") permanentRedirect(`/guides/${result.article.slug}`);
    return <PublicArticleView article={result.article} related={await relatedTaxonomy(result.article)} />;
  }
  const legacy = findEditorialPage(params.slug);
  if (!legacy || !articles.some((item) => item.slug === params.slug)) {
    if (result.unavailable) throw new Error("Public content service is unavailable");
    notFound();
  }
  return <EditorialPageView page={legacy} basePath="/articles" />;
}
