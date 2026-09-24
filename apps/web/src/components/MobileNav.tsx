"use client";

import Link from "next/link";
import { useComingSoon } from "../lib/availability";
import { Glyph, type GlyphName } from "./SubjectIcon";

const TABS: { href: string; label: string; glyph: GlyphName; main?: boolean }[] = [
  { href: "/", label: "خانه", glyph: "building" },
  { href: "/courses", label: "دوره‌ها", glyph: "play" },
  { href: "/results", label: "نتایج", glyph: "trophy", main: true },
  { href: "/free-videos", label: "رایگان", glyph: "spark" },
  { href: "/account", label: "حساب من", glyph: "compass" },
];

/** The phone tab bar; a tab whose section is not live yet carries a dot. */
export function MobileNav() {
  const soon = useComingSoon();
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
