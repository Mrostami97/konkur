"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "../lib/api";
import { formatRial } from "../lib/format";
import { BuyButton } from "./BuyButton";
import { ContentBlocks } from "./ContentBlocks";
import type { PublicContentBlock, PublicResourceRecord } from "./PublicContent";

type ResourceAccessState = Pick<PublicResourceRecord, "slug" | "accessMode" | "hostingMode" | "canAccess" | "externalUrl" | "courses" | "sample" | "sampleFor">;

/** A product on sale, as the public catalogue lists it. */
interface CatalogProduct {
  id: string;
  title: string;
  prices: { amountRial: number }[];
  resourceGrants: { resource: { slug: string } }[];
}

/** Files the site keeps; a sold or members-only one is read in the panel, never downloaded. */
const KEPT_FILE = new Set(["USER_UPLOAD", "MIRRORED_WITH_PERMISSION"]);

export function ResourceAccess({ initial }: { initial: ResourceAccessState }) {
  const [resource, setResource] = useState(initial);
  const [contentBlocks, setContentBlocks] = useState<PublicContentBlock[]>([]);
  const [offer, setOffer] = useState<CatalogProduct | null>(null);
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
        if (!current.canAccess && current.accessMode === "ENTITLEMENT") {
          // The cheapest product on sale that includes this resource.
          const products = await apiFetch<CatalogProduct[]>("/products");
          const offers = products
            .filter((product) => product.prices.length > 0 && product.resourceGrants.some((grant) => grant.resource.slug === current.slug))
            .sort((a, b) => a.prices[0].amountRial - b.prices[0].amountRial);
          if (active) setOffer(offers[0] ?? null);
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
  const protectedFile = KEPT_FILE.has(resource.hostingMode) && resource.accessMode !== "PUBLIC";
  const courses = resource.courses ?? [];
  // "Comes with course X": shown whenever the handout is not yet the reader's.
  const withCourses = !resource.canAccess && courses.length > 0 && (
    <p className="resource-with-courses">
      {offer ? "یا همراه دورهٔ " : "این جزوه همراه دورهٔ "}
      {courses.map((course, index) => (
        <span key={course.slug}>
          {index > 0 && "، "}
          <Link href={`/courses/${course.slug}`}>{course.title}</Link>
        </span>
      ))}
      {offer ? "، بدون هزینهٔ جداگانه." : " ارائه می‌شود؛ با تهیهٔ دوره در پنلت باز می‌شود."}
    </p>
  );

  // A paid handout’s free chapters, read in the panel like any kept file.
  const sampleLink = !resource.canAccess && resource.sample && (
    <Link className="button button-secondary" href={`/account/library/${resource.sample.slug}`}>خواندن نمونهٔ رایگان ←</Link>
  );
  // On the sample itself: the way back to the whole handout.
  const fullHandouts = (resource.sampleFor ?? []).length > 0 && (
    <p className="resource-with-courses">
      این نمونهٔ رایگانِ{" "}
      {(resource.sampleFor ?? []).map((paid, index) => (
        <span key={paid.slug}>
          {index > 0 && "، "}
          <Link href={`/resources/${paid.slug}`}>{paid.title}</Link>
        </span>
      ))}{" "}
      است؛ جزوهٔ کامل را از صفحهٔ خودش تهیه کن.
    </p>
  );
  // Signing in comes back here, or straight to the reader for a kept file.
  const loginHref = `/login?next=${encodeURIComponent(protectedFile ? `/account/library/${resource.slug}` : `/resources/${resource.slug}`)}`;

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
        ) : resource.canAccess && protectedFile ? (
          <>
            <p>این جزوه در پنلت باز می‌شود.</p>
            <Link className="button button-primary" href={`/account/library/${resource.slug}`}>مطالعهٔ جزوه ←</Link>
          </>
        ) : resource.canAccess && resource.hostingMode !== "METADATA_ONLY" ? (
          <a className="button button-primary" href={contentHref}>مشاهدهٔ محتوا در سایت ←</a>
        ) : resource.accessMode === "ACCOUNT" ? (
          <Link className="button button-primary" href={loginHref}>ورود برای مشاهده ←</Link>
        ) : resource.accessMode === "ENTITLEMENT" && offer ? (
          <>
            <p>
              قیمت: <b>{formatRial(offer.prices[0].amountRial)}</b>
              {protectedFile && " · بعد از خرید در پنلت، به نام خودت، خوانده می‌شود."}
            </p>
            <div className="resource-actions">
              <BuyButton productId={offer.id} label="خرید جزوه" />
              {sampleLink}
            </div>
            {withCourses}
          </>
        ) : resource.accessMode === "ENTITLEMENT" && courses.length > 0 ? (
          <>
            {withCourses}
            <div className="resource-actions">
              <Link className="button button-primary" href={`/courses/${courses[0].slug}`}>دیدن دوره ←</Link>
              {sampleLink}
            </div>
          </>
        ) : resource.accessMode === "ENTITLEMENT" ? (
          <>
            <p>فروش این جزوه به‌زودی باز می‌شود.</p>
            {sampleLink}
          </>
        ) : (
          <p>این رکورد فعلاً فقط اطلاعات منبع را نمایش می‌دهد.</p>
        )}
        {!loading && fullHandouts}
      </section>
      {contentBlocks.length > 0 && (
        <section className="editorial-body" id="resource-content" aria-label="محتوای منبع">
          <ContentBlocks blocks={contentBlocks} />
        </section>
      )}
    </>
  );
}
