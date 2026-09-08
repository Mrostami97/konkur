import type { Metadata } from "next";
import Link from "next/link";
import { apiGetPublic } from "../../lib/api";
import { EmptyState, PageHeader } from "../../components/ui";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "دوره‌های کنکور ارشد و دکتری کامپیوتر",
  description: "دوره‌های منتشرشدهٔ کنکورصفریک با مسیر یادگیری و دسترسی روشن برای داوطلبان کنکور کامپیوتر.",
  path: "/courses",
});

interface Product {
  slug: string;
  title: string;
  description: string;
  prices?: { amountRial: number }[];
}

export default async function CoursesPage() {
  let products: Product[] | null = null;
  try {
    products = await apiGetPublic<Product[]>("/products");
  } catch {
    products = null;
  }

  return (
    <main className="page-container">
      <PageHeader eyebrow="یادگیری هدفمند" title="دوره‌ها" description="مسیرهای آموزشی ارشد و دکتری کامپیوتر را بر اساس هدف و زمانت انتخاب کن." />
      {!products ? (
        <EmptyState title="فهرست دوره‌ها در دسترس نیست" description="اتصال به سرویس محتوا برقرار نشد؛ بعداً دوباره امتحان کن." />
      ) : products.length === 0 ? (
        <EmptyState title="هنوز دوره‌ای منتشر نشده است" description="به‌محض انتشار دورهٔ جدید، اینجا نمایش داده می‌شود." />
      ) : (
        <div className="course-grid">
          {products.map((product) => (
            <article className="catalog-card" key={product.slug}>
              <div><div className="catalog-card-meta"><span>دورهٔ تخصصی</span><span>یادگیری</span></div><Link href={`/courses/${product.slug}`}><h3>{product.title}</h3></Link><p>{product.description}</p></div>
              <div className="catalog-card-footer">{product.prices?.[0] ? <strong>{product.prices[0].amountRial.toLocaleString("fa-IR")} تومان</strong> : <span className="muted-copy">جزئیات در صفحهٔ دوره</span>}<Link className="button button-secondary" href={`/courses/${product.slug}`}>مشاهده دوره ←</Link></div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
