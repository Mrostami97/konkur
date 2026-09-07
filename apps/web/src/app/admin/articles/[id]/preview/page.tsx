import type { Metadata } from "next";
import { ArticlePreviewClient } from "./ArticlePreviewClient";

export const metadata: Metadata = {
  title: "پیش‌نمایش خصوصی مقاله",
  robots: { index: false, follow: false, nocache: true },
};

export default function ArticlePreviewPage({ params }: { params: { id: string } }) {
  return <ArticlePreviewClient articleId={params.id} />;
}
