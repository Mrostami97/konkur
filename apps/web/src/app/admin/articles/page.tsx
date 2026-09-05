"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Article {
  id: string;
  slug: string;
  title: string;
  reviewStatus: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED";
}

function ArticlesAdmin() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [taxonomyMajor, setTaxonomyMajor] = useState("computer-engineering");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const list = await apiFetch<Article[]>("/admin/articles");
    setArticles(list);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createArticle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/admin/articles", {
        method: "POST",
        body: {
          slug,
          title,
          summary,
          contentBlocks: [{ type: "text", text: body }],
          taxonomyMajor: taxonomyMajor.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      setSlug("");
      setTitle("");
      setSummary("");
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ایجاد مقاله");
    }
  }

  async function transition(id: string, action: "submit" | "approve" | "reject") {
    await apiFetch(`/admin/articles/${id}/${action}`, { method: "POST" });
    await load();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>مدیریت مقالات</h1>

      <h2>مقاله جدید</h2>
      <form onSubmit={createArticle}>
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="خلاصه" value={summary} onChange={(e) => setSummary(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <textarea placeholder="متن" value={body} onChange={(e) => setBody(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="تگ‌های موضوعی (با کاما)" value={taxonomyMajor} onChange={(e) => setTaxonomyMajor(e.target.value)} style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">ایجاد پیش‌نویس</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <h2>همه مقالات</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {articles.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
              <td style={{ padding: "0.4rem" }}>{a.title}</td>
              <td style={{ padding: "0.4rem" }}>{a.reviewStatus}</td>
              <td style={{ padding: "0.4rem" }}>
                {(a.reviewStatus === "DRAFT" || a.reviewStatus === "REJECTED") && (
                  <button onClick={() => transition(a.id, "submit")}>ارسال برای بررسی</button>
                )}
                {a.reviewStatus === "IN_REVIEW" && (
                  <>
                    <button onClick={() => transition(a.id, "approve")}>تأیید</button>
                    <button onClick={() => transition(a.id, "reject")}>رد</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function ArticlesAdminPage() {
  return (
    <AdminGuard>
      <ArticlesAdmin />
    </AdminGuard>
  );
}
