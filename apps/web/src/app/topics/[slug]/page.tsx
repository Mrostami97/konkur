import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PublicBreadcrumbs,
  PublicServiceError,
  RelatedContentGrid,
  accessModeLabel,
  contentTypeLabel,
  resourceKindLabel,
  type PublicArticleRecord,
  type RelatedPublicItem,
} from "../../../components/PublicContent";
import { StructuredData } from "../../../components/StructuredData";
import { apiGetPublic } from "../../../lib/api";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

interface TaxonomyReference {
  code: string;
  slug: string;
  title: string;
  description: string | null;
}

interface RelatedArticle extends Pick<PublicArticleRecord, "slug" | "title" | "summary" | "contentType" | "quickAnswer" | "publishedAt"> {
  href: string;
}

interface PublicTopicDetail extends TaxonomyReference {
  order: number;
  metadata: Record<string, unknown>;
  subject: TaxonomyReference;
  prerequisites: (TaxonomyReference & { subject: Pick<TaxonomyReference, "code" | "slug" | "title"> })[];
  relatedContent: {
    articles: RelatedArticle[];
    resources: { slug: string; title: string; summary: string; kind: string; accessMode: string; publishedAt: string | null; href: string }[];
    courses: { slug: string; title: string; description: string; accessMode: string; degreeTargets: string[]; fieldTargets: string[]; href: string }[];
  };
}

async function loadTopic(slug: string) {
  try {
    return { topic: await apiGetPublic<PublicTopicDetail>(`/topics/${encodeURIComponent(slug)}`), unavailable: false };
  } catch {
    return { topic: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadTopic(params.slug);
  if (!result.topic) return pageMetadata({
    title: "مبحث آموزشی در دسترس نیست",
    description: "این مبحث پیدا نشد یا سرویس محتوا موقتاً در دسترس نیست.",
    path: `/topics/${params.slug}`,
    noIndex: true,
  });
  return pageMetadata({
    title: `${result.topic.title}؛ آموزش و منابع کنکور`,
    description: result.topic.description ?? `پیش‌نیازها و محتوای منتشرشدهٔ مبحث ${result.topic.title}.`,
    path: `/topics/${result.topic.slug}`,
  });
}

function relatedItems(topic: PublicTopicDetail): RelatedPublicItem[] {
  return [
    ...topic.relatedContent.articles.map((item) => ({ href: item.href, title: item.title, summary: item.summary, label: contentTypeLabel(item.contentType) })),
    ...topic.relatedContent.resources.map((item) => ({ href: item.href, title: item.title, summary: item.summary, label: `${resourceKindLabel(item.kind)} · ${accessModeLabel(item.accessMode)}` })),
    ...topic.relatedContent.courses.map((item) => ({ href: item.href, title: item.title, summary: item.description, label: `دوره · ${accessModeLabel(item.accessMode)}` })),
  ];
}

export default async function TopicPage({ params }: { params: { slug: string } }) {
  const result = await loadTopic(params.slug);
  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="صفحهٔ مبحث" /></main>;
  }
  if (!result.topic) notFound();
  const topic = result.topic;
  const path = `/topics/${topic.slug}`;
  const breadcrumbs = [
    { name: "خانه", href: "/" },
    { name: "درس‌ها", href: "/subjects" },
    { name: topic.subject.title, href: `/subjects/${topic.subject.slug}` },
    { name: topic.title },
  ];
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: topic.title,
      description: topic.description ?? undefined,
      termCode: topic.code,
      url: absoluteUrl(path),
      inDefinedTermSet: { "@type": "DefinedTermSet", name: topic.subject.title, url: absoluteUrl(`/subjects/${topic.subject.slug}`) },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.href ?? path) })),
    },
    ...topic.relatedContent.courses.map((course) => ({
      "@context": "https://schema.org",
      "@type": "Course",
      name: course.title,
      description: course.description,
      url: absoluteUrl(course.href),
      provider: { "@id": absoluteUrl("/#organization") },
      inLanguage: "fa-IR",
    })),
  ];

  return (
    <main className="page-container subject-detail">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={breadcrumbs} />
      <section className="subject-detail-hero">
        <div className="subject-monogram subject-monogram-large">{topic.code.slice(0, 3).toUpperCase()}</div>
        <div>
          <span className="eyebrow">مبحث از درس {topic.subject.title}</span>
          <h1>{topic.title}</h1>
          {topic.description && <p>{topic.description}</p>}
          <div className="subject-tags"><Link href={`/subjects/${topic.subject.slug}`}>بازگشت به درس {topic.subject.title} ←</Link></div>
        </div>
      </section>

      {topic.prerequisites.length > 0 && (
        <nav className="prerequisite-strip" aria-label="پیش‌نیازهای مبحث">
          <strong>پیش‌نیازهای ثبت‌شده</strong>
          {topic.prerequisites.map((item) => <Link href={`/topics/${item.slug}`} key={item.code}>{item.title} ←</Link>)}
        </nav>
      )}

      <RelatedContentGrid
        title="یادگیری و تمرین مرتبط"
        description="فقط محتوای منتشرشده‌ای که در سامانه به این مبحث متصل شده است."
        items={relatedItems(topic)}
      />
      {relatedItems(topic).length === 0 && (
        <div className="empty-state"><strong>هنوز محتوای منتشرشده‌ای به این مبحث متصل نشده است.</strong></div>
      )}
    </main>
  );
}
