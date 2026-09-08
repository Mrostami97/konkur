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
import { Phase11SubjectEditorial } from "../../../components/Phase11SubjectEditorial";
import { StructuredData } from "../../../components/StructuredData";
import { SectionHeader } from "../../../components/ui";
import { articles, findSubject, guides, subjects } from "../../../content/editorial";
import {
  phase11SubjectContent,
  type Phase11SubjectContent,
  type Phase11SubjectSlug,
} from "../../../content/phase11";
import { apiGetPublic } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
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

interface RelatedResource {
  slug: string;
  title: string;
  summary: string;
  kind: string;
  accessMode: string;
  publishedAt: string | null;
  href: string;
}

interface RelatedCourse {
  slug: string;
  title: string;
  description: string;
  accessMode: string;
  degreeTargets: string[];
  fieldTargets: string[];
  href: string;
}

interface PublicSubjectDetail extends TaxonomyReference {
  order: number;
  metadata: Record<string, unknown>;
  prerequisites: TaxonomyReference[];
  topics: (TaxonomyReference & { order: number })[];
  relatedContent: {
    articles: RelatedArticle[];
    resources: RelatedResource[];
    courses: RelatedCourse[];
  };
}

export function generateStaticParams() {
  return subjects.map(({ slug }) => ({ slug }));
}

async function loadSubject(slug: string) {
  try {
    return { subject: await apiGetPublic<PublicSubjectDetail>(`/subjects/${encodeURIComponent(slug)}`), unavailable: false };
  } catch {
    return { subject: null, unavailable: true };
  }
}

function getPhase11Content(slug: string): Phase11SubjectContent | null {
  return Object.hasOwn(phase11SubjectContent, slug)
    ? phase11SubjectContent[slug as Phase11SubjectSlug]
    : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadSubject(params.slug);
  if (result.subject) {
    return pageMetadata({
      title: `${result.subject.title} برای کنکور کامپیوتر`,
      description: result.subject.description ?? `مباحث، پیش‌نیازها و محتوای منتشرشدهٔ درس ${result.subject.title}.`,
      path: `/subjects/${result.subject.slug}`,
    });
  }
  const legacy = findSubject(params.slug);
  if (legacy) return pageMetadata({ title: `${legacy.title} برای کنکور کامپیوتر`, description: legacy.description, path: `/subjects/${legacy.slug}` });
  return pageMetadata({ title: "درس در دسترس نیست", description: "این درس پیدا نشد یا سرویس نقشهٔ دانش موقتاً در دسترس نیست.", path: `/subjects/${params.slug}`, noIndex: true });
}

function toRelatedItems(subject: PublicSubjectDetail): RelatedPublicItem[] {
  return [
    ...subject.relatedContent.articles.map((item) => ({ href: item.href, title: item.title, summary: item.summary, label: contentTypeLabel(item.contentType) })),
    ...subject.relatedContent.resources.map((item) => ({ href: item.href, title: item.title, summary: item.summary, label: `${resourceKindLabel(item.kind)} · ${accessModeLabel(item.accessMode)}` })),
    ...subject.relatedContent.courses.map((item) => ({ href: item.href, title: item.title, summary: item.description, label: `دوره · ${accessModeLabel(item.accessMode)}` })),
  ];
}

function CanonicalSubjectPage({ subject }: { subject: PublicSubjectDetail }) {
  const path = `/subjects/${subject.slug}`;
  const legacy = findSubject(subject.slug);
  const phase11 = getPhase11Content(subject.slug);
  const breadcrumbs = [{ name: "خانه", href: "/" }, { name: "درس‌ها", href: "/subjects" }, { name: subject.title }];
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: subject.title,
      description: subject.description ?? undefined,
      termCode: subject.code,
      url: absoluteUrl(path),
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "نقشهٔ دروس کنکورصفریک", url: absoluteUrl("/subjects") },
      ...(phase11 ? { citation: phase11.sources.map((source) => source.url) } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.href ?? path) })),
    },
    ...subject.relatedContent.courses.map((course) => ({
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
        <div className="subject-monogram subject-monogram-large">{subject.code.slice(0, 3).toUpperCase()}</div>
        <div>
          <span className="eyebrow">درس مرجع</span>
          <h1>{subject.title}</h1>
          {subject.description && <p>{subject.description}</p>}
        </div>
      </section>

      {subject.prerequisites.length > 0 && (
        <nav className="prerequisite-strip" aria-label="پیش‌نیازهای درس">
          <strong>پیش‌نیازهای ثبت‌شده</strong>
          {subject.prerequisites.map((item) => <Link href={`/subjects/${item.slug}`} key={item.code}>{item.title} ←</Link>)}
        </nav>
      )}

      {legacy && phase11 && <Phase11SubjectEditorial subject={legacy} content={phase11} />}

      <section className="syllabus-panel" aria-labelledby="topics-title">
        <div className="section-heading"><div><h2 id="topics-title">مباحث {subject.title}</h2><p>ترتیب و توضیح هر مبحث مستقیماً از نقشهٔ دانش سایت خوانده می‌شود.</p></div></div>
        {subject.topics.length === 0 ? (
          <div className="empty-state"><strong>هنوز مبحثی برای این درس ثبت نشده است.</strong></div>
        ) : (
          <div className="article-grid">
            {subject.topics.map((topic, index) => (
              <Link className="article-card" href={`/topics/${topic.slug}`} key={topic.code}>
                <span className="article-meta">مبحث {toPersianDigits(index + 1)}</span>
                <h3>{topic.title}</h3>
                {topic.description && <p>{topic.description}</p>}
                <span className="text-link">مشاهدهٔ مسیر مبحث ←</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <RelatedContentGrid
        title="آموزش و محتوای مرتبط"
        description="فقط دوره، مقاله و منبع منتشرشده‌ای که به این درس متصل است."
        items={toRelatedItems(subject)}
      />
    </main>
  );
}

function LegacySubjectPage({ slug, apiUnavailable }: { slug: string; apiUnavailable: boolean }) {
  const subject = findSubject(slug);
  if (!subject) notFound();
  const phase11 = getPhase11Content(slug);
  if (!phase11) notFound();
  const prerequisites = subject.prerequisites.map(findSubject).filter(Boolean);
  const related = [...guides, ...articles].filter((page) => page.relatedSubjects?.includes(subject.slug)).slice(0, 4);
  const path = `/subjects/${subject.slug}`;
  const breadcrumbs = [
    { name: "خانه", item: absoluteUrl("/") },
    { name: "درس‌ها", item: absoluteUrl("/subjects") },
    { name: subject.title, item: absoluteUrl(path) },
  ];
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      name: subject.title,
      description: phase11.quickAnswer,
      url: absoluteUrl(path),
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "نقشهٔ دروس کنکورصفریک", url: absoluteUrl("/subjects") },
      citation: phase11.sources.map((source) => source.url),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
    },
  ];
  return (
    <main className="page-container subject-detail">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={[{ name: "خانه", href: "/" }, { name: "درس‌ها", href: "/subjects" }, { name: subject.shortTitle }]} />
      {apiUnavailable && <aside className="official-disclaimer"><strong>نسخهٔ پایدار</strong><p>اتصال زندهٔ نقشهٔ دانش برقرار نیست؛ محتوای منبع‌دار و آخرین نسخهٔ ثابت این درس همچنان در دسترس است.</p></aside>}
      <section className="subject-detail-hero"><div className="subject-monogram subject-monogram-large">{subject.accent}</div><div><span className="eyebrow">{subject.status1406}</span><h1>{subject.title}</h1><p>{subject.description}</p><div className="subject-tags">{subject.tracks.map((track) => <span key={track}>{track}</span>)}</div></div></section>
      {prerequisites.length > 0 && <nav className="prerequisite-strip" aria-label="پیش‌نیازها"><strong>پیش‌نیازهای پیشنهادی</strong>{prerequisites.map((item) => item && <Link href={`/subjects/${item.slug}`} key={item.slug}>{item.shortTitle} ←</Link>)}</nav>}
      <Phase11SubjectEditorial subject={subject} content={phase11} />
      <section><SectionHeader title="راهنماهای مرتبط" description="نسخهٔ ثابتِ در دسترس" /><div className="article-grid">{related.map((page) => <Link className="article-card" href={`${guides.includes(page) ? "/guides" : "/articles"}/${page.slug}`} key={page.slug}><span className="article-meta">{page.category}</span><h3>{page.title}</h3><p>{page.description}</p></Link>)}</div></section>
    </main>
  );
}

export default async function SubjectPage({ params }: { params: { slug: string } }) {
  const result = await loadSubject(params.slug);
  if (result.subject) return <CanonicalSubjectPage subject={result.subject} />;
  if (findSubject(params.slug)) return <LegacySubjectPage slug={params.slug} apiUnavailable={result.unavailable} />;
  if (result.unavailable) return <main className="page-container"><PublicServiceError label="صفحهٔ درس" /></main>;
  notFound();
}
