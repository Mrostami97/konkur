import type { Metadata } from "next";
import { ArticlePreviewClient } from "./ArticlePreviewClient";

export const metadata: Metadata = {
  title: "پیش‌نمایش خصوصی مقاله",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ArticlePreviewPage({ params: pendingParams }: { params: Promise<{ id: string }> }) {
  const params = await pendingParams;
  return <ArticlePreviewClient articleId={params.id} />;
}
