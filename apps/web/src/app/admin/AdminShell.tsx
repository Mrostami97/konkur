"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminGuard } from "../../components/AdminGuard";

/** Grouped so the sidebar reflects how the work actually splits, rather than
 * listing thirteen destinations flat the way the old index page did. */
const NAV_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "محتوا",
    links: [
      { href: "/admin/articles", label: "مقاله‌ها" },
      { href: "/admin/resources", label: "منابع آموزشی" },
      { href: "/admin/content-sources", label: "منابع و مستندات" },
      { href: "/admin/contributors", label: "نویسندگان" },
      { href: "/admin/taxonomy", label: "طبقه‌بندی موضوعی" },
    ],
  },
  {
    title: "سنجش و آموزش",
    links: [
      { href: "/admin/questions", label: "بانک سؤال" },
      { href: "/admin/exams", label: "آزمون‌ها" },
      { href: "/admin/courses", label: "دوره‌ها" },
      { href: "/admin/import", label: "ورود داده" },
    ],
  },
  {
    title: "کسب‌وکار",
    links: [
      { href: "/admin/commerce", label: "فروش و دسترسی‌ها" },
      { href: "/admin/crm", label: "CRM و رشد" },
      { href: "/admin/analytics", label: "بک‌تست تخمین رتبه" },
      { href: "/admin/admissions", label: "دانشگاه‌ها و گرایش‌ها" },
    ],
  },
];

const ALL_LINKS = NAV_GROUPS.flatMap((group) => group.links);

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  // Longest match wins so /admin/import/[jobId] still highlights "ورود داده".
  const active = ALL_LINKS.filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  return (
    <AdminGuard>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-sidebar-brand" href="/admin">
            کنکورصفریک
            <small>پنل مدیریت</small>
          </Link>
          {NAV_GROUPS.map((group) => (
            <nav className="admin-nav-group" key={group.title} aria-label={group.title}>
              <p className="admin-nav-group-title">{group.title}</p>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="admin-nav-link"
                  aria-current={active?.href === link.href ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <nav className="admin-crumbs" aria-label="مسیر">
              <Link href="/admin">پنل مدیریت</Link>
              {active && (
                <>
                  <span aria-hidden>/</span>
                  <span>{active.label}</span>
                </>
              )}
            </nav>
            <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/">
              بازگشت به سایت
            </Link>
          </header>
          <main className="admin-content">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
