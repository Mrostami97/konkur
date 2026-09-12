import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { BuyButton } from "../../../components/BuyButton";
import { CourseProgressPanel } from "../../../components/CourseProgressPanel";
import { StructuredData } from "../../../components/StructuredData";
import { EmptyState, PageHeader } from "../../../components/ui";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

interface Lesson {
  id: string;
  title: string;
  order: number;
  isPreview?: boolean;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  slug: string;
  title: string;
  description: string;
  accessMode?: "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";
  modules: CourseModule[];
}

interface Product {
  id: string;
  slug: string;
  prices: { amountRial: number }[];
}

async function loadCourse(slug: string) {
  try {
    return await apiGetPublic<Course>(`/courses/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = await loadCourse(params.slug);
  if (!course) return pageMetadata({ title: "دوره در دسترس نیست", description: "این دوره پیدا نشد یا سرویس یادگیری موقتاً در دسترس نیست.", path: `/courses/${params.slug}`, noIndex: true });
  return pageMetadata({ title: course.title, description: course.description, path: `/courses/${course.slug}` });
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const [course, product] = await Promise.all([
    loadCourse(params.slug),
    apiGetPublic<Product>(`/products/${encodeURIComponent(params.slug)}`).catch(() => null),
  ]);
  if (!course) notFound();
  const path = `/courses/${course.slug}`;
  const firstLessonId = course.modules.flatMap((module) => module.lessons)[0]?.id;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: course.title,
      description: course.description,
      url: absoluteUrl(path),
      provider: { "@id": absoluteUrl("/#organization") },
      inLanguage: "fa-IR",
      ...(product?.prices[0] ? { offers: { "@type": "Offer", price: product.prices[0].amountRial, priceCurrency: "IRR", url: absoluteUrl(path) } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "خانه", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "دوره‌ها", item: absoluteUrl("/courses") },
        { "@type": "ListItem", position: 3, name: course.title, item: absoluteUrl(path) },
      ],
    },
  ];

  return (
    <main className="page-container">
      <StructuredData data={schemas} />
      <PageHeader
        eyebrow={course.accessMode === "PUBLIC" ? "دورهٔ رایگان" : course.accessMode === "ACCOUNT" ? "ویژهٔ اعضا" : "دورهٔ تخصصی"}
        title={course.title}
        description={course.description}
        action={<Link className="button button-secondary" href="/courses">همهٔ دوره‌ها ←</Link>}
      />

      <section className="content-grid">
        <CourseProgressPanel courseSlug={course.slug} firstLessonId={firstLessonId} />
        <div className="surface-card">
          <span className="eyebrow">دسترسی دوره</span>
          <h2>{product ? "تهیهٔ دوره" : "شروع یادگیری"}</h2>
          {product?.prices[0] && <p><strong>{product.prices[0].amountRial.toLocaleString("fa-IR")} ریال</strong></p>}
          {product ? <BuyButton productId={product.id} /> : firstLessonId ? <Link className="button button-primary" href={`/lessons/${firstLessonId}`}>شروع از درس اول ←</Link> : <p className="muted-copy">هنوز درسی برای این دوره منتشر نشده است.</p>}
        </div>
      </section>

      <section>
        <div className="section-heading"><div><h2>سرفصل‌های دوره</h2><p>درس‌ها به ترتیب فصل نمایش داده شده‌اند؛ آخرین مشاهده در حساب ثبت می‌شود.</p></div></div>
        {course.modules.length === 0 ? (
          <EmptyState title="سرفصلی منتشر نشده است" description="بعد از انتشار درس‌ها، مسیر مطالعه در همین صفحه در دسترس خواهد بود." />
        ) : (
          <div className="content-grid-wide">
            {course.modules.map((module) => (
              <article className="surface-card" key={module.id}>
                <span className="eyebrow">فصل {module.order.toLocaleString("fa-IR")}</span>
                <h3>{module.title}</h3>
                {module.lessons.length === 0 ? <p className="muted-copy">درسی در این فصل منتشر نشده است.</p> : (
                  <ul className="quick-links">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link href={`/lessons/${lesson.id}`}>
                          <span>{lesson.title}</span>
                          {lesson.isPreview && <small>نمونهٔ آزاد</small>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
