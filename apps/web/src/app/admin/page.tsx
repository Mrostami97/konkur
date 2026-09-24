"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatPersianNumber, formatRial } from "../../lib/format";
import { AdminPageHeader, Alert, BarChart, Card, Kpi, KpiGrid, SkeletonRows } from "../../components/ds";
import { PanelIcon, type IconName } from "../../components/PanelIcons";
import { useStaffRoles } from "../../components/AdminGuard";

/** Every number here is read from a real admin endpoint. A tile whose source
 * request fails shows that it failed rather than a zero, because a zero an
 * operator cannot distinguish from a broken request is worse than no tile. */
type Tile = {
  label: string;
  href: string;
  hint: string;
  icon: IconName;
  tone?: "teal" | "warm" | "info" | "success";
  roles: string[];
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
    icon: "question",
    roles: ["AUTHOR", "REVIEWER", "ADMIN"],
    load: () => apiFetch<unknown>("/questions?pageSize=1").then(countOf),
  },
  {
    label: "آزمون‌ها",
    href: "/admin/exams",
    hint: "پیش‌نویس و منتشرشده",
    icon: "exam",
    tone: "info",
    roles: ["AUTHOR", "ADMIN"],
    load: () => apiFetch<unknown>("/admin/exams").then(countOf),
  },
  {
    label: "دوره‌ها",
    href: "/admin/courses",
    hint: "پیش‌نویس و منتشرشده",
    icon: "course",
    tone: "info",
    roles: ["AUTHOR", "ADMIN"],
    load: () => apiFetch<unknown>("/admin/courses").then(countOf),
  },
  {
    label: "مقاله‌ها",
    href: "/admin/articles",
    hint: "همهٔ وضعیت‌های بازبینی",
    icon: "article",
    roles: ["AUTHOR", "REVIEWER", "ADMIN"],
    load: () => apiFetch<unknown>("/admin/articles").then(countOf),
  },
  {
    label: "محصول‌ها",
    href: "/admin/commerce",
    hint: "فعال و غیرفعال",
    icon: "commerce",
    tone: "warm",
    roles: ["ADMIN", "FINANCE"],
    load: () => apiFetch<unknown>("/admin/products").then(countOf),
  },
  {
    label: "سفارش‌ها",
    href: "/admin/commerce",
    hint: "همهٔ وضعیت‌ها",
    icon: "money",
    tone: "success",
    roles: ["ADMIN", "FINANCE"],
    load: () => apiFetch<unknown>("/admin/orders?pageSize=1").then(countOf),
  },
];

interface OrdersSummary {
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  revenueRial: number;
  monthly: { month: string; revenueRial: number }[];
}

export default function AdminHomePage() {
  const roles = useStaffRoles();
  const tiles = TILES.filter((tile) => tile.roles.some((role) => roles.includes(role)));
  const canSeeRevenue = ["ADMIN", "FINANCE"].some((role) => roles.includes(role));

  const [counts, setCounts] = useState<Record<string, number | "error">>({});
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFatal(null);
    try {
      const entries = await Promise.all(
        tiles.map(async (tile, index) => {
          try {
            return [String(index), await tile.load()] as const;
          } catch {
            return [String(index), "error" as const] as const;
          }
        }),
      );
      setCounts(Object.fromEntries(entries));
      // Only finance and admin may read orders; for everyone else the
      // revenue panel is simply not part of the page.
      if (canSeeRevenue) {
        setSummary(await apiFetch<OrdersSummary>("/admin/orders/summary").catch(() => null));
      }
    } catch {
      setFatal("خواندن آمار پنل ممکن نشد.");
    } finally {
      setLoading(false);
    }
    // `tiles` is derived from `roles` each render; depending on roles keeps
    // this stable while still reloading if the signed-in staff member changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(","), canSeeRevenue]);

  useEffect(() => {
    void load();
  }, [load]);

  // Solar Hijri months from the API ("1405-07"), shown as "۰۵/۰۷".
  const monthly = (summary?.monthly ?? []).map((row) => ({ label: row.month.slice(2).replace("-", "/"), value: row.revenueRial }));

  return (
    <>
      <AdminPageHeader
        title="پنل مدیریت"
        description="وضعیت لحظه‌ای محتوا، سنجش و فروش. برای مدیریت هر بخش، از منوی کنار استفاده کنید."
      />

      {fatal && <Alert tone="danger">{fatal}</Alert>}

      {loading ? (
        <SkeletonRows rows={2} height="7rem" />
      ) : (
        <div className="ds-stack-lg">
          {/* One grid, not two. Two grids of different lengths leave the
              shorter row stretched across the full width, which reads as a
              mistake rather than a hierarchy. */}
          <KpiGrid>
            {canSeeRevenue && (
              <>
                <Kpi
                  label="درآمد پرداخت‌شده"
                  value={summary ? formatRial(summary.revenueRial) : "—"}
                  hint={summary ? `از ${formatPersianNumber(summary.paidOrders)} سفارش پرداخت‌شده` : "خواندن درآمد ممکن نشد"}
                  icon={<PanelIcon name="money" />}
                  tone="success"
                  small
                />
                <Kpi
                  label="سفارش‌های پرداخت‌نشده"
                  value={summary ? formatPersianNumber(summary.unpaidOrders) : "—"}
                  hint="در انتظار، ناموفق یا لغوشده"
                  icon={<PanelIcon name="clock" />}
                  tone="warm"
                  href="/admin/commerce"
                />
              </>
            )}
            {tiles.map((tile, index) => {
              const value = counts[String(index)];
              return (
                <Kpi
                  key={tile.label}
                  label={tile.label}
                  value={value === "error" ? "—" : formatPersianNumber(value ?? 0)}
                  hint={value === "error" ? "خواندن این عدد ممکن نشد" : tile.hint}
                  icon={<PanelIcon name={tile.icon} />}
                  tone={tile.tone}
                  href={tile.href}
                />
              );
            })}
          </KpiGrid>

          {canSeeRevenue && (
            <Card padded={false}>
              <div className="ds-card-head">
                <div>
                  <h2 className="ds-title" style={{ fontSize: "var(--text-lg)" }}>
                    درآمد ماهانه
                  </h2>
                  <p className="ds-subtitle" style={{ marginTop: "var(--sp-1)" }}>
                    مجموع سفارش‌های پرداخت‌شده در هر ماه شمسی، دوازده ماه اخیر.
                  </p>
                </div>
                <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/admin/commerce">
                  همهٔ سفارش‌ها
                </Link>
              </div>
              <div style={{ padding: "var(--sp-5)" }}>
                <BarChart
                  points={monthly}
                  formatValue={formatRial}
                  emptyLabel={summary === null ? "خواندن سفارش‌ها ممکن نشد" : "هنوز سفارش پرداخت‌شده‌ای ثبت نشده"}
                />
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
