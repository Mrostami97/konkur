import type { Metadata } from "next";
import Link from "next/link";
import { apiGetPublic } from "../../lib/api";
import { EmptyState, PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";
import {
  buildCourseCatalog,
  type CatalogCourse,
  type CatalogProduct,
} from "./catalog";

async function loadCatalog() {
  let courses: CatalogCourse[] | null;
  try {
    courses = await apiGetPublic<CatalogCourse[]>("/courses");
  } catch {
    return { courses: null, products: [], unavailable: true, productCatalogUnavailable: true };
  }

  if (!courses) {
    return { courses: null, products: [], unavailable: true, productCatalogUnavailable: true };
  }

  try {
    const products = await apiGetPublic<CatalogProduct[]>("/products");
    return {
      courses,
      products: products ?? [],
      unavailable: false,
      productCatalogUnavailable: products === null,
    };
  } catch {
    return { courses, products: [], unavailable: false, productCatalogUnavailable: true };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const result = await loadCatalog();
  return pageMetadata({
    title: "دوره‌های کنکور ارشد و دکتری کامپیوتر",
    description: "دوره‌های منتشرشدهٔ کنکورصفریک با مسیر یادگیری و دسترسی روشن برای داوطلبان کنکور کامپیوتر.",
    path: "/courses",
    noIndex: result.unavailable,
  });
}

export default async function CoursesPage() {
  const result = await loadCatalog();
  const catalog = result.courses
    ? buildCourseCatalog(result.courses, result.products, result.productCatalogUnavailable)
    : null;

  return (
    <main className="page-container">
      <PageHeader eyebrow="یادگیری هدفمند" title="دوره‌ها" description="مسیرهای آموزشی ارشد و دکتری کامپیوتر را بر اساس هدف و زمانت انتخاب کن." />
      {!catalog ? (
        <EmptyState title="فهرست دوره‌ها در دسترس نیست" description="اتصال به سرویس محتوا برقرار نشد؛ بعداً دوباره امتحان کن." />
      ) : catalog.length === 0 ? (
        <EmptyState title="هنوز دوره‌ای منتشر نشده است" description="به‌محض انتشار دورهٔ جدید، اینجا نمایش داده می‌شود." />
      ) : (
        <div className="course-grid">
          {catalog.map((item) => (
            <article className="catalog-card" key={item.course.slug}>
              <div>
                <div className="catalog-card-meta"><span>{item.accessLabel}</span><span>یادگیری</span></div>
                <Link href={item.href}><h3>{item.course.title}</h3></Link>
                <p>{item.course.description}</p>
              </div>
              <div className="catalog-card-footer">
                <strong>{item.priceLabel}</strong>
                <Link className="button button-secondary" href={item.href}>{item.ctaLabel}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
