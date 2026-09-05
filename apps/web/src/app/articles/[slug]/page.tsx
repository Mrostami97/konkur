import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { ContentBlocks } from "../../../components/ContentBlocks";

interface Article {
  title: string;
  summary: string;
  contentBlocks: { type: string; [key: string]: unknown }[];
  assets: { media_key: string; checksum: string }[];
  publishedAt: string;
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await apiGetPublic<Article>(`/articles/${params.slug}`);
  if (!article) notFound();

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>{article.title}</h1>
      <p style={{ color: "#486581" }}>{article.summary}</p>
      <ContentBlocks blocks={article.contentBlocks} assets={article.assets ?? []} />
    </main>
  );
}
