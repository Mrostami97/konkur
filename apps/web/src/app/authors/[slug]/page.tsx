import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentBlocks } from "../../../components/ContentBlocks";
import {
  PublicBreadcrumbs,
  PublicServiceError,
  RelatedContentGrid,
  accessModeLabel,
  contentTypeLabel,
  formatPublicDate,
  resourceKindLabel,
  type PublicContentBlock,
  type RelatedPublicItem,
} from "../../../components/PublicContent";
import { StructuredData } from "../../../components/StructuredData";
import { EmptyState } from "../../../components/ui";
import { apiGetPublic } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

interface ContributorArticle {
  slug: string;
  title: string;
  summary: string;
  contentType: "ARTICLE" | "GUIDE" | "NEWS" | "CASE_STUDY";
  publishedAt: string | null;
  href: string;
}

interface ContributorResource {
  slug: string;
  title: string;
  summary: string;
  kind: string;
  accessMode: string;
  publishedAt: string | null;
  href: string;
}

interface PublicContributor {
  kind: "PERSON" | "ORGANIZATION";
  slug: string;
  displayName: string;
  roleTitle: string | null;
  shortBio: string | null;
  bioBlocks: PublicContentBlock[];
  avatarUrl: string | null;
  thesisUrl: string | null;
  sameAs: string[];
  updatedAt: string;
  authoredArticles: ContributorArticle[];
  reviewedArticles: ContributorArticle[];
  authoredResources: ContributorResource[];
  reviewedResources: ContributorResource[];
}

async function loadContributor(slug: string) {
  try {
    return {
      contributor: await apiGetPublic<PublicContributor>(`/contributors/${encodeURIComponent(slug)}`),
      unavailable: false,
    };
  } catch {
    return { contributor: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadContributor(params.slug);
  if (!result.contributor) return pageMetadata({
    title: "پروفایل تحریریه در دسترس نیست",
    description: "این پروفایل عمومی پیدا نشد یا سرویس محتوا موقتاً در دسترس نیست.",
    path: `/authors/${params.slug}`,
    noIndex: true,
  });
  return pageMetadata({
    title: `${result.contributor.displayName}؛ نویسنده و بازبین کنکورصفریک`,
    description:
      result.contributor.shortBio ??
      `پروفایل و فهرست مطالب منتشرشدهٔ ${result.contributor.displayName} در کنکورصفریک.`,
    path: `/authors/${result.contributor.slug}`,
  });
}

function articleItems(items: ContributorArticle[], prefix?: string): RelatedPublicItem[] {
  return items.map((item) => ({
    href: item.href,
    title: item.title,
    summary: item.summary,
    label: prefix ? `${prefix} ${contentTypeLabel(item.contentType)}` : contentTypeLabel(item.contentType),
  }));
}

function resourceItems(items: ContributorResource[], prefix?: string): RelatedPublicItem[] {
  return items.map((item) => ({
    href: item.href,
    title: item.title,
    summary: item.summary,
    label: `${prefix ? `${prefix} ` : ""}${resourceKindLabel(item.kind)} · ${accessModeLabel(item.accessMode)}`,
  }));
}

export default async function AuthorPage({ params }: { params: { slug: string } }) {
  const result = await loadContributor(params.slug);
  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="پروفایل نویسنده" /></main>;
  }
  if (!result.contributor) notFound();
  const contributor = result.contributor;
  const path = `/authors/${contributor.slug}`;
  const breadcrumbs = [
    { name: "خانه", href: "/" },
    { name: "سیاست تحریریه", href: "/editorial-policy" },
    { name: contributor.displayName },
  ];
  const personSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": contributor.kind === "ORGANIZATION" ? "Organization" : "Person",
    name: contributor.displayName,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
  };
  if (contributor.roleTitle && contributor.kind === "PERSON") personSchema.jobTitle = contributor.roleTitle;
  if (contributor.shortBio) personSchema.description = contributor.shortBio;
  if (contributor.avatarUrl) personSchema.image = contributor.avatarUrl;
  if (contributor.sameAs.length > 0) personSchema.sameAs = contributor.sameAs;
  if (contributor.thesisUrl) {
    personSchema.subjectOf = {
      "@type": "CreativeWork",
      name: "پایان‌نامهٔ ثبت‌شده",
      url: contributor.thesisUrl,
    };
  }
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href ?? path),
    })),
  };
  const authored = [
    ...articleItems(contributor.authoredArticles),
    ...resourceItems(contributor.authoredResources),
  ];
  const reviewed = [
    ...articleItems(contributor.reviewedArticles, "بازبینی"),
    ...resourceItems(contributor.reviewedResources, "بازبینی"),
  ];

  return (
    <main className="page-container trust-page">
      <StructuredData data={[personSchema, breadcrumbSchema]} />
      <PublicBreadcrumbs items={breadcrumbs} />

      <section className="surface-card profile-card" aria-labelledby="author-name">
        {contributor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="author-avatar author-avatar-large"
            src={contributor.avatarUrl}
            alt={`تصویر ${contributor.displayName}`}
            width={64}
            height={64}
          />
        ) : (
          <span className="author-avatar author-avatar-large" aria-hidden="true">
            {contributor.displayName.slice(0, 1)}
          </span>
        )}
        <div>
          <span className="eyebrow">پروفایل تأییدشدهٔ تحریریه</span>
          <h1 id="author-name">{contributor.displayName}</h1>
          {contributor.roleTitle && <strong>{contributor.roleTitle}</strong>}
          {contributor.shortBio && <p>{contributor.shortBio}</p>}
          <div className="subject-tags">
            {contributor.sameAs.map((url, index) => (
              <a href={url} key={url} target="_blank" rel="noreferrer">
                پیوند رسمی {toPersianDigits(index + 1)}
              </a>
            ))}
          </div>
          {contributor.thesisUrl && (
            <a className="button button-secondary" href={contributor.thesisUrl} target="_blank" rel="noreferrer">
              مشاهدهٔ پایان‌نامه ↗
            </a>
          )}
          <p>آخرین به‌روزرسانی پروفایل: {formatPublicDate(contributor.updatedAt)}</p>
        </div>
      </section>

      {contributor.bioBlocks.length > 0 && (
        <section className="surface-card" aria-labelledby="author-biography">
          <div className="section-heading"><div><h2 id="author-biography">دربارهٔ نویسنده</h2><p>معرفی منتشرشده در پروفایل تحریریه</p></div></div>
          <ContentBlocks blocks={contributor.bioBlocks} />
        </section>
      )}

      <RelatedContentGrid
        title="مطالب منتشرشده"
        description="مقاله‌ها، راهنماها و منابعی که نویسندگی آن‌ها در سامانه ثبت و منتشر شده است."
        items={authored}
      />
      <RelatedContentGrid
        title="مطالب بازبینی‌شده"
        description="محتواهایی که بازبینی این مشارکت‌کننده برای نسخهٔ عمومی آن‌ها ثبت شده است."
        items={reviewed}
      />
      {authored.length === 0 && reviewed.length === 0 && (
        <EmptyState
          title="هنوز محتوای عمومی به این پروفایل متصل نشده است"
          description="فقط محتواهای منتشرشده و دارای انتساب تأییدشده در این فهرست می‌آیند."
        />
      )}
    </main>
  );
}
