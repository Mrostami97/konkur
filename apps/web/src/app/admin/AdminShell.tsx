"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminGuard, useStaffRoles } from "../../components/AdminGuard";

type NavLink = { href: string; label: string; roles: string[] };

/**
 * Grouped so the sidebar reflects how the work actually splits, rather than
 * listing thirteen destinations flat the way the old index page did.
 *
 * Each link carries the roles its API endpoints actually require, taken from
 * the `@Roles` on the matching controller. The shell shows a link only to
 * someone who can use it: before this, a MENTOR (who may only reach CRM) was
 * offered the whole panel and met a 403 on every other page.
 */
const NAV_GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "محتوا",
    links: [
      { href: "/admin/articles", label: "مقاله‌ها", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/resources", label: "منابع آموزشی", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/content-sources", label: "منابع و مستندات", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/contributors", label: "نویسندگان و مدرسان", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/taxonomy", label: "طبقه‌بندی موضوعی", roles: ["AUTHOR", "ADMIN"] },
    ],
  },
  {
    title: "سنجش و آموزش",
    links: [
      { href: "/admin/questions", label: "بانک سؤال", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/exams", label: "آزمون‌ها", roles: ["AUTHOR", "ADMIN"] },
      { href: "/admin/courses", label: "دوره‌ها", roles: ["AUTHOR", "ADMIN"] },
      { href: "/admin/import", label: "ورود داده", roles: ["REVIEWER", "ADMIN"] },
    ],
  },
  {
    title: "کسب‌وکار",
    links: [
      { href: "/admin/commerce", label: "فروش و دسترسی‌ها", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/instructors", label: "مدرسان و سهم درآمد", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/consultations", label: "مشاوره", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/crm", label: "CRM و رشد", roles: ["ADMIN", "MENTOR"] },
      { href: "/admin/analytics", label: "بک‌تست تخمین رتبه", roles: ["ADMIN"] },
      { href: "/admin/admissions", label: "دانشگاه‌ها و گرایش‌ها", roles: ["ADMIN"] },
    ],
  },
];

const ALL_LINKS = NAV_GROUPS.flatMap((group) => group.links);

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <AdminChrome>{children}</AdminChrome>
    </AdminGuard>
  );
}

/** Split from AdminShell so it renders inside the guard, where the roles it
 * filters by are available. */
function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const roles = useStaffRoles();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => link.roles.some((role) => roles.includes(role))),
  })).filter((group) => group.links.length > 0);

  // Longest match wins so /admin/import/[jobId] still highlights "ورود داده".
  const active = ALL_LINKS.filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-sidebar-brand" href="/admin">
          کنکورصفریک
          <small>پنل مدیریت</small>
        </Link>
        {visibleGroups.map((group) => (
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
  );
}
