import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditorialPageView } from "../../../components/EditorialPageView";
import {
  PublicArticleView,
  publicArticlePath,
  type PublicArticleRecord,
  type RelatedPublicItem,
} from "../../../components/PublicContent";
import { findEditorialPage, guides } from "../../../content/editorial";
import { apiGetPublic } from "../../../lib/api";
import { pageMetadata } from "../../../lib/seo";

interface TaxonomyEntry {
  code: string;
  slug: string;
  title: string;
}

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

async function loadGuide(slug: string) {
  try {
    return { article: await apiGetPublic<PublicArticleRecord>(`/articles/${encodeURIComponent(slug)}`), unavailable: false };
  } catch {
    return { article: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadGuide(params.slug);
  if (result.article) {
    return pageMetadata({
      title: result.article.seoTitle ?? result.article.title,
      description: result.article.seoDescription ?? result.article.summary,
      path: publicArticlePath(result.article),
      type: "article",
    });
  }
  const legacy = findEditorialPage(params.slug);
  if (legacy && guides.some((item) => item.slug === params.slug)) {
    return pageMetadata({ title: legacy.title, description: legacy.description, path: `/guides/${legacy.slug}`, type: "article" });
  }
  return {};
}

async function relatedTaxonomy(article: PublicArticleRecord): Promise<RelatedPublicItem[]> {
  try {
    const [subjects, topics] = await Promise.all([
      apiGetPublic<TaxonomyEntry[]>("/subjects"),
      apiGetPublic<TaxonomyEntry[]>("/topics"),
    ]);
    const subjectCodes = new Set(article.subjectCodes);
    const topicCodes = new Set(article.topicCodes);
    return [
      ...(subjects ?? []).filter((item) => subjectCodes.has(item.code)).map((item) => ({ href: `/subjects/${item.slug}`, title: item.title, label: "درس" })),
      ...(topics ?? []).filter((item) => topicCodes.has(item.code)).map((item) => ({ href: `/topics/${item.slug}`, title: item.title, label: "مبحث" })),
    ].slice(0, 6);
  } catch {
    return [];
  }
}

export default async function GuidePage({ params }: { params: { slug: string } }) {
  const result = await loadGuide(params.slug);
  if (result.article) {
    if (result.article.contentType !== "GUIDE") redirect(`/articles/${result.article.slug}`);
    return <PublicArticleView article={result.article} related={await relatedTaxonomy(result.article)} />;
  }
  const legacy = findEditorialPage(params.slug);
  if (!legacy || !guides.some((item) => item.slug === params.slug)) notFound();
  return <EditorialPageView page={legacy} basePath="/guides" />;
}
