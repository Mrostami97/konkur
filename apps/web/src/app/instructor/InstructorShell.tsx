"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InstructorGuard, useInstructor } from "../../components/InstructorGuard";
import { PanelIcon, type IconName } from "../../components/PanelIcons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/instructor", label: "دوره‌ها و درآمد", icon: "money" },
  { href: "/instructor/consultations", label: "جلسه‌های مشاوره", icon: "consult" },
  { href: "/instructor/students", label: "دانشجوها و برنامه‌ها", icon: "students" },
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
          <Image className="admin-sidebar-logo" src="/brand/logo-128.webp" alt="" width={40} height={40} unoptimized />
          <span>
            کنکور کامپیوتر
            <small>پنل مدرس</small>
          </span>
        </Link>

        <nav className="admin-nav-group" aria-label="پنل مدرس">
          <p className="admin-nav-group-title">کار من</p>
          {LINKS.map((link) => (
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

        <div className="admin-sidebar-foot">
          <Link className="admin-sidebar-user" href="/account">
            <span className="admin-sidebar-avatar" aria-hidden="true">
              {profile.displayName.slice(0, 1)}
            </span>
            <div>
              <strong>{profile.displayName}</strong>
              <small>{profile.roleTitle ?? "مدرس"}</small>
            </div>
          </Link>
        </div>
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
