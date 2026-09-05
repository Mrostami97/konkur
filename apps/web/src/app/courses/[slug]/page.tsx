import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { BuyButton } from "../../../components/BuyButton";

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

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const [course, product] = await Promise.all([
    apiGetPublic<Course>(`/courses/${params.slug}`),
    apiGetPublic<Product>(`/products/${params.slug}`),
  ]);
  if (!course) notFound();

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
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
