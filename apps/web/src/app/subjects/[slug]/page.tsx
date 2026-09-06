import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredData } from "../../../components/StructuredData";
import { articles, findSubject, guides, subjects } from "../../../content/editorial";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

export function generateStaticParams() { return subjects.map(({ slug }) => ({ slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata { const subject = findSubject(params.slug); return subject ? pageMetadata({ title: `${subject.title} برای کنکور کامپیوتر`, description: subject.description, path: `/subjects/${subject.slug}` }) : {}; }

export default function SubjectPage({ params }: { params: { slug: string } }) {
  const subject = findSubject(params.slug); if (!subject) notFound();
  const prerequisites = subject.prerequisites.map(findSubject).filter(Boolean);
  const related = [...guides, ...articles].filter((page) => page.relatedSubjects?.includes(subject.slug)).slice(0, 4);
  const breadcrumbs = [
    { name: "خانه", item: absoluteUrl("/") },
    { name: "درس‌ها", item: absoluteUrl("/subjects") },
    { name: subject.title, item: absoluteUrl(`/subjects/${subject.slug}`) },
  ];
  return <main className="page-container subject-detail">
    <StructuredData data={[
      { "@context": "https://schema.org", "@type": "Course", name: subject.title, description: subject.description, provider: { "@type": "Organization", name: "kunkur01", url: absoluteUrl("/") }, educationalLevel: "Graduate entrance exam", inLanguage: "fa-IR" },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, ...item })) },
    ]} />
    <nav className="breadcrumbs"><span><Link href="/">خانه</Link></span><span><i>/</i><Link href="/subjects">درس‌ها</Link></span><span><i>/</i>{subject.shortTitle}</span></nav>
    <section className="subject-detail-hero"><div className="subject-monogram subject-monogram-large">{subject.accent}</div><div><span className="eyebrow">{subject.status1406}</span><h1>{subject.title}</h1><p>{subject.description}</p><div className="subject-tags">{subject.tracks.map((track) => <span key={track}>{track}</span>)}</div></div></section>
    <aside className="official-disclaimer subject-disclaimer"><strong>اعتبار وضعیت ۱۴۰۶</strong><p>این وضعیت در ۱۵ شهریور ۱۴۰۵ با اطلاعیه‌های رسمی تطبیق داده شده است؛ برای ثبت‌نام و ضرایب، <a href="https://www.sanjesh.org/" target="_blank" rel="noreferrer">آخرین دفترچه و اصلاحیهٔ سازمان سنجش</a> ملاک نهایی است.</p></aside>
    <div className="subject-journey"><section className="surface-card"><span className="journey-number">۱</span><h2>یادگیری</h2><p>تعریف‌ها و ایده‌های پایه را به مثال و حل مسئله وصل کن.</p><ul>{subject.focus.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="surface-card"><span className="journey-number">۲</span><h2>تمرین مرتبط</h2><p>تمرین‌های مبحثی و تست‌های سال‌های گذشته در مرحلهٔ بعد به همین صفحه متصل می‌شوند.</p><Link className="text-link" href="/questions">مشاهده بانک فعلی ←</Link></section><section className="surface-card"><span className="journey-number">۳</span><h2>تحلیل عملکرد</h2><p>خطاها را بر اساس مفهوم، بی‌دقتی و کمبود زمان دسته‌بندی کن.</p><Link className="text-link" href="/rank-estimate">ورود به تحلیل ←</Link></section></div>
    {prerequisites.length > 0 && <section className="prerequisite-strip"><strong>پیش‌نیازهای پیشنهادی</strong>{prerequisites.map((item) => item && <Link href={`/subjects/${item.slug}`} key={item.slug}>{item.shortTitle} ←</Link>)}</section>}
    <section><div className="section-heading"><div><h2>راهنماهای مرتبط</h2><p>از این درس تا برنامهٔ آزمون</p></div></div><div className="article-grid">{related.map((page) => <Link className="article-card" href={`${guides.includes(page) ? "/guides" : "/articles"}/${page.slug}`} key={page.slug}><span className="article-meta">{page.category}</span><h3>{page.title}</h3><p>{page.description}</p></Link>)}</div></section>
  </main>;
}
