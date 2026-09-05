"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminGuard } from "../../../components/AdminGuard";
import { apiFetch } from "../../../lib/api";

interface Course {
  id: string;
  title: string;
}

interface Product {
  id: string;
  slug: string;
  title: string;
  prices: { amountRial: number; isActive: boolean }[];
}

interface AdminUser {
  id: string;
  phone: string;
}

interface Order {
  id: string;
  status: string;
  totalAmountRial: number;
  user: { phone: string };
}

function CommerceAdmin() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");

  const [priceProductId, setPriceProductId] = useState("");
  const [amountRial, setAmountRial] = useState("");

  const [grantUserId, setGrantUserId] = useState("");
  const [grantProductId, setGrantProductId] = useState("");
  const [grantVia, setGrantVia] = useState<"GIFT" | "TRIAL" | "MANUAL">("GIFT");
  const [grantReason, setGrantReason] = useState("");

  async function loadAll() {
    const [c, p, u, o] = await Promise.all([
      apiFetch<Course[]>("/admin/courses"),
      apiFetch<Product[]>("/admin/products"),
      apiFetch<AdminUser[]>("/admin/users").then((r: any) => r.users),
      apiFetch<Order[]>("/admin/orders"),
    ]);
    setCourses(c);
    setProducts(p);
    setUsers(u);
    setOrders(o);
  }

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  async function createProduct(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/products", {
      method: "POST",
      body: { slug, title, description, kind: "COURSE", courseId },
    });
    setSlug("");
    setTitle("");
    setDescription("");
    await loadAll();
  }

  async function addPrice(e: FormEvent) {
    e.preventDefault();
    await apiFetch(`/admin/products/${priceProductId}/prices`, {
      method: "POST",
      body: { amountRial: Number(amountRial) },
    });
    setAmountRial("");
    await loadAll();
  }

  async function grantEntitlement(e: FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/entitlements/grant", {
      method: "POST",
      body: { userId: grantUserId, productId: grantProductId, grantedVia: grantVia, reason: grantReason },
    });
    setGrantReason("");
    await loadAll();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>فروش و دسترسی‌ها</h1>

      <h2>محصول جدید</h2>
      <form onSubmit={createProduct}>
        <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <input placeholder="توضیحات" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="">دوره را انتخاب کنید</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button type="submit">ایجاد محصول</button>
      </form>

      <h2>افزودن قیمت</h2>
      <form onSubmit={addPrice}>
        <select value={priceProductId} onChange={(e) => setPriceProductId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="">محصول را انتخاب کنید</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <input placeholder="مبلغ به ریال" value={amountRial} onChange={(e) => setAmountRial(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">ثبت قیمت</button>
      </form>

      <h2>محصولات</h2>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.title} — {p.prices.find((pr) => pr.isActive)?.amountRial.toLocaleString("fa-IR") ?? "بدون قیمت فعال"} ریال
          </li>
        ))}
      </ul>

      <h2>اعطای دسترسی هدیه/آزمایشی/جبرانی</h2>
      <form onSubmit={grantEntitlement}>
        <select value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="">کاربر را انتخاب کنید</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.phone}
            </option>
          ))}
        </select>
        <select value={grantProductId} onChange={(e) => setGrantProductId(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="">محصول را انتخاب کنید</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <select value={grantVia} onChange={(e) => setGrantVia(e.target.value as any)} style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }}>
          <option value="GIFT">هدیه</option>
          <option value="TRIAL">آزمایشی</option>
          <option value="MANUAL">جبرانی</option>
        </select>
        <input placeholder="دلیل" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} required style={{ display: "block", width: "100%", padding: "0.4rem", marginBottom: "0.4rem" }} />
        <button type="submit">اعطای دسترسی</button>
      </form>

      <h2>سفارش‌ها</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #D7E2EA" }}>
              <td style={{ padding: "0.4rem" }}>{o.user.phone}</td>
              <td style={{ padding: "0.4rem" }}>{o.status}</td>
              <td style={{ padding: "0.4rem" }}>{o.totalAmountRial.toLocaleString("fa-IR")} ریال</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

export default function CommerceAdminPage() {
  return (
    <AdminGuard>
      <CommerceAdmin />
    </AdminGuard>
  );
}
