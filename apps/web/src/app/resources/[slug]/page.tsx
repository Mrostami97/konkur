import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceAccess } from "../../../components/ResourceAccess";
import {
  PublicBreadcrumbs,
  PublicServiceError,
  PublicSourceList,
  accessModeLabel,
  degreeLabel,
  formatPublicDate,
  resourceKindLabel,
  type PublicResourceRecord,
} from "../../../components/PublicContent";
import { StructuredData } from "../../../components/StructuredData";
import { apiGetPublic } from "../../../lib/api";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

async function loadResource(slug: string) {
  try {
    const resource = await apiGetPublic<PublicResourceRecord>(`/resources/${encodeURIComponent(slug)}`);
    return { resource, unavailable: false };
  } catch {
    return { resource: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { resource } = await loadResource(params.slug);
  if (!resource) return pageMetadata({
    title: "منبع آموزشی در دسترس نیست",
    description: "این منبع پیدا نشد یا سرویس محتوا موقتاً در دسترس نیست.",
    path: `/resources/${params.slug}`,
    noIndex: true,
  });
  return pageMetadata({ title: resource.title, description: resource.description ?? resource.summary, path: `/resources/${resource.slug}` });
}

export default async function ResourcePage({ params }: { params: { slug: string } }) {
  const result = await loadResource(params.slug);
  if (result.unavailable) return <main className="page-container"><PublicServiceError label="منبع آموزشی" /></main>;
  if (!result.resource) notFound();
  const resource = result.resource;
  const path = `/resources/${resource.slug}`;
  const breadcrumbs = [{ name: "خانه", href: "/" }, { name: "منابع", href: "/resources" }, { name: resource.title }];
  const relatedGuides = resource.catalogProfile?.relatedGuideSlugs ?? [];
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      name: resource.title,
      description: resource.description ?? resource.summary,
      url: absoluteUrl(path),
      inLanguage: "fa-IR",
      learningResourceType: resourceKindLabel(resource.kind),
      isAccessibleForFree: resource.accessMode !== "ENTITLEMENT",
      provider: { "@id": absoluteUrl("/#organization") },
      ...(resource.authorProfile ? { author: { "@type": "Person", name: resource.authorProfile.displayName, url: absoluteUrl(`/authors/${resource.authorProfile.slug}`) } } : {}),
      ...(resource.publishedAt ? { datePublished: resource.publishedAt } : {}),
      ...(resource.reviewedAt ? { dateModified: resource.reviewedAt } : {}),
      ...(resource.sources.length > 0 ? { citation: resource.sources.map((item) => item.source.deepUrl ?? item.source.canonicalUrl) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.href ?? path) })),
    },
  ];

  return (
    <main className="editorial-shell">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={breadcrumbs} />
      <div className="editorial-layout">
        <article className="editorial-article">
          <header className="editorial-hero">
            <div className="editorial-kickers">
              <span className="eyebrow">{resourceKindLabel(resource.kind)}</span>
              <span>{accessModeLabel(resource.accessMode)}</span>
              {resource.taxonomyDegrees.map((degree) => <span key={degree}>{degreeLabel(degree)}</span>)}
            </div>
            <h1>{resource.title}</h1>
            <p className="editorial-deck">{resource.description ?? resource.summary}</p>
            <div className="editorial-byline">
              <div>
                {resource.authorProfile && <span>تهیه‌کننده: <Link href={`/authors/${resource.authorProfile.slug}`}>{resource.authorProfile.displayName}</Link></span>}
                {resource.reviewerProfile && <span>بازبین: <Link href={`/authors/${resource.reviewerProfile.slug}`}>{resource.reviewerProfile.displayName}</Link></span>}
                {!resource.authorProfile && !resource.reviewerProfile && <span>انتساب عمومی برای این منبع منتشر نشده است.</span>}
              </div>
              <div className="editorial-dates">
                {resource.publishedAt && <span>انتشار {formatPublicDate(resource.publishedAt)}</span>}
                {resource.reviewedAt && <span>آخرین بررسی {formatPublicDate(resource.reviewedAt)}</span>}
              </div>
            </div>
          </header>

          <ResourceAccess initial={{ slug: resource.slug, accessMode: resource.accessMode, hostingMode: resource.hostingMode, canAccess: resource.canAccess, externalUrl: resource.externalUrl }} />

          {resource.catalogProfile && (
            <section className="surface-card" aria-labelledby="resource-fit-title">
              <div className="section-heading"><div><span className="eyebrow">تناسب منبع</span><h2 id="resource-fit-title">قبل از شروع، این مشخصات را ببین</h2></div></div>
              <div className="responsive-table">
                <table>
                  <tbody>
                    <tr><th>نوع یادگیری</th><td>{resource.catalogProfile.learningType ?? "ثبت نشده"}</td></tr>
                    <tr><th>سطح شروع</th><td>{resource.catalogProfile.startLevel ?? "ثبت نشده"}</td></tr>
                    <tr><th>پوشش</th><td>{resource.catalogProfile.coverage ?? "ثبت نشده"}</td></tr>
                    <tr><th>حجم</th><td>{resource.catalogProfile.volume ?? "ثبت نشده"}</td></tr>
                    <tr><th>نمونه</th><td>{resource.catalogProfile.sampleLabel ?? "ثبت نشده"}</td></tr>
                    <tr><th>هزینه</th><td>{resource.catalogProfile.costLabel ?? accessModeLabel(resource.accessMode)}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(resource.subjectCodes.length > 0 || relatedGuides.length > 0) && (
            <section className="surface-card" aria-labelledby="resource-next-step-title">
              <div className="section-heading"><div><span className="eyebrow">قدم بعد</span><h2 id="resource-next-step-title">این منبع را در یک مسیر ببین</h2><p>هاب درس، پیش‌نیاز و ترتیب یادگیری را نشان می‌دهد؛ راهنما کمک می‌کند منبع را متناسب با برنامه انتخاب کنی.</p></div></div>
              <div className="cluster">
                {resource.subjectCodes.map((code) => <Link className="button button-secondary" href={`/subjects/${code}`} key={code}>هاب درس {findSubjectTitle(code)} ←</Link>)}
                {relatedGuides.map((slug) => <Link className="button button-secondary" href={`/guides/${slug}`} key={slug}>راهنمای برنامه‌ریزی منبع ←</Link>)}
              </div>
            </section>
          )}

          <PublicSourceList sources={resource.sources ?? []} />
        </article>
        <aside className="editorial-aside" aria-label="اطلاعات منبع">
          <div className="surface-card toc-card">
            <strong>وضعیت انتشار</strong>
            <p>{resourceKindLabel(resource.kind)}</p>
            <p>{accessModeLabel(resource.accessMode)}</p>
            <Link className="text-link" href="/editorial-policy">روش بررسی محتوا ←</Link>
          </div>
          <div className="surface-card telegram-card">
            <span className="telegram-icon" aria-hidden="true">↗</span><strong>کانال رسمی</strong><p>نسخه‌های تازه و اصلاحیه‌ها در @konkurcom اعلام می‌شوند.</p><a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">عضویت در کانال</a>
          </div>
        </aside>
      </div>
    </main>
  );
}

function findSubjectTitle(code: string) {
  const labels: Record<string, string> = {
    "data-structures-algorithms": "داده‌ساختار و الگوریتم",
    "data-structures": "ساختمان داده",
    algorithms: "طراحی الگوریتم",
    automata: "نظریه زبان‌ها و ماشین‌ها",
  };
  return labels[code] ?? code;
}
