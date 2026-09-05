import Link from "next/link";
import { apiGetPublic } from "../../lib/api";

interface Product {
  slug: string;
  title: string;
  description: string;
  prices: { amountRial: number }[];
}

export default async function CoursesPage() {
  const products = await apiGetPublic<Product[]>("/products");

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>دوره‌ها</h1>
      {!products || products.length === 0 ? (
        <p>در حال حاضر دوره‌ای برای فروش وجود ندارد.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {products.map((product) => (
            <li
              key={product.slug}
              style={{ border: "1px solid #D7E2EA", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}
            >
              <Link href={`/courses/${product.slug}`}>
                <strong>{product.title}</strong>
              </Link>
              <p>{product.description}</p>
              {product.prices[0] && (
                <p>{product.prices[0].amountRial.toLocaleString("fa-IR")} تومان</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
