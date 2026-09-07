import Link from "next/link";
import { editorialDateIso, type EditorialPage } from "../content/editorial";
import { absoluteUrl } from "../lib/seo";
import { toPersianDigits } from "../lib/format";
import { StructuredData } from "./StructuredData";

export function EditorialPageView({ page, basePath }: { page: EditorialPage; basePath: "/articles" | "/guides" }) {
  const path = `${basePath}/${page.slug}`;
  const breadcrumbs = [
    { name: "خانه", item: absoluteUrl("/") },
    { name: basePath === "/guides" ? "راهنماها" : "مقاله‌ها", item: absoluteUrl(basePath) },
    { name: page.title, item: absoluteUrl(path) },
  ];

  return (
    <main className="editorial-shell">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: page.title,
            description: page.description,
            inLanguage: "fa-IR",
            datePublished: editorialDateIso(page.publishedAt),
            dateModified: editorialDateIso(page.reviewedAt),
            mainEntityOfPage: absoluteUrl(path),
            publisher: { "@type": "Organization", name: "kunkur01", url: absoluteUrl("/") },
            about: [page.degree, page.field, "کنکور تحصیلات تکمیلی"],
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })),
          },
        ]}
      />
      <nav className="breadcrumbs" aria-label="مسیر صفحه">
        {breadcrumbs.map((item, index) => (
          <span key={item.item}>
            {index > 0 && <i>/</i>}
            {index === breadcrumbs.length - 1 ? item.name : <Link href={new URL(item.item).pathname}>{item.name}</Link>}
          </span>
        ))}
      </nav>

      <div className="editorial-layout">
        <article className="editorial-article">
          <header className="editorial-hero">
            <div className="editorial-kickers">
              <span className="eyebrow">{page.category}</span>
              <span>{page.degree}</span>
              <span>{page.field}</span>
            </div>
            <h1>{page.title}</h1>
            <p className="editorial-deck">{page.description}</p>
            <div className="editorial-byline">
              <div className="editorial-dates"><span>آخرین بررسی {page.reviewedAt}</span><span>{toPersianDigits(page.readingMinutes)} دقیقه مطالعه</span></div>
            </div>
          </header>

          {basePath === "/guides" && (
            <aside className="official-disclaimer editorial-disclaimer">
              <strong>اعتبار اطلاعات ۱۴۰۶</strong>
              <p>این راهنما در {page.reviewedAt} بازبینی شده است؛ برای نام مجموعه، ضرایب و شرایط ثبت‌نام، آخرین دفترچه و اصلاحیهٔ سازمان سنجش ملاک نهایی است.</p>
            </aside>
          )}

          <div className="answer-first">
            <strong>پاسخ سریع</strong>
            <p>{page.sections[0]?.paragraphs?.[0] ?? page.description}</p>
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
              </section>
            ))}
          </div>

          <section className="sources-box" aria-labelledby="sources-title">
            <div><span>منابع و اعتبارسنجی</span><h2 id="sources-title">این مطلب بر چه اساسی نوشته شده؟</h2></div>
            <ol>{page.sources.map((source) => <li key={source.url + source.title}><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span>{source.publisher}{source.publishedAt ? ` • انتشار ${source.publishedAt}` : ""}{" • بررسی "}{source.checkedAt}</span></a></li>)}</ol>
            <p>اگر دفترچه یا اصلاحیهٔ رسمی جدیدی منتشر شود، تاریخ بازبینی و متن همین صفحه به‌روزرسانی می‌شود.</p>
          </section>
        </article>

        <aside className="editorial-aside">
          <div className="surface-card toc-card">
            <strong>در این صفحه</strong>
            <nav>{page.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{section.title}</a>)}</nav>
          </div>
          <div className="surface-card telegram-card">
            <span className="telegram-icon">↗</span>
            <strong>آپدیت‌های کنکور را از دست نده</strong>
            <p>خبرهای اصلی و تحلیل‌ها در کانال رسمی kunkur01 منتشر می‌شوند.</p>
            <a className="button button-primary" href="https://t.me/konkurcom" target="_blank" rel="noreferrer">عضویت در @konkurcom</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
