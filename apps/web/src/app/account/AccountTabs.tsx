"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account", label: "نمای کلی", exact: true },
  { href: "/account/consultations", label: "مشاوره‌های من" },
];

/** Sub-navigation for the account area. Tabs rather than a sidebar: a student
 * moves between their dashboard and the public catalogue constantly, and a
 * second full navigation would compete with the site header. */
export function AccountTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="acc-tabs" aria-label="بخش‌های حساب">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className="acc-tab" aria-current={active ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
