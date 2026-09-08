import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { BuyButton } from "../../../components/BuyButton";
import { StructuredData } from "../../../components/StructuredData";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

interface Lesson {
  id: string;
  title: string;
  order: number;
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
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <StructuredData data={schemas} />
      <h1>{course.title}</h1>
      <p>{course.description}</p>

      {product && product.prices[0] && (
        <p>
          <strong>{product.prices[0].amountRial.toLocaleString("fa-IR")} تومان</strong>
        </p>
      )}
      {product && <BuyButton productId={product.id} />}

      <h2>سرفصل‌ها</h2>
      {course.modules.map((mod) => (
        <div key={mod.id} style={{ marginBottom: "1rem" }}>
          <h3>{mod.title}</h3>
          <ul>
            {mod.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/lessons/${lesson.id}`}>{lesson.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  );
}
