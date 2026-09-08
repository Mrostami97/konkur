"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";
import { ContentBlocks } from "./ContentBlocks";
import type { PublicContentBlock, PublicResourceRecord } from "./PublicContent";

type ResourceAccessState = Pick<PublicResourceRecord, "slug" | "accessMode" | "hostingMode" | "canAccess" | "externalUrl">;

export function ResourceAccess({ initial }: { initial: ResourceAccessState }) {
  const [resource, setResource] = useState(initial);
  const [contentBlocks, setContentBlocks] = useState<PublicContentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await apiFetch<PublicResourceRecord>(`/resources/${encodeURIComponent(initial.slug)}`);
        if (!active) return;
        setResource(current);
        if (current.canAccess && current.hostingMode === "METADATA_ONLY") {
          const content = await apiFetch<{ contentBlocks?: PublicContentBlock[] }>(`/resources/${encodeURIComponent(initial.slug)}/content`);
          if (active) setContentBlocks(Array.isArray(content.contentBlocks) ? content.contentBlocks : []);
        }
      } catch {
        // The server-rendered teaser remains useful even when this optional
        // session-aware enhancement cannot reach the API.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [initial.slug]);

  const contentHref = `${API_URL}/resources/${encodeURIComponent(resource.slug)}/content`;

  return (
    <>
      <section className="answer-first" aria-labelledby="resource-access-title" aria-busy={loading}>
        <strong id="resource-access-title">روش دسترسی</strong>
        {loading ? (
          <p aria-live="polite">در حال بررسی دسترسی حساب…</p>
        ) : resource.externalUrl ? (
          <a className="button button-primary" href={resource.externalUrl} target="_blank" rel="noreferrer">مشاهدهٔ منبع اصلی ↗</a>
        ) : contentBlocks.length > 0 ? (
          <a className="button button-primary" href="#resource-content">شروع مطالعه ↓</a>
        ) : resource.canAccess && resource.hostingMode !== "METADATA_ONLY" ? (
          <a className="button button-primary" href={contentHref}>مشاهدهٔ محتوا در سایت ←</a>
        ) : resource.accessMode === "ACCOUNT" ? (
          <Link className="button button-primary" href="/login">ورود برای مشاهده ←</Link>
        ) : resource.accessMode === "ENTITLEMENT" ? (
          <Link className="button button-primary" href="/courses">دیدن دوره‌ها و دسترسی‌ها ←</Link>
        ) : (
          <p>این رکورد فعلاً فقط اطلاعات منبع را نمایش می‌دهد.</p>
        )}
      </section>
      {contentBlocks.length > 0 && (
        <section className="editorial-body" id="resource-content" aria-label="محتوای منبع">
          <ContentBlocks blocks={contentBlocks} />
        </section>
      )}
    </>
  );
}
