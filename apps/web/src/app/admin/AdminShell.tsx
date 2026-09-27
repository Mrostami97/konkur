"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminGuard, useStaffRoles } from "../../components/AdminGuard";
import { PanelIcon, type IconName } from "../../components/PanelIcons";

type NavLink = { href: string; label: string; icon: IconName; roles: string[] };

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
      { href: "/admin/articles", label: "مقاله‌ها", icon: "article", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/resources", label: "منابع آموزشی", icon: "resource", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/content-sources", label: "منابع و مستندات", icon: "source", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/contributors", label: "نویسندگان و مدرسان", icon: "people", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/achievements", label: "نتایج شاگردان", icon: "trophy", roles: ["ADMIN"] },
      { href: "/admin/taxonomy", label: "طبقه‌بندی موضوعی", icon: "tag", roles: ["AUTHOR", "ADMIN"] },
    ],
  },
  {
    title: "سنجش و آموزش",
    links: [
      { href: "/admin/questions", label: "بانک سؤال", icon: "question", roles: ["AUTHOR", "REVIEWER", "ADMIN"] },
      { href: "/admin/exams", label: "آزمون‌ها", icon: "exam", roles: ["AUTHOR", "ADMIN"] },
      { href: "/admin/courses", label: "دوره‌ها", icon: "course", roles: ["AUTHOR", "ADMIN"] },
      { href: "/admin/import", label: "ورود داده", icon: "import", roles: ["REVIEWER", "ADMIN"] },
    ],
  },
  {
    title: "کسب‌وکار",
    links: [
      { href: "/admin/payments", label: "پرداخت‌های کارت‌به‌کارت", icon: "money", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/commerce", label: "فروش و دسترسی‌ها", icon: "commerce", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/instructors", label: "مدرسان و سهم درآمد", icon: "instructor", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/consultations", label: "مشاوره", icon: "consult", roles: ["ADMIN", "FINANCE"] },
      { href: "/admin/crm", label: "CRM و رشد", icon: "crm", roles: ["ADMIN", "MENTOR"] },
      { href: "/admin/analytics", label: "بک‌تست تخمین رتبه", icon: "chart", roles: ["ADMIN"] },
      { href: "/admin/admissions", label: "دانشگاه‌ها و گرایش‌ها", icon: "university", roles: ["ADMIN"] },
    ],
  },
  {
    title: "سامانه",
    links: [
      { href: "/admin/users", label: "کاربران و نقش‌ها", icon: "students", roles: ["ADMIN"] },
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
          <Image className="admin-sidebar-logo" src="/brand/logo-128.webp" alt="" width={40} height={40} unoptimized />
          <span>
            کنکور کامپیوتر
            <small>پنل مدیریت</small>
          </span>
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
                <span className="admin-nav-ico">
                  <PanelIcon name={link.icon} />
                </span>
                {link.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="admin-sidebar-foot">
          <Link className="admin-sidebar-user" href="/account">
            <span className="admin-sidebar-avatar" aria-hidden="true">
              ح
            </span>
            <div>
              <strong>حساب من</strong>
              <small>{roles.join("، ")}</small>
            </div>
          </Link>
        </div>
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
