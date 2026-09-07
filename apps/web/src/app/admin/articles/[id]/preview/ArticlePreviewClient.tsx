"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminGuard } from "../../../../../components/AdminGuard";
import { ContentBlocks } from "../../../../../components/ContentBlocks";
import { PageHeader } from "../../../../../components/ui";
import { apiFetch } from "../../../../../lib/api";

interface PreviewResponse {
  article: {
    id: string;
    title: string;
    summary: string;
    quickAnswer: string | null;
    contentBlocks: unknown;
  };
  revision: { version: number; schemaVersion: string; reviewStatus: string; payload: unknown } | null;
}

type ContentBlock = { type: string; [key: string]: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function blocksFrom(value: unknown): ContentBlock[] {
  return Array.isArray(value)
    ? value.filter((block): block is ContentBlock => {
        const record = asRecord(block);
        return typeof record?.type === "string";
      })
    : [];
}

export function ArticlePreviewClient({ articleId }: { articleId: string }) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PreviewResponse>(`/admin/articles/${articleId}/preview`)
      .then(setPreview)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "پیش‌نمایش بارگذاری نشد."));
  }, [articleId]);

  if (error) {
    return (
      <AdminGuard>
        <main className="page-container">
          <p className="form-error" role="alert">{error}</p>
          <Link className="button button-secondary" href="/admin/articles">بازگشت به مقاله‌ها</Link>
        </main>
      </AdminGuard>
    );
  }

  if (!preview) {
    return (
      <AdminGuard>
        <main className="page-container"><p className="loading-state">در حال آماده‌سازی پیش‌نمایش…</p></main>
      </AdminGuard>
    );
  }

  const payload = asRecord(preview.revision?.payload);
  const title = typeof payload?.title === "string" ? payload.title : preview.article.title;
  const summary = typeof payload?.summary === "string" ? payload.summary : preview.article.summary;
  const quickAnswer = typeof payload?.quick_answer === "string" ? payload.quick_answer : preview.article.quickAnswer;
  const blocks = blocksFrom(payload?.content_blocks ?? preview.article.contentBlocks);
  const sources = Array.isArray(payload?.sources) ? payload.sources.map(asRecord).filter(Boolean) : [];

  return (
    <AdminGuard>
      <main className="page-container">
        <PageHeader
          eyebrow="پیش‌نمایش خصوصی تحریریه"
          title={title}
          description={summary}
          action={<Link className="button button-secondary" href="/admin/articles">بازگشت به مقاله‌ها</Link>}
        />
        <div className="editorial-api-article">
          <div className="editorial-note">
            <strong>این صفحه عمومی نیست</strong>
            <p>
              نسخهٔ {preview.revision?.version.toLocaleString("fa-IR") ?? "—"} با وضعیت {preview.revision?.reviewStatus ?? "نامشخص"}
              فقط برای کنترل کارکنان نمایش داده می‌شود.
            </p>
          </div>
          {quickAnswer && <div className="answer-first"><strong>پاسخ کوتاه</strong><p>{quickAnswer}</p></div>}
          <article className="editorial-body">
            {blocks.length ? <ContentBlocks blocks={blocks} /> : <p className="muted-copy">این نسخه بلوک محتوایی قابل نمایش ندارد.</p>}
          </article>
          {sources.length > 0 && (
            <section className="sources-box">
              <div><span>منابع نسخه</span></div>
              <h2>شناسه‌های ثبت‌شده در قرارداد</h2>
              <ol>
                {sources.map((source, index) => (
                  <li key={`${String(source?.source_external_id)}-${index}`}>
                    <strong>{String(source?.source_external_id ?? "منبع بدون شناسه")}</strong>
                    {typeof source?.locator === "string" && <span>{source.locator}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </main>
    </AdminGuard>
  );
}
