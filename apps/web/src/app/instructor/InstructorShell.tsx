"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InstructorGuard, useInstructor } from "../../components/InstructorGuard";

const LINKS = [
  { href: "/instructor", label: "دوره‌ها و درآمد" },
  { href: "/instructor/consultations", label: "جلسه‌های مشاوره" },
];

/**
 * A separate shell from the admin panel on purpose. An instructor is not
 * staff: they see their own courses, their own share and their own bookings,
 * and nothing about the question bank, finances or other instructors.
 */
export function InstructorShell({ children }: { children: ReactNode }) {
  return (
    <InstructorGuard>
      <InstructorChrome>{children}</InstructorChrome>
    </InstructorGuard>
  );
}

function InstructorChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const profile = useInstructor();

  const active = LINKS.filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-sidebar-brand" href="/instructor">
          کنکورصفریک
          <small>پنل مدرس</small>
        </Link>
        <nav className="admin-nav-group" aria-label="پنل مدرس">
          <p className="admin-nav-group-title">{profile.displayName}</p>
          {LINKS.map((link) => (
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
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <nav className="admin-crumbs" aria-label="مسیر">
            <Link href="/instructor">پنل مدرس</Link>
            {active && (
              <>
                <span aria-hidden>/</span>
                <span>{active.label}</span>
              </>
            )}
          </nav>
          <div className="ds-row" style={{ gap: "var(--sp-2)" }}>
            {profile.isPublished && (
              <Link className="ds-btn ds-btn-ghost ds-btn-sm" href={`/authors/${profile.slug}`}>
                صفحهٔ عمومی من
              </Link>
            )}
            <Link className="ds-btn ds-btn-ghost ds-btn-sm" href="/">
              بازگشت به سایت
            </Link>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
