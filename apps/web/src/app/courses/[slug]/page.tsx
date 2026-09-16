import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { BuyButton } from "../../../components/BuyButton";
import { CourseProgressPanel } from "../../../components/CourseProgressPanel";
import { StructuredData } from "../../../components/StructuredData";
import { EmptyState, PageHeader } from "../../../components/ui";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";
import { findDirectCourseProduct, formatRial, type CatalogProduct } from "../catalog";

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

async function loadCourse(slug: string) {
  try {
    return {
      course: await apiGetPublic<Course>(`/courses/${encodeURIComponent(slug)}`),
      unavailable: false,
    };
  } catch {
    return { course: null, unavailable: true };
  }
}

async function loadCourseProduct(courseSlug: string) {
  try {
    const products = await apiGetPublic<CatalogProduct[]>("/products");
    return {
      product: findDirectCourseProduct(products ?? [], courseSlug),
      unavailable: products === null,
    };
  } catch {
    return { product: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadCourse(params.slug);
  if (!result.course) {
    return pageMetadata({
      title: result.unavailable ? "سرویس دوره‌ها موقتاً در دسترس نیست" : "دوره پیدا نشد",
      description: result.unavailable
        ? "دریافت اطلاعات دوره اکنون ممکن نیست؛ لطفاً کمی بعد دوباره تلاش کنید."
        : "دورهٔ درخواستی پیدا نشد.",
      path: `/courses/${params.slug}`,
      noIndex: true,
    });
  }
  return pageMetadata({ title: result.course.title, description: result.course.description, path: `/courses/${result.course.slug}` });
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const courseResult = await loadCourse(params.slug);
  if (!courseResult.course) {
    if (courseResult.unavailable) throw new Error("Public learning service is unavailable");
    notFound();
  }
  const course = courseResult.course;
  const accessMode = course.accessMode ?? "ENTITLEMENT";
  const productResult = accessMode === "ENTITLEMENT"
    ? await loadCourseProduct(course.slug)
    : { product: null, unavailable: false };
  const product = productResult.product;
  const path = `/courses/${course.slug}`;
  const firstLessonId = course.modules.flatMap((module) => module.lessons)[0]?.id;
  const purchasableProduct = accessMode === "ENTITLEMENT" ? product : null;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: course.title,
      description: course.description,
      url: absoluteUrl(path),
      provider: { "@id": absoluteUrl("/#organization") },
      inLanguage: "fa-IR",
      ...(purchasableProduct?.prices?.[0] ? { offers: { "@type": "Offer", price: purchasableProduct.prices[0].amountRial, priceCurrency: "IRR", url: absoluteUrl(path) } } : {}),
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
        eyebrow={accessMode === "PUBLIC" ? "دورهٔ رایگان" : accessMode === "ACCOUNT" ? "ویژهٔ اعضا" : "دورهٔ تخصصی"}
        title={course.title}
        description={course.description}
        action={<Link className="button button-secondary" href="/courses">همهٔ دوره‌ها ←</Link>}
      />

      <section className="content-grid">
        <CourseProgressPanel courseSlug={course.slug} firstLessonId={firstLessonId} />
        <div className="surface-card">
          <span className="eyebrow">دسترسی دوره</span>
          <h2>{accessMode === "PUBLIC" ? "شروع رایگان" : accessMode === "ACCOUNT" ? "شروع با حساب کاربری" : purchasableProduct ? "تهیهٔ دوره" : "وضعیت دسترسی"}</h2>
          {purchasableProduct?.prices?.[0] && <p><strong>{formatRial(purchasableProduct.prices[0].amountRial)}</strong></p>}
          {accessMode === "ENTITLEMENT" ? (
            productResult.unavailable
              ? <p className="muted-copy">اطلاعات خرید موقتاً در دسترس نیست؛ لطفاً کمی بعد دوباره تلاش کنید.</p>
              : purchasableProduct
                ? <BuyButton productId={purchasableProduct.id} />
                : <p className="muted-copy">در حال حاضر فروش مستقیم فعالی برای این دوره منتشر نشده است.</p>
          ) : firstLessonId ? (
            <Link className="button button-primary" href={`/lessons/${firstLessonId}`}>
              {accessMode === "ACCOUNT" ? "ورود و شروع دوره ←" : "شروع از درس اول ←"}
            </Link>
          ) : (
            <p className="muted-copy">هنوز درسی برای این دوره منتشر نشده است.</p>
          )}
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
