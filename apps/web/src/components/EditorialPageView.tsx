import Link from "next/link";
import { editorialDateIso, findSubject, type EditorialPage } from "../content/editorial";
import { absoluteUrl, articleModifiedTime, OWNER_PROFILE_SLUG, personReference } from "../lib/seo";
import { toPersianDigits } from "../lib/format";
import { StructuredData } from "./StructuredData";
import { RelatedContentGrid, type RelatedPublicItem } from "./PublicContent";
import { NextSteps, readingNextSteps } from "./reading/NextSteps";
import { ReadingHero } from "./reading/ReadingHero";
import { ReadingProgress } from "./reading/ReadingProgress";
import { OWNER_NAME, OwnerPhoto } from "./OwnerByline";
import { Glyph, SUBJECT_TONE, SubjectGlyph } from "./SubjectIcon";
import { RichText } from "./ContentBlocks";
import { faqSchemaFromPairs } from "../lib/faq-schema";
import { canonicalHref } from "../lib/merged-pages";

/**
 * The answer-first line. A page without a written quick answer used to fall
 * back to its own deck, so the reader saw the same sentence twice; the first
 * section's key points say something the deck does not.
 */
function quickAnswer(page: EditorialPage) {
  if (page.quickAnswer) return page.quickAnswer;
  const first = page.sections[0];
  if (first?.paragraphs?.[0]) return first.paragraphs[0];
  if (first?.bullets?.length) return `${first.title}: ${first.bullets.join("، ")}.`;
  return page.description;
}

export function EditorialPageView({
  page,
  basePath,
  related = [],
  showOfficialDisclaimer = basePath === "/guides",
}: {
  page: EditorialPage;
  basePath: "/articles" | "/guides";
  related?: RelatedPublicItem[];
  showOfficialDisclaimer?: boolean;
}) {
  const path = `${basePath}/${page.slug}`;
  const relatedSubjects = (page.relatedSubjects ?? []).flatMap((slug) => {
    const subject = findSubject(slug);
    return subject ? [subject] : [];
  });
  const breadcrumbs = [
    { name: "خانه", item: absoluteUrl("/") },
    { name: basePath === "/guides" ? "راهنماها" : "مقاله‌ها", item: absoluteUrl(basePath) },
    { name: page.title, item: absoluteUrl(path) },
  ];
  const lead = relatedSubjects[0];
  const tone = lead ? SUBJECT_TONE[lead.slug] ?? "blue" : basePath === "/guides" ? "teal" : "blue";
  const authorIsOwner = page.author === OWNER_NAME;
  const reviewerIsOwner = page.reviewer === OWNER_NAME;
  const reviewPending = page.reviewer === "در انتظار بازبینی انسانی";
  const publishedAt = editorialDateIso(page.publishedAt);
  const modifiedAt = reviewPending ? undefined : articleModifiedTime(publishedAt, page.reviewedAtIso ?? editorialDateIso(page.reviewedAt));
  const faq = page.faq ?? [];
  const faqSchema = faqSchemaFromPairs(faq, absoluteUrl(path));

  return (
    <main className="rd-page">
      <ReadingProgress />
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: page.title,
            description: page.description,
            inLanguage: "fa-IR",
            author: authorIsOwner
              ? personReference({ slug: OWNER_PROFILE_SLUG, displayName: OWNER_NAME })
              : { "@type": "Organization", name: page.author, url: absoluteUrl("/") },
            datePublished: publishedAt,
            ...(modifiedAt ? { dateModified: modifiedAt } : {}),
            mainEntityOfPage: absoluteUrl(path),
            publisher: { "@type": "Organization", name: "کنکور کامپیوتر", url: absoluteUrl("/") },
            about: [page.degree, page.field, "کنکور تحصیلات تکمیلی"],
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
          },
          ...(faqSchema ? [faqSchema] : []),
        ]}
      />

      <ReadingHero
        tone={tone}
        crumbs={breadcrumbs.map((item, index) => ({
          name: item.name,
          href: index === breadcrumbs.length - 1 ? undefined : new URL(item.item).pathname,
        }))}
        chips={[page.category, page.degree, page.field]}
        title={page.title}
        deck={page.description}
        meta={[
          <span key="reviewed"><Glyph name="shield" />{reviewPending ? "تاریخ ثبت" : "آخرین بررسی"} <b>{page.reviewedAt}</b></span>,
          <span key="minutes"><Glyph name="pace" /><b>{toPersianDigits(page.readingMinutes)}</b> دقیقه مطالعه</span>,
          <span key="sources"><Glyph name="list" /><b>{toPersianDigits(page.sources.length)}</b> منبع</span>,
        ]}
        art={lead ? <SubjectGlyph slug={lead.slug} /> : <Glyph name={basePath === "/guides" ? "compass" : "book"} />}
      />

      <div className="rd-wrap rd-layout">
        <article className="rd-main">
          {showOfficialDisclaimer && (
            <aside className="official-disclaimer editorial-disclaimer">
              <strong>اعتبار اطلاعات ۱۴۰۶</strong>
              <p>{reviewPending
                ? "برای نام مجموعه، ضرایب و شرایط ثبت‌نام، آخرین دفترچه و اصلاحیهٔ سازمان سنجش ملاک نهایی است."
                : `این راهنما در ${page.reviewedAt} بازبینی شده است؛ برای نام مجموعه، ضرایب و شرایط ثبت‌نام، آخرین دفترچه و اصلاحیهٔ سازمان سنجش ملاک نهایی است.`}</p>
            </aside>
          )}

          <div className="answer-first">
            <strong>پاسخ سریع</strong>
            <p><RichText text={quickAnswer(page)} /></p>
          </div>

          <div className="editorial-body">
            {page.sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                {section.table && (
                  <div className="responsive-table"><table><thead><tr>{section.table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{section.table.rows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
                )}
                {section.note && <aside className="editorial-note"><strong>نکتهٔ مهم</strong><p>{section.note}</p></aside>}
                {section.links && section.links.length > 0 && (
                  <p className="editorial-links">
                    <span>بیشتر بخوان:</span>
                    {section.links.map((link) => <Link key={link.href} href={canonicalHref(link.href)}>{link.label}</Link>)}
                  </p>
                )}
              </section>
            ))}
            {faq.length > 0 && (
              <section id="faq" className="editorial-faq">
                <h2>پرسش‌های رایج</h2>
                {faq.map((item) => (
                  <div key={item.question}>
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </div>
                ))}
              </section>
            )}
          </div>

          {relatedSubjects.length > 0 && (
            <section className="rd-block" aria-labelledby="guide-subjects-title">
              <div className="rd-block-head">
                <span className="eyebrow">از جدول آزمون تا برنامهٔ مطالعه</span>
                <h2 id="guide-subjects-title">صفحهٔ اختصاصی درس‌های این مسیر</h2>
                <p>وضعیت ۱۴۰۶، سرفصل مرجع، پیش‌نیازها و ترتیب شروع هر درس را جداگانه ببین.</p>
              </div>
              <div className="subject-grid">
                {relatedSubjects.map((subject) => (
                  <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
                    <div className="subject-monogram"><SubjectGlyph slug={subject.slug} className="rd-mono-glyph" /></div>
                    <div>
                      <span className="subject-status">{subject.status1406}</span>
                      <h3>{subject.title}</h3>
                      <p>{subject.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="rd-author" aria-label="تهیه و بازبینی">
            {authorIsOwner ? <OwnerPhoto /> : <span className="rd-author-mark" aria-hidden="true">ک</span>}
            <div>
              <strong>
                نویسنده: {authorIsOwner ? <Link href="/about">{page.author}</Link> : page.author}
                {reviewPending
                  ? null
                  : <> · بازبین: {reviewerIsOwner ? <Link href="/about">{page.reviewer}</Link> : page.reviewer}</>}
              </strong>
              <p>منابع این مطلب در پایین صفحه آمده‌اند. روش کار را در <Link href="/editorial-policy">روش تولید محتوا</Link> ببین.</p>
            </div>
          </section>

          <section className="sources-box" aria-labelledby="sources-title">
            <div><span>منابع و اعتبارسنجی</span><h2 id="sources-title">این مطلب بر چه اساسی نوشته شده؟</h2></div>
            <ol>{page.sources.map((source) => <li key={source.url + source.title}><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span>{source.publisher}{source.publishedAt ? ` • انتشار ${source.publishedAt}` : ""}{" • بررسی "}{source.checkedAt}</span></a></li>)}</ol>
            <p>اگر دفترچه یا اصلاحیهٔ رسمی جدیدی منتشر شود، تاریخ بازبینی و متن همین صفحه به‌روزرسانی می‌شود.</p>
          </section>

          <RelatedContentGrid
            items={related}
            title="ادامهٔ همین مسیر"
            description="این پیوندها بخشی از مسیر همین راهنما هستند؛ از هر کدام می‌توانی مطالعه را ادامه بدهی."
          />

          <NextSteps
            lead="خواندن کافی نیست؛ از همین‌جا مطالعه را شروع کن."
            steps={readingNextSteps(lead ? { slug: lead.slug, shortTitle: lead.shortTitle } : undefined)}
          />
        </article>

        <aside className="rd-aside" aria-label="راهنمای صفحه">
          <div className="rd-toc">
            <strong>در این صفحه</strong>
            <nav aria-label="فهرست مطالب">{page.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{section.title}</a>)}{faq.length > 0 && <a href="#faq">پرسش‌های رایج</a>}</nav>
          </div>
          <div className="rd-side-cta">
            <strong>آپدیت‌های کنکور را از دست نده</strong>
            <p>خبرهای اصلی و تحلیل‌ها در کانال رسمی کنکور کامپیوتر منتشر می‌شوند.</p>
            <a href="https://t.me/kunkurcomputer" target="_blank" rel="noreferrer">عضویت در @kunkurcomputer</a>
            <Link href="/free-videos">ویدیوی رایگان هر درس</Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
