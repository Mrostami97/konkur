import Link from "next/link";
import { apiGetPublic } from "../lib/api";

interface Article {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export default async function HomePage() {
  const articles = await apiGetPublic<Article[]>("/articles");

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>KonkurCom 360</h1>
      <p>سایت مادر آموزش، سنجش و انتخاب‌رشته کنکور ارشد و دکتری کامپیوتر.</p>
      <p>
        <Link href="/courses">مشاهده دوره‌ها</Link>
      </p>

      <h2>آخرین مقالات</h2>
      {!articles || articles.length === 0 ? (
        <p>هنوز مقاله‌ای منتشر نشده است.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {articles.map((article) => (
            <li key={article.slug} style={{ marginBottom: "1rem" }}>
              <Link href={`/articles/${article.slug}`}>
                <strong>{article.title}</strong>
              </Link>
              <p>{article.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
