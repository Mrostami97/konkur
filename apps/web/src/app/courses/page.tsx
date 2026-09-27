import type { Metadata } from "next";
import Link from "next/link";
import { apiGetPublic } from "../../lib/api";
import { ComingSoon } from "../../components/ComingSoon";
import { EmptyState } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";
import "./course.css";
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
    description: "دوره‌های منتشرشدهٔ کنکور کامپیوتر با مسیر یادگیری و دسترسی روشن برای داوطلبان کنکور کامپیوتر.",
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
          <p className="pg-eyebrow">دوره‌ها</p>
          <h1>دوره‌های کامل، از پایه تا تست کنکور</h1>
          <p className="pg-lede">هر دوره درس‌به‌درس جلو می‌رود؛ با خرید هر دوره، بانک سؤال همان درس هم باز می‌شود.</p>
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
            text="کلاس‌های درس‌به‌درس کنکور کامپیوتر، از مفهوم تا تست کنکور، در حال آماده‌سازی برای سایت‌اند. تا آن موقع، نقشهٔ درس‌ها و راهنمای ۱۴۰۶ در دسترس است."
            alternatives={[
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
              { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
              { href: "/evidence", label: "مستندات تدریس" },
            ]}
          />
        ) : (
          <ul className="cc-list">
            {catalog.map((item) => (
              <li key={item.course.slug}>
                <article className="cc-row">
                  <div className="cc-body">
                    <span className="cc-kind">{item.accessLabel}</span>
                    <h2><Link href={item.href}>{item.course.title}</Link></h2>
                    <p>{item.course.description}</p>
                  </div>
                  <div className="cc-side">
                    <strong className="cc-price">{item.priceLabel}</strong>
                    <Link className="ds-btn ds-btn-secondary ds-btn-sm" href={item.href}>{item.ctaLabel.replace(/\s*←$/, "")}</Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
