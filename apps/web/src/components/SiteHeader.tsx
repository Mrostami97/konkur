"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

/** One bar covering every area of the product. The biggest competitor splits
 * exams, planning, review, rank estimation and admissions across five
 * separate subdomains, so a single nav is itself the differentiator -- it
 * only works if everything really is listed here. */
const NAV = [
  { href: "/", label: "خانه", exact: true },
  { href: "/guides", label: "راهنمای ۱۴۰۶" },
  { href: "/subjects", label: "درس‌ها" },
  { href: "/questions", label: "بانک سؤال" },
  { href: "/exams", label: "آزمون‌ها" },
  { href: "/courses", label: "دوره‌ها" },
  { href: "/consultations", label: "مشاوره" },
  { href: "/articles", label: "مقاله‌ها" },
  { href: "/admissions", label: "انتخاب‌رشته" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [phone, setPhone] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ user: { phone: string } }>("/auth/me")
      .then((res) => setPhone(res.user.phone))
      .catch(() => setPhone(null))
      .finally(() => setChecked(true));
  }, []);

  // Route changes keep the drawer from staying open behind the new page.
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <header className="hd">
      <div className="hd-inner">
        <Link href="/" className="hd-brand" aria-label="کنکورصفریک">
          <Image src="/brand/konkurcom-logo.png" alt="" width={40} height={40} priority />
          <span>
            <strong>کنکورصفریک</strong>
            <small>مرجع کنکور کامپیوتر</small>
          </span>
        </Link>

        <nav className={`hd-nav ${open ? "hd-nav-open" : ""}`} aria-label="منوی اصلی">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hd-link"
              aria-current={isActive(item) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hd-side">
          <Link className="hd-icon-btn" href="/search" aria-label="جست‌وجو">
            <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          </Link>

          {checked && (
            phone ? (
              <Link className="hd-cta" href="/account">
                <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.9-6 7.5-6s6.7 2 7.5 6" /></svg>
                <span className="hd-cta-phone">{phone}</span>
              </Link>
            ) : (
              <Link className="hd-cta" href="/login">
                <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.9-6 7.5-6s6.7 2 7.5 6" /></svg>
                ورود / ثبت‌نام
              </Link>
            )
          )}

          <button
            type="button"
            className="hd-burger"
            aria-expanded={open}
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            onClick={() => setOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
