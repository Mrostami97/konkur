import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialPageView } from "../../../components/EditorialPageView";
import { apiGetPublic } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";
import { articles, findEditorialPage } from "../../../content/editorial";
import { pageMetadata } from "../../../lib/seo";

interface Article {
  title: string;
  summary: string;
  contentBlocks: { type: string; [key: string]: unknown }[];
  assets: { media_key: string; checksum: string }[];
  publishedAt: string;
}

export function generateStaticParams() { return articles.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const local = findEditorialPage(params.slug);
  if (local) return pageMetadata({ title: local.title, description: local.description, path: `/articles/${local.slug}`, type: "article" });
  try {
    const article = await apiGetPublic<Article>(`/articles/${params.slug}`);
    if (article) return pageMetadata({ title: article.title, description: article.summary, path: `/articles/${params.slug}`, type: "article" });
  } catch { /* handled by page */ }
  return {};
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const local = findEditorialPage(params.slug);
  if (local && articles.some((article) => article.slug === params.slug)) return <EditorialPageView page={local} basePath="/articles" />;

  let article: Article | null = null;
  try { article = await apiGetPublic<Article>(`/articles/${params.slug}`); } catch { article = null; }
  if (!article) notFound();

  return (
    <main className="editorial-shell"><article className="editorial-article editorial-api-article"><header className="editorial-hero"><span className="eyebrow">مقاله</span><h1>{article.title}</h1><p className="editorial-deck">{article.summary}</p></header><div className="editorial-body">
      <ContentBlocks blocks={article.contentBlocks} assets={article.assets ?? []} />
    </div>
    </article>
    </main>
  );
}
