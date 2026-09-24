import type { Metadata } from "next";
import Link from "next/link";
import { apiGetPublic } from "../../lib/api";
import { ComingSoon } from "../../components/ComingSoon";
import { EmptyState } from "../../components/ui";
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
    // A catalog with nothing in it yet is a "coming soon" page, not one to rank.
    noIndex: result.unavailable || result.courses?.length === 0,
  });
}

export default async function CoursesPage() {
  const result = await loadCatalog();
  const catalog = result.courses
    ? buildCourseCatalog(result.courses, result.products, result.productCatalogUnavailable)
    : null;

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">یادگیری هدفمند</p>
          <h1>دوره‌ها</h1>
          <p className="pg-lede">مسیرهای آموزشی ارشد و دکتری کامپیوتر را بر اساس هدف و زمانت انتخاب کن.</p>
        </div>
      </div>

      <section className="pg-shell pg-sec">
        {!catalog ? (
          <EmptyState
            title="فهرست دوره‌ها در دسترس نیست"
            description="اتصال به سرویس محتوا برقرار نشد؛ بعداً دوباره امتحان کن."
          />
        ) : catalog.length === 0 ? (
          <ComingSoon
            icon="play"
            title="دوره‌های کامل به‌زودی منتشر می‌شوند"
            text="کلاس‌های درس‌به‌درس کنکورصفریک، از مفهوم تا تست کنکور، در حال آماده‌سازی برای سایت‌اند. تا آن موقع، نقشهٔ درس‌ها و راهنمای ۱۴۰۶ در دسترس است."
            alternatives={[
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
              { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
              { href: "/evidence", label: "مستندات تدریس" },
            ]}
          />
        ) : (
          <div className="pg-grid pg-grid-wide">
            {catalog.map((item) => (
              <article className="pg-card" key={item.course.slug}>
                <span className="pg-badge">{item.accessLabel}</span>
                <b>{item.course.title}</b>
                <small>{item.course.description}</small>
                <span className="pg-card-action pg-card-row">
                  <strong className="pg-price">{item.priceLabel}</strong>
                  <Link className="button button-secondary" href={item.href}>{item.ctaLabel}</Link>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
