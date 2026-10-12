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
import { coefficientLabel, officialPlacements, Phase11SubjectEditorial } from "../../../components/Phase11SubjectEditorial";
import { ReadingHero } from "../../../components/reading/ReadingHero";
import { ReadingProgress } from "../../../components/reading/ReadingProgress";
import { StructuredData } from "../../../components/StructuredData";
import { Glyph, SUBJECT_TONE, SubjectGlyph } from "../../../components/SubjectIcon";
import { articles, findSubject, guides, subjects, type SubjectPage as EditorialSubject } from "../../../content/editorial";
import {
  phase11SubjectContent,
  type Phase11SubjectContent,
  type Phase11SubjectSlug,
} from "../../../content/phase11";
import { apiGetPublic } from "../../../lib/api";
import { loadSamples, SubjectSamples, type SampleQuestion } from "../../../components/samples/SubjectSamples";
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

interface FreeLecture {
  slug: string;
  title: string;
  summary: string;
  externalUrl: string | null;
  sources?: { source?: { publisher?: string } }[];
}

interface CatalogueCourse {
  slug: string;
  title: string;
  description: string;
  subject?: { slug: string } | null;
}

interface SubjectLearning {
  slug: string;
  video: FreeLecture | null;
  course: CatalogueCourse | null;
  /** Past konkur questions with worked solutions, flagged as this subject's public samples. */
  samples: SampleQuestion[];
}

/** The free lecture and the paid course for a subject, for the "learn this"
 * block. Either lookup failing just leaves that card out. */
async function loadLearning(slug: string): Promise<SubjectLearning> {
  const editorial = findSubject(slug);
  const [videos, courses, samples] = await Promise.all([
    apiGetPublic<FreeLecture[]>(`/resources?kind=VIDEO&subject=${encodeURIComponent(slug)}`).catch(() => null),
    apiGetPublic<CatalogueCourse[]>("/courses").catch(() => null),
    loadSamples(slug),
  ]);
  const titles = editorial ? [editorial.shortTitle, editorial.title] : [];
  const course =
    (courses ?? []).find((item) => item.subject?.slug === slug) ??
    (courses ?? []).find((item) => titles.some((title) => item.title.includes(title))) ??
    null;
  return { slug, video: (videos ?? []).find((item) => item.externalUrl) ?? null, course, samples };
}

function lectureInstructor(title: string) {
  return title.split("—")[1]?.trim() ?? null;
}

const TOC = [
  { href: "#quick-answer", label: "پاسخ سریع" },
  { href: "#exam-status", label: "جایگاه در کنکور ۱۴۰۶" },
  { href: "#syllabus", label: "سرفصل و مباحث" },
  { href: "#study-path", label: "از کجا شروع کنم؟" },
  { href: "#learn", label: "یادگیری این درس" },
  { href: "#sources", label: "منابع" },
];

/** Start here: the free lecture, the full course and a consultant, side by side. */
function LearnBlock({ title, learning }: { title: string; learning: SubjectLearning }) {
  const publisher = learning.video?.sources?.[0]?.source?.publisher;
  return (
    <>
    <SubjectSamples subjectSlug={learning.slug} subjectTitle={title} samples={learning.samples} />
    <section id="learn" className="rd-block" aria-labelledby="learn-title">
      <div className="rd-block-head">
        <span className="eyebrow">یادگیری در کنکور کامپیوتر</span>
        <h2 id="learn-title">{title} را از همین‌جا یاد بگیر</h2>
        <p>از کلاس رایگان برای ساختن پایه، تا دورهٔ کنکوری و برنامهٔ هفتگی با مشاور.</p>
      </div>
      <div className="rd-learn">
        {learning.video?.externalUrl && (
          <a className="rd-learn-card rd-learn-free" href={learning.video.externalUrl} target="_blank" rel="noopener noreferrer">
            <span className="rd-learn-icon"><Glyph name="play" /></span>
            <small>رایگان · {publisher ?? "سایت ناشر"}</small>
            <strong>کلاس ضبط‌شدهٔ {lectureInstructor(learning.video.title) ?? title}</strong>
            <p>{learning.video.summary}</p>
            <span className="rd-learn-go">تماشا در سایت ناشر ↗</span>
          </a>
        )}
        {learning.course && (
          <Link className="rd-learn-card rd-learn-course" href={`/courses/${learning.course.slug}`}>
            <span className="rd-learn-icon"><Glyph name="trophy" /></span>
            <small>دورهٔ کنکوری</small>
            <strong>{learning.course.title}</strong>
            <p>{learning.course.description}</p>
            <span className="rd-learn-go">مشاهدهٔ دوره ←</span>
          </Link>
        )}
        <Link className="rd-learn-card rd-learn-consult" href="/consultations">
          <span className="rd-learn-icon"><Glyph name="chat" /></span>
          <small>با مدرس</small>
          <strong>برنامهٔ هفتگی و رفع اشکال</strong>
          <p>مشاورت برایت برنامه می‌چیند و انجام هر کار را در پنلت می‌بیند.</p>
          <span className="rd-learn-go">مشاوره ←</span>
        </Link>
      </div>
    </section>
    </>
  );
}

function SubjectAside({ learning }: { learning: SubjectLearning }) {
  return (
    <aside className="rd-aside" aria-label="راهنمای صفحه">
      <div className="rd-toc">
        <strong>در این صفحه</strong>
        <nav aria-label="فهرست مطالب">{TOC.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
      </div>
      <div className="rd-side-cta">
        <strong>همین امروز شروع کن</strong>
        <p>اولین جلسهٔ این درس را ببین؛ بعد با تست و دوره جلو برو.</p>
        {learning.video?.externalUrl ? (
          <a href={learning.video.externalUrl} target="_blank" rel="noopener noreferrer">ویدیوی رایگان این درس ↗</a>
        ) : (
          <Link href="/free-videos">ویدیوهای رایگان</Link>
        )}
        {learning.course ? <Link href={`/courses/${learning.course.slug}`}>دورهٔ کامل این درس</Link> : <Link href="/courses">دوره‌ها</Link>}
      </div>
    </aside>
  );
}

function heroFacts(editorial: EditorialSubject | undefined) {
  if (!editorial) return [];
  const facts = [];
  const phase11 = getPhase11Content(editorial.slug);
  const placement = phase11 ? officialPlacements(phase11.slug)[0] : undefined;
  if (placement) {
    facts.push(
      <span key="weight"><Glyph name="target" /><b>{coefficientLabel(placement.bundle)}</b> در مجموعهٔ {toPersianDigits(placement.track.collectionCode)}</span>,
    );
  }
  if (editorial.syllabus?.length) {
    facts.push(<span key="chapters"><Glyph name="list" /><b>{toPersianDigits(editorial.syllabus.length)}</b> فصل در سرفصل</span>);
  }
  if (editorial.prerequisites.length) {
    facts.push(<span key="pre"><Glyph name="flow" /><b>{toPersianDigits(editorial.prerequisites.length)}</b> پیش‌نیاز</span>);
  }
  return facts;
}

function HeroActions({ learning }: { learning: SubjectLearning }) {
  return (
    <div className="rd-cta">
      {learning.video?.externalUrl && (
        <a className="rd-btn rd-btn-light" href={learning.video.externalUrl} target="_blank" rel="noopener noreferrer">
          <Glyph name="play" />
          شروع با ویدیوی رایگان
        </a>
      )}
      {learning.course && (
        <Link className={`rd-btn ${learning.video ? "rd-btn-glass" : "rd-btn-light"}`} href={`/courses/${learning.course.slug}`}>
          <Glyph name="trophy" />
          دورهٔ کامل این درس
        </Link>
      )}
      <a className="rd-btn rd-btn-glass" href="#syllabus">
        <Glyph name="list" />
        سرفصل درس
      </a>
    </div>
  );
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

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await pendingParams;
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

function CanonicalSubjectPage({ subject, learning }: { subject: PublicSubjectDetail; learning: SubjectLearning }) {
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
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "نقشهٔ دروس کنکور کامپیوتر", url: absoluteUrl("/subjects") },
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

  // Topics, the learn block and related content sit above the sources, so
  // the page ends on its citations whichever renderer draws the rest.
  const extras = (
    <>
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
      <LearnBlock title={subject.title} learning={learning} />
      <RelatedContentGrid
        title="آموزش و محتوای مرتبط"
        description="دوره‌ها، مقاله‌ها و منابعی که برای همین درس آماده کرده‌ایم."
        items={toRelatedItems(subject)}
      />
    </>
  );
  const tone = SUBJECT_TONE[subject.slug] ?? "blue";

  return (
    <main className="rd-page">
      <ReadingProgress />
      <StructuredData data={schemas} />
      <ReadingHero
        tone={tone}
        crumbs={breadcrumbs}
        chips={legacy ? [legacy.status1406, ...legacy.tracks] : ["درس مرجع"]}
        title={subject.title}
        deck={subject.description ?? legacy?.description}
        meta={heroFacts(legacy)}
        art={<SubjectGlyph slug={subject.slug} />}
      >
        <HeroActions learning={learning} />
      </ReadingHero>

      <div className="rd-wrap rd-layout">
        <div className="rd-main">
          {subject.prerequisites.length > 0 && (
            <nav className="prerequisite-strip" aria-label="پیش‌نیازهای درس">
              <strong>پیش‌نیازهای ثبت‌شده</strong>
              {subject.prerequisites.map((item) => <Link href={`/subjects/${item.slug}`} key={item.code}>{item.title} ←</Link>)}
            </nav>
          )}

          {legacy && phase11 ? (
            <Phase11SubjectEditorial subject={legacy} content={phase11} beforeSources={extras} />
          ) : (
            extras
          )}
        </div>
        <SubjectAside learning={learning} />
      </div>
    </main>
  );
}

function LegacySubjectPage({ slug, apiUnavailable, learning }: { slug: string; apiUnavailable: boolean; learning: SubjectLearning }) {
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
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "نقشهٔ دروس کنکور کامپیوتر", url: absoluteUrl("/subjects") },
      citation: phase11.sources.map((source) => source.url),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
    },
  ];
  return (
    <main className="rd-page">
      <ReadingProgress />
      <StructuredData data={schemas} />
      <ReadingHero
        tone={SUBJECT_TONE[subject.slug] ?? "blue"}
        crumbs={[{ name: "خانه", href: "/" }, { name: "درس‌ها", href: "/subjects" }, { name: subject.shortTitle }]}
        chips={[subject.status1406, ...subject.tracks]}
        title={subject.title}
        deck={subject.description}
        meta={heroFacts(subject)}
        art={<SubjectGlyph slug={subject.slug} />}
      >
        <HeroActions learning={learning} />
      </ReadingHero>

      <div className="rd-wrap rd-layout">
        <div className="rd-main">
          {apiUnavailable && <aside className="official-disclaimer"><strong>نسخهٔ پایدار</strong><p>اتصال زندهٔ نقشهٔ دانش برقرار نیست؛ محتوای منبع‌دار و آخرین نسخهٔ ثابت این درس همچنان در دسترس است.</p></aside>}
          {prerequisites.length > 0 && <nav className="prerequisite-strip" aria-label="پیش‌نیازها"><strong>پیش‌نیازهای پیشنهادی</strong>{prerequisites.map((item) => item && <Link href={`/subjects/${item.slug}`} key={item.slug}>{item.shortTitle} ←</Link>)}</nav>}
          <Phase11SubjectEditorial
            subject={subject}
            content={phase11}
            beforeSources={<LearnBlock title={subject.title} learning={learning} />}
          />
          {related.length > 0 && (
            <section className="rd-block" aria-labelledby="related-guides-title">
              <div className="rd-block-head"><h2 id="related-guides-title">راهنماهای مرتبط</h2><p>راهنمای رشته‌هایی که این درس در آن‌ها می‌آید.</p></div>
              <div className="article-grid">{related.map((page) => <Link className="article-card" href={`${guides.includes(page) ? "/guides" : "/articles"}/${page.slug}`} key={page.slug}><span className="article-meta">{page.category}</span><h3>{page.title}</h3><p>{page.description}</p><span className="text-link">خواندن راهنما ←</span></Link>)}</div>
            </section>
          )}
        </div>
        <SubjectAside learning={learning} />
      </div>
    </main>
  );
}

export default async function SubjectPage({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
  const [result, learning] = await Promise.all([loadSubject(params.slug), loadLearning(params.slug)]);
  if (result.subject) return <CanonicalSubjectPage subject={result.subject} learning={learning} />;
  if (findSubject(params.slug)) return <LegacySubjectPage slug={params.slug} apiUnavailable={result.unavailable} learning={learning} />;
  if (result.unavailable) return <main className="page-container"><PublicServiceError label="صفحهٔ درس" /></main>;
  notFound();
}
