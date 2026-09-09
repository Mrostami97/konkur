import Link from "next/link";
import type { ReactNode } from "react";
import { ContentBlocks } from "./ContentBlocks";
import { StructuredData } from "./StructuredData";
import { EmptyState } from "./ui";
import { absoluteUrl } from "../lib/seo";
import { toPersianDigits } from "../lib/format";

export type PublicContentBlock = { type: string; [key: string]: unknown };
export type PublicAsset = { media_key: string; checksum: string };

export interface PublicProfileReference {
  slug: string;
  displayName: string;
  roleTitle: string | null;
}

export interface PublicSourceReference {
  relation: string;
  locator: string | null;
  claim: string | null;
  order: number;
  source: {
    title: string;
    publisher: string;
    canonicalUrl: string;
    deepUrl: string | null;
    checkedAt: string;
    licenseName: string | null;
    licenseUrl: string | null;
    attributionText: string | null;
  };
}

export interface PublicArticleRecord {
  slug: string;
  title: string;
  summary: string;
  contentType: "ARTICLE" | "GUIDE" | "NEWS" | "CASE_STUDY";
  quickAnswer: string | null;
  contentBlocks: PublicContentBlock[];
  assets: PublicAsset[];
  taxonomyMajor: string[];
  taxonomyTags: string[];
  taxonomyDegrees: string[];
  taxonomyFields: string[];
  subjectCodes: string[];
  topicCodes: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  validForYear: number | null;
  sourceValidatedAt: string | null;
  reviewDueAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  sources: PublicSourceReference[];
  authorProfile: PublicProfileReference | null;
  reviewerProfile: PublicProfileReference | null;
}

export interface PublicResourceRecord {
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  kind: string;
  accessMode: string;
  hostingMode: string;
  taxonomyDegrees: string[];
  taxonomyFields: string[];
  subjectCodes: string[];
  topicCodes: string[];
  reviewedAt: string | null;
  publishedAt: string | null;
  canAccess: boolean;
  externalUrl?: string;
  catalogProfile?: {
    learningType?: string;
    startLevel?: string;
    coverage?: string;
    volume?: string;
    sampleLabel?: string;
    costLabel?: string;
    relatedGuideSlugs?: string[];
  } | null;
  sources: PublicSourceReference[];
  authorProfile: PublicProfileReference | null;
  reviewerProfile: PublicProfileReference | null;
}

export interface RelatedPublicItem {
  href: string;
  title: string;
  summary?: string | null;
  label: string;
}

export function formatPublicDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toPersianDigits(value);
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function publicArticlePath(article: Pick<PublicArticleRecord, "slug" | "contentType">) {
  return `${article.contentType === "GUIDE" ? "/guides" : "/articles"}/${article.slug}`;
}

export function contentTypeLabel(type: PublicArticleRecord["contentType"]) {
  return ({ ARTICLE: "مقاله", GUIDE: "راهنما", NEWS: "خبر", CASE_STUDY: "مطالعهٔ موردی" })[type];
}

export function accessModeLabel(mode: string) {
  return ({ PUBLIC: "دسترسی آزاد", ACCOUNT: "ویژهٔ اعضا", ENTITLEMENT: "نیازمند تهیه" } as Record<string, string>)[mode] ?? mode;
}

export function resourceKindLabel(kind: string) {
  return ({
    NOTE: "جزوه",
    VIDEO: "ویدئو",
    PDF: "فایل PDF",
    EXTERNAL_LINK: "لینک آموزشی",
    OFFICIAL_NOTICE: "اطلاعیهٔ رسمی",
    EXAM_PROGRAM: "برنامهٔ آزمون",
    REGISTRATION_BOOKLET: "دفترچهٔ ثبت‌نام",
    QUESTION_BOOKLET: "دفترچهٔ سؤال",
    ANSWER_KEY: "کلید پاسخ",
    CORRECTION: "اصلاحیه",
    ACADEMIC_SYLLABUS: "سرفصل دانشگاهی",
    OPEN_TEXTBOOK: "کتاب آزاد",
    OLYMPIAD_PROBLEM_SET: "مجموعه مسئلهٔ المپیاد",
    OLYMPIAD_SOLUTION: "حل مسئلهٔ المپیاد",
    TELEGRAM_POST: "مطلب کانال",
    TRANSCRIPT: "متن آموزش",
  } as Record<string, string>)[kind] ?? kind;
}

export function degreeLabel(degree: string) {
  return ({ MASTER: "ارشد", PHD: "دکتری", master: "ارشد", phd: "دکتری" } as Record<string, string>)[degree] ?? degree;
}

export function PublicBreadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="مسیر صفحه">
      {items.map((item, index) => (
        <span key={`${item.name}-${index}`}>
          {index > 0 && <i aria-hidden="true">/</i>}
          {item.href ? <Link href={item.href}>{item.name}</Link> : <span aria-current="page">{item.name}</span>}
        </span>
      ))}
    </nav>
  );
}

export function RelatedContentGrid({
  title = "مطالب مرتبط",
  description,
  items,
}: {
  title?: string;
  description?: string;
  items: RelatedPublicItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="related-content-title">
      <div className="section-heading">
        <div>
          <h2 id="related-content-title">{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="article-grid">
        {items.map((item) => (
          <Link className="article-card" href={item.href} key={`${item.href}-${item.title}`}>
            <span className="article-meta">{item.label}</span>
            <h3>{item.title}</h3>
            {item.summary && <p>{item.summary}</p>}
            <span className="text-link">مشاهده ←</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PublicContentLoading({ label = "محتوا" }: { label?: string }) {
  return (
    <main className="page-container" aria-live="polite" aria-busy="true">
      <EmptyState title={`${label} در حال بارگذاری است`} description="چند لحظه صبر کنید." />
    </main>
  );
}

export function PublicServiceError({ label = "محتوا" }: { label?: string }) {
  return (
    <EmptyState
      title={`${label} فعلاً در دسترس نیست`}
      description="اتصال به سرویس محتوا برقرار نشد. کمی بعد دوباره امتحان کنید."
    />
  );
}

export interface ContentSection {
  id: string;
  title: string;
  blocks: PublicContentBlock[];
}

export function splitPublicContentBlocks(blocks: PublicContentBlock[]) {
  const intro: PublicContentBlock[] = [];
  const sections: ContentSection[] = [];
  let current: ContentSection | null = null;

  for (const rawBlock of blocks) {
    const block = rawBlock.type === "heading"
      ? { ...rawBlock, level: Math.max(2, Number(rawBlock.level) || 2) }
      : rawBlock;
    if (block.type === "heading") {
      current = {
        id: `section-${sections.length + 1}`,
        title: String(block.text ?? `بخش ${toPersianDigits(sections.length + 1)}`),
        blocks: [block],
      };
      sections.push(current);
    } else if (current) {
      current.blocks.push(block);
    } else {
      intro.push(block);
    }
  }
  return { intro, sections };
}

function ProfileLine({ profile, prefix }: { profile: PublicProfileReference; prefix: string }) {
  return (
    <span>
      {prefix}{" "}
      <Link href={`/authors/${profile.slug}`}>{profile.displayName}</Link>
      {profile.roleTitle ? ` · ${profile.roleTitle}` : ""}
    </span>
  );
}

export function PublicSourceList({ sources }: { sources: PublicSourceReference[] }) {
  if (sources.length === 0) return null;
  return (
    <section className="sources-box" aria-labelledby="sources-title">
      <div><span>منابع و اعتبارسنجی</span><h2 id="sources-title">منابع این مطلب</h2></div>
      <ol>
        {sources.map((link, index) => {
          const href = link.source.deepUrl ?? link.source.canonicalUrl;
          return (
            <li key={`${href}-${index}`}>
              <a href={href} target="_blank" rel="noreferrer">
                <strong>{link.source.title}</strong>
                <span>
                  {link.source.publisher}
                  {formatPublicDate(link.source.checkedAt) ? ` · بررسی ${formatPublicDate(link.source.checkedAt)}` : ""}
                  {link.locator ? ` · ${link.locator}` : ""}
                </span>
              </a>
              {link.claim && <p>{link.claim}</p>}
              {link.source.attributionText && <p>{link.source.attributionText}</p>}
              {link.source.licenseName && (
                <p>
                  مجوز: {link.source.licenseUrl
                    ? <a href={link.source.licenseUrl} target="_blank" rel="noreferrer">{link.source.licenseName}</a>
                    : link.source.licenseName}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function PublicArticleView({
  article,
  related = [],
}: {
  article: PublicArticleRecord;
  related?: RelatedPublicItem[];
}) {
  const path = publicArticlePath(article);
  const collectionName = article.contentType === "GUIDE" ? "راهنماها" : "مقاله‌ها";
  const collectionPath = article.contentType === "GUIDE" ? "/guides" : "/articles";
  const { intro, sections } = splitPublicContentBlocks(Array.isArray(article.contentBlocks) ? article.contentBlocks : []);
  const publishedAt = formatPublicDate(article.publishedAt);
  const reviewedAt = formatPublicDate(article.reviewedAt ?? article.sourceValidatedAt ?? article.updatedAt);
  const reviewDueAt = formatPublicDate(article.reviewDueAt);
  const articleSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${absoluteUrl(path)}#article`,
    headline: article.title,
    description: article.seoDescription ?? article.summary,
    inLanguage: "fa-IR",
    mainEntityOfPage: { "@id": `${absoluteUrl(path)}#webpage` },
    publisher: { "@id": absoluteUrl("/#organization") },
  };
  const webPageSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: article.title,
    mainEntity: { "@id": `${absoluteUrl(path)}#article` },
    inLanguage: "fa-IR",
  };
  if (article.publishedAt) articleSchema.datePublished = article.publishedAt;
  if (article.reviewedAt ?? article.updatedAt) articleSchema.dateModified = article.reviewedAt ?? article.updatedAt;
  if (article.authorProfile) {
    articleSchema.author = {
      "@type": "Person",
      name: article.authorProfile.displayName,
      url: absoluteUrl(`/authors/${article.authorProfile.slug}`),
    };
  }
  if (article.reviewerProfile) {
    webPageSchema.reviewedBy = {
      "@type": "Person",
      name: article.reviewerProfile.displayName,
      url: absoluteUrl(`/authors/${article.reviewerProfile.slug}`),
    };
  }
  if (article.sources.length > 0) {
    articleSchema.citation = article.sources.map((link) => link.source.deepUrl ?? link.source.canonicalUrl);
  }
  if (article.taxonomyTags.length > 0) articleSchema.keywords = article.taxonomyTags.join(", ");

  const breadcrumbItems = [
    { name: "خانه", href: "/" },
    { name: collectionName, href: collectionPath },
    { name: article.title },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href ?? path),
    })),
  };

  return (
    <main className="editorial-shell">
      <StructuredData data={[articleSchema, webPageSchema, breadcrumbSchema]} />
      <PublicBreadcrumbs items={breadcrumbItems} />
      <div className="editorial-layout">
        <article className="editorial-article">
          <header className="editorial-hero">
            <div className="editorial-kickers">
              <span className="eyebrow">{contentTypeLabel(article.contentType)}</span>
              {article.taxonomyDegrees.map((degree) => <span key={degree}>{degreeLabel(degree)}</span>)}
              {article.validForYear && <span>ویژهٔ {toPersianDigits(article.validForYear)}</span>}
            </div>
            <h1>{article.title}</h1>
            <p className="editorial-deck">{article.summary}</p>
            <div className="editorial-byline">
              {article.authorProfile && <span className="author-avatar" aria-hidden="true">{article.authorProfile.displayName.slice(0, 1)}</span>}
              <div>
                {article.authorProfile && <ProfileLine profile={article.authorProfile} prefix="نویسنده:" />}
                {article.reviewerProfile && <ProfileLine profile={article.reviewerProfile} prefix="بازبین:" />}
                {!article.authorProfile && !article.reviewerProfile && <span>انتساب تحریریه هنوز منتشر نشده است.</span>}
              </div>
              <div className="editorial-dates">
                {publishedAt && <span>انتشار {publishedAt}</span>}
                {reviewedAt && <span>آخرین بررسی {reviewedAt}</span>}
              </div>
            </div>
          </header>

          {article.quickAnswer && (
            <aside className="answer-first" aria-labelledby="quick-answer-title">
              <strong id="quick-answer-title">پاسخ سریع</strong>
              <p>{article.quickAnswer}</p>
            </aside>
          )}

          {reviewDueAt && (
            <aside className="official-disclaimer">
              <strong>موعد بررسی دوباره</strong>
              <p>این مطلب زمان‌حساس است و موعد بازبینی بعدی آن {reviewDueAt} ثبت شده است.</p>
            </aside>
          )}

          {article.contentBlocks.length > 0 ? (
            <div className="editorial-body">
              {intro.length > 0 && <ContentBlocks blocks={intro} assets={article.assets ?? []} />}
              {sections.map((section) => (
                <section id={section.id} key={section.id}>
                  <ContentBlocks blocks={section.blocks} assets={article.assets ?? []} />
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="متن کامل هنوز در دسترس نیست" description="این صفحه فقط اطلاعات انتشارِ تأییدشده را نمایش می‌دهد." />
          )}

          <PublicSourceList sources={article.sources ?? []} />
          <RelatedContentGrid items={related} description="پیوندهای تأییدشده بر اساس درس، مبحث و پروندهٔ همین محتوا." />
        </article>

        <aside className="editorial-aside" aria-label="راهنمای صفحه">
          {sections.length > 0 && (
            <div className="surface-card toc-card">
              <strong>در این صفحه</strong>
              <nav aria-label="فهرست مطالب">
                {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
              </nav>
            </div>
          )}
          <div className="surface-card telegram-card">
            <span className="telegram-icon" aria-hidden="true">↗</span>
            <strong>کانال رسمی کنکورصفریک</strong>
            <p>خبرها، آموزش‌ها و اصلاحیه‌های مطالب را از منبع رسمی دنبال کنید.</p>
            <a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">عضویت در @konkurcom</a>
          </div>
        </aside>
      </div>
    </main>
  );
}

export function DefinitionList({ children }: { children: ReactNode }) {
  return <dl className="surface-card">{children}</dl>;
}
