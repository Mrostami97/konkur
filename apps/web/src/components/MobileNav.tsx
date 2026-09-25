"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useComingSoon } from "../lib/availability";
import { Glyph, type GlyphName } from "./SubjectIcon";

const TABS: { href: string; label: string; glyph: GlyphName; main?: boolean }[] = [
  { href: "/", label: "خانه", glyph: "building" },
  { href: "/courses", label: "دوره‌ها", glyph: "play" },
  { href: "/results", label: "نتایج", glyph: "trophy", main: true },
  { href: "/practice", label: "تمرین", glyph: "target" },
  { href: "/account", label: "حساب من", glyph: "compass" },
];

/** The phone tab bar; a tab whose section is not live yet carries a dot. */
export function MobileNav() {
  const soon = useComingSoon();
  const pathname = usePathname() ?? "/";
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className="mobile-nav" aria-label="ناوبری موبایل">
      {TABS.map((tab) => {
        const pending = soon.has(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={tab.main ? "mobile-nav-main" : undefined}
            data-soon={pending || undefined}
            aria-current={isActive(tab.href) ? "page" : undefined}
            aria-label={pending ? `${tab.label} (به‌زودی)` : undefined}
          >
            <Glyph name={tab.glyph} />
            <small>{tab.label}</small>
          </Link>
        );
      })}
    </nav>
  );
}
