"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useComingSoon } from "../lib/availability";
import { EXAM_DATES, daysUntil } from "../lib/exam-dates";
import { toPersianDigits } from "../lib/format";
import { MEGA_MENUS, SUBJECT_FAMILIES, TELEGRAM_URL, type NavMenu } from "../lib/site-nav";
import { Glyph, SUBJECT_TONE, SubjectGlyph } from "./SubjectIcon";

export interface NavSubject {
  slug: string;
  title: string;
}

const [LEARN, GUIDES, TOOLS] = MEGA_MENUS;

/**
 * One bar covering every area of the product, organised as mega menus: each
 * top-level item opens a panel listing everything under it, so the results,
 * free videos and tools are one hover away instead of hidden behind typed
 * addresses. Below 1100px the same data becomes an accordion drawer.
 *
 * Subjects come from the layout (the editorial corpus is server data) so the
 * client bundle does not carry the whole corpus just to print seventeen names.
 */
export function SiteHeader({ subjects }: { subjects: NavSubject[] }) {
  const pathname = usePathname() ?? "/";
  const [phone, setPhone] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHover = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  const soon = useComingSoon();

  useEffect(() => {
    apiFetch<{ user: { phone: string } }>("/auth/me")
      .then((res) => setPhone(res.user.phone))
      .catch(() => setPhone(null))
      .finally(() => setChecked(true));
  }, []);

  // A route change closes whatever was open, so a panel never sits over the
  // page the person just navigated to.
  useEffect(() => {
    setDrawer(false);
    setMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!menu && !drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setDrawer(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menu, drawer]);

  // Hover opens panels only where there is a real hover and the bar is not a
  // drawer; on touch, a tap fires mouseenter before click, which would open
  // the panel and then immediately toggle it shut.
  const canHover = () =>
    typeof window !== "undefined" && window.matchMedia("(hover: hover) and (min-width: 1101px)").matches;
  const hoverOpen = (id: string) => {
    if (!canHover()) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openedByHover.current = true;
    setMenu(id);
  };
  // A short grace period, so crossing the gap between the bar and the panel
  // does not snap the panel shut.
  const hoverClose = () => {
    if (!canHover()) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), 160);
  };
  // Reaching the trigger with a mouse opens its panel on hover, so the click
  // that follows must keep it open rather than toggle it shut; only a second
  // click closes it.
  const toggle = (id: string) => {
    if (menu === id && openedByHover.current) {
      openedByHover.current = false;
      return;
    }
    openedByHover.current = false;
    setMenu(menu === id ? null : id);
  };

  const within = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const menuActive = (item: NavMenu) =>
    within(item.href) || item.columns.some((column) => column.links.some((link) => within(link.href)));

  const master = daysUntil(EXAM_DATES.master1406.iso);
  const phd = daysUntil(EXAM_DATES.phd1406.iso);

  const subjectsBy = (tone: string) => subjects.filter((subject) => (SUBJECT_TONE[subject.slug] ?? "teal") === tone);

  const megaTrigger = (item: NavMenu) => (
    <button
      type="button"
      className="hd-link hd-trigger"
      aria-expanded={menu === item.id}
      aria-controls={`hd-panel-${item.id}`}
      data-active={menuActive(item) || undefined}
      onClick={() => toggle(item.id)}
    >
      {item.label}
      <svg className="hd-caret" viewBox="0 0 24 24" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );

  const megaPanel = (item: NavMenu, promo?: JSX.Element) => (
    <div className="hd-panel" id={`hd-panel-${item.id}`} role="region" aria-label={item.label} data-open={menu === item.id || undefined}>
      <div className="hd-panel-grid" style={{ ["--cols" as string]: item.columns.length }}>
        {item.columns.map((column) => (
          <div className="hd-col" key={column.title}>
            <p className="hd-col-title">{column.title}</p>
            <ul>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hd-item" aria-current={pathname === link.href ? "page" : undefined}>
                    {link.glyph && (
                      <span className="hd-item-icon"><Glyph name={link.glyph} /></span>
                    )}
                    <span>
                      <strong>{link.label}{soon.has(link.href) && <span className="soon-pill">به‌زودی</span>}</strong>
                      {link.hint && <small>{link.hint}</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {promo}
      </div>
      <Link href={item.href} className="hd-panel-all">{item.allLabel} ←</Link>
    </div>
  );

  const resultsPromo = (
    <Link href="/results" className="hd-promo">
      <span className="hd-promo-icon"><Glyph name="trophy" /></span>
      <strong>نتایج شاگردان کلاس‌ها</strong>
      <small>رتبه‌ها و قبولی‌های واقعی، با رضایت خود شاگرد</small>
      <span className="hd-promo-go">دیدن نتایج ←</span>
    </Link>
  );

  const countdownPromo = (
    <Link href="/guides/registration-calendar-1406" className="hd-promo hd-promo-violet">
      <span className="hd-promo-icon"><Glyph name="calendar" /></span>
      <strong suppressHydrationWarning>{toPersianDigits(master)} روز تا کنکور ارشد</strong>
      <small>{EXAM_DATES.master1406.dateLabel}</small>
      <span className="hd-promo-go">تقویم رسمی ۱۴۰۶ ←</span>
    </Link>
  );

  return (
    <header className="hd" onMouseLeave={hoverClose}>
      <div className="hd-strip">
        <div className="hd-strip-inner">
          <p suppressHydrationWarning>
            <span className="hd-strip-dot" aria-hidden />
            <b>{toPersianDigits(master)}</b> روز تا کنکور ارشد ۱۴۰۶
            <span className="hd-strip-sep" aria-hidden>·</span>
            <b>{toPersianDigits(phd)}</b> روز تا دکتری
          </p>
          <nav className="hd-strip-links" aria-label="پیوندهای سریع">
            <Link href="/results">نتایج شاگردان{soon.has("/results") && <span className="soon-pill">به‌زودی</span>}</Link>
            <Link href="/free-videos">ویدیوی رایگان{soon.has("/free-videos") && <span className="soon-pill">به‌زودی</span>}</Link>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">کانال تلگرام @konkurcom</a>
          </nav>
        </div>
      </div>

      <div className="hd-inner">
        <Link href="/" className="hd-brand" aria-label="کنکور کامپیوتر، صفحهٔ اصلی">
          <Image src="/brand/konkurcom-logo.png" alt="" width={42} height={42} priority />
          <span>
            <strong>کنکور کامپیوتر</strong>
            <small>کلاس، نتیجه و مسیر کنکور کامپیوتر</small>
          </span>
        </Link>

        <nav ref={navRef} className={`hd-nav ${drawer ? "hd-nav-open" : ""}`} aria-label="منوی اصلی">
          <div className="hd-menu" onMouseEnter={() => hoverOpen(LEARN.id)}>
            {megaTrigger(LEARN)}
            {megaPanel(LEARN, resultsPromo)}
          </div>

          <div className="hd-menu" onMouseEnter={() => hoverOpen("subjects")}>
            <button
              type="button"
              className="hd-link hd-trigger"
              aria-expanded={menu === "subjects"}
              aria-controls="hd-panel-subjects"
              data-active={within("/subjects") || undefined}
              onClick={() => toggle("subjects")}
            >
              درس‌ها
              <svg className="hd-caret" viewBox="0 0 24 24" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="hd-panel hd-panel-wide" id="hd-panel-subjects" role="region" aria-label="درس‌ها" data-open={menu === "subjects" || undefined}>
              <div className="hd-subjects">
                {SUBJECT_FAMILIES.map((family) => {
                  const list = subjectsBy(family.tone);
                  if (list.length === 0) return null;
                  return (
                    <div className="hd-col" key={family.tone}>
                      <p className="hd-col-title">{family.title}</p>
                      <ul>
                        {list.map((subject) => (
                          <li key={subject.slug}>
                            <Link
                              href={`/subjects/${subject.slug}`}
                              className={`hd-subject hd-tone-${family.tone}`}
                              aria-current={pathname === `/subjects/${subject.slug}` ? "page" : undefined}
                            >
                              <span className="hd-subject-icon"><SubjectGlyph slug={subject.slug} /></span>
                              {subject.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <Link href="/subjects" className="hd-panel-all">نقشهٔ همهٔ درس‌ها، ضرایب و پیش‌نیازها ←</Link>
            </div>
          </div>

          <Link
            href="/results"
            className="hd-link hd-link-star"
            aria-current={within("/results") ? "page" : undefined}
            onMouseEnter={hoverClose}
          >
            <Glyph name="trophy" className="hd-star-icon" />
            نتایج شاگردان
            {soon.has("/results") && <span className="soon-pill">به‌زودی</span>}
          </Link>

          <div className="hd-menu" onMouseEnter={() => hoverOpen(GUIDES.id)}>
            {megaTrigger(GUIDES)}
            {megaPanel(GUIDES, countdownPromo)}
          </div>

          <div className="hd-menu" onMouseEnter={() => hoverOpen(TOOLS.id)}>
            {megaTrigger(TOOLS)}
            {megaPanel(TOOLS)}
          </div>

          <Link
            href="/articles"
            className="hd-link"
            aria-current={within("/articles") ? "page" : undefined}
            onMouseEnter={hoverClose}
          >
            مقاله‌ها
          </Link>

          <a className="hd-drawer-telegram" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            کانال تلگرام @konkurcom
          </a>
        </nav>

        <div className="hd-side">
          <Link className="hd-icon-btn" href="/search" aria-label="جست‌وجو">
            <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          </Link>

          {checked ? (
            phone ? (
              <Link className="hd-cta" href="/account" aria-label="حساب من">
                <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.9-6 7.5-6s6.7 2 7.5 6" /></svg>
                <span className="hd-cta-label">حساب من</span>
              </Link>
            ) : (
              <Link className="hd-cta" href="/login" aria-label="ورود یا ثبت‌نام">
                <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.8-4 3.9-6 7.5-6s6.7 2 7.5 6" /></svg>
                <span className="hd-cta-label">ورود / ثبت‌نام</span>
              </Link>
            )
          ) : (
            <span className="hd-cta hd-cta-ghost" aria-hidden />
          )}

          <button
            type="button"
            className="hd-burger"
            aria-expanded={drawer}
            aria-label={drawer ? "بستن منو" : "باز کردن منو"}
            onClick={() => setDrawer((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {drawer ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
