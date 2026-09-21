"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { AdminPageHeader, Alert, Card, SkeletonRows } from "../../components/ds";

/** Every number here is read from a real admin endpoint. A tile whose source
 * request fails shows that it failed rather than a zero, because a zero an
 * operator cannot distinguish from a broken request is worse than no tile. */
type Tile = {
  label: string;
  href: string;
  hint: string;
  load: () => Promise<number>;
};

const countOf = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object" && "total" in value) return Number((value as { total: unknown }).total) || 0;
  return 0;
};

const TILES: Tile[] = [
  {
    label: "سؤال‌های منتشرشده",
    href: "/admin/questions",
    hint: "کل بانک سؤال",
    load: () => apiFetch<unknown>("/questions?pageSize=1").then(countOf),
  },
  {
    label: "آزمون‌ها",
    href: "/admin/exams",
    hint: "پیش‌نویس و منتشرشده",
    load: () => apiFetch<unknown>("/admin/exams").then(countOf),
  },
  {
    label: "دوره‌ها",
    href: "/admin/courses",
    hint: "پیش‌نویس و منتشرشده",
    load: () => apiFetch<unknown>("/admin/courses").then(countOf),
  },
  {
    label: "مقاله‌ها",
    href: "/admin/articles",
    hint: "همهٔ وضعیت‌های بازبینی",
    load: () => apiFetch<unknown>("/admin/articles").then(countOf),
  },
  {
    label: "محصول‌ها",
    href: "/admin/commerce",
    hint: "فعال و غیرفعال",
    load: () => apiFetch<unknown>("/admin/products").then(countOf),
  },
  {
    label: "سفارش‌ها",
    href: "/admin/commerce",
    hint: "همهٔ وضعیت‌ها",
    load: () => apiFetch<unknown>("/admin/orders").then(countOf),
  },
];

export default function AdminHomePage() {
  const [counts, setCounts] = useState<Record<string, number | "error">>({});
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFatal(null);
    try {
      const entries = await Promise.all(
        TILES.map(async (tile, index) => {
          try {
            return [String(index), await tile.load()] as const;
          } catch {
            return [String(index), "error" as const] as const;
          }
        }),
      );
      setCounts(Object.fromEntries(entries));
    } catch {
      setFatal("خواندن آمار پنل ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AdminPageHeader
        title="پنل مدیریت"
        description="وضعیت لحظه‌ای محتوا، سنجش و فروش. برای مدیریت هر بخش، از منوی کنار استفاده کنید."
      />

      {fatal && <Alert tone="danger">{fatal}</Alert>}

      {loading ? (
        <SkeletonRows rows={2} height="6rem" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", gap: "var(--sp-4)" }}>
          {TILES.map((tile, index) => {
            const value = counts[String(index)];
            return (
              <Link key={tile.label} href={tile.href} style={{ textDecoration: "none" }}>
                <Card interactive>
                  <p className="ds-subtitle" style={{ fontSize: "var(--text-sm)" }}>
                    {tile.label}
                  </p>
                  <strong
                    style={{
                      display: "block",
                      margin: "var(--sp-2) 0 var(--sp-1)",
                      fontSize: "var(--text-2xl)",
                      fontVariantNumeric: "tabular-nums",
                      color: value === "error" ? "var(--muted)" : "var(--ink)",
                    }}
                  >
                    {value === "error" ? "—" : (value ?? 0).toLocaleString("fa-IR")}
                  </strong>
                  <span className="ds-hint" style={{ margin: 0 }}>
                    {value === "error" ? "خواندن این عدد ممکن نشد" : tile.hint}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
