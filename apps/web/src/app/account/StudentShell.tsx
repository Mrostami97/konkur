"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Glyph, type GlyphName } from "../../components/SubjectIcon";
import { apiFetch, ApiError } from "../../lib/api";
import { EXAM_DATES, daysUntil } from "../../lib/exam-dates";
import { toPersianDigits } from "../../lib/format";
import { Onboarding } from "./Onboarding";
import { degreeLabel, fieldLabel } from "./profile-options";
import {
  initials,
  StudentContext,
  studentName,
  type StudentProfile,
  type StudentSession,
} from "./student-context";
import "./student.css";

interface NavItem {
  href: string;
  label: string;
  icon: GlyphName;
  exact?: boolean;
  /** Shown only to students with a consultation plan. */
  consultation?: boolean;
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "یادگیری",
    items: [
      { href: "/account", label: "داشبورد", icon: "compass", exact: true },
      { href: "/account/plan", label: "برنامهٔ مشاور", icon: "calendar" },
      { href: "/account/weekly", label: "گزارش هفتگی", icon: "list", consultation: true },
      { href: "/account/courses", label: "دوره‌های من", icon: "play" },
      { href: "/account/exams", label: "آزمون‌ها و رتبه‌ها", icon: "target" },
      { href: "/account/library", label: "جزوه‌ها و منابع من", icon: "book" },
      { href: "/account/study", label: "سابقهٔ مطالعه", icon: "pace" },
    ],
  },
  {
    title: "حساب",
    items: [
      { href: "/account/profile", label: "پروفایل و اطلاعات تحصیلی", icon: "shield" },
      { href: "/account/orders", label: "سفارش‌ها و پرداخت", icon: "list" },
      { href: "/account/consultations", label: "مشاوره‌های من", icon: "chat" },
    ],
  },
];

/** Screens that need the student's name and education before they make
 * sense -- the dashboard and learning records. Orders and consultations
 * stay reachable, so a half-finished profile never blocks a payment. */
const GATED = ["/account", "/account/plan", "/account/courses", "/account/exams", "/account/study"];

const STAFF_ROLES = ["ADMIN", "AUTHOR", "REVIEWER", "FINANCE", "MENTOR"];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * The student panel's own frame: a sidebar with the student's identity and
 * every section, a top bar, and the page. It replaces the public header on
 * /account, the way the admin and instructor panels have their own shells.
 *
 * It loads the session and profile once and shares them through context, and
 * it is where onboarding is enforced: until the required profile fields are
 * filled in, the learning screens show the onboarding wizard instead.
 */
export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/account";
  const router = useRouter();
  const [me, setMe] = useState<StudentSession | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isInstructor, setIsInstructor] = useState(false);
  const [consults, setConsults] = useState(false);
  const [failed, setFailed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<StudentSession>("/auth/me"),
      apiFetch<StudentProfile>("/me/profile"),
      // 403 here just means "not an instructor", which is the common case.
      apiFetch<unknown>("/me/instructor").then(() => true).catch(() => false),
      // Any consultation bought, so the weekly report shows in the menu.
      apiFetch<unknown[]>("/me/consultations/access").then((rows) => rows.length > 0).catch(() => false),
    ])
      .then(([session, loaded, instructor, consultation]) => {
        if (cancelled) return;
        // The student panel is for students -- and for the main administrator,
        // who follows the site as a student too. Other staff and instructors
        // have panels of their own.
        const roles = session.user.roles;
        if (!roles.includes("STUDENT") && !roles.includes("ADMIN")) {
          router.replace(instructor ? "/instructor" : "/admin");
          return;
        }
        setMe(session);
        setProfile(loaded);
        setIsInstructor(instructor);
        setConsults(consultation);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => setDrawer(false), [pathname]);

  if (failed) {
    return (
      <div className="st-state">
        <div className="st-state-card">
          <h1>پنل الان بارگذاری نشد</h1>
          <p>ارتباط با سرور برقرار نشد. چند لحظهٔ دیگر دوباره امتحان کن.</p>
          <button type="button" className="st-btn st-btn-primary" onClick={() => window.location.reload()}>
            تلاش دوباره
          </button>
        </div>
      </div>
    );
  }

  if (!me || !profile) {
    return (
      <div className="st-app st-app-loading" aria-busy="true">
        <aside className="st-side">
          <div className="st-skel st-skel-brand" />
          <div className="st-skel st-skel-card" />
          {Array.from({ length: 6 }, (_, index) => <div className="st-skel st-skel-line" key={index} />)}
        </aside>
        <div className="st-main">
          <div className="st-content">
            <div className="st-skel st-skel-hero" />
            <div className="st-skel-row">
              {Array.from({ length: 4 }, (_, index) => <div className="st-skel st-skel-kpi" key={index} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isStaff = me.user.roles.some((role) => STAFF_ROLES.includes(role));
  const value = { me, profile, setProfile, isInstructor, isStaff };
  const gated = GATED.includes(pathname) && !profile.completion.complete;

  if (gated) {
    return (
      <StudentContext.Provider value={value}>
        <Onboarding />
      </StudentContext.Provider>
    );
  }

  const current = NAV.flatMap((group) => group.items).find((item) => isActive(pathname, item));
  const examDate = profile.targetDegree === "PHD" ? EXAM_DATES.phd1406 : EXAM_DATES.master1406;
  const days = daysUntil(examDate.iso);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
  }

  return (
    <StudentContext.Provider value={value}>
      <div className="st-app">
        <button
          type="button"
          className="st-scrim"
          data-open={drawer || undefined}
          aria-label="بستن منو"
          onClick={() => setDrawer(false)}
        />
        <aside className="st-side" data-open={drawer || undefined} aria-label="منوی پنل دانشجو">
          <Link href="/" className="st-brand">
            <Image src="/brand/logo-128.webp" alt="" width={38} height={38} unoptimized />
            <span>
              <strong>کنکور کامپیوتر</strong>
              <small>پنل دانشجو</small>
            </span>
          </Link>

          <Link href="/account/profile" className="st-user">
            <span className="st-avatar">{initials(profile)}</span>
            <span className="st-user-text">
              <strong>{studentName(profile)}</strong>
              <small>
                {profile.targetDegree ? `${degreeLabel(profile.targetDegree)} · ${fieldLabel(profile.targetField)}` : "هدف ثبت نشده"}
              </small>
            </span>
          </Link>

          <nav className="st-nav">
            {NAV.map((group) => (
              <div className="st-nav-group" key={group.title}>
                <p className="st-nav-title">{group.title}</p>
                {group.items.filter((item) => !item.consultation || consults || pathname === item.href).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="st-nav-item"
                    aria-current={isActive(pathname, item) ? "page" : undefined}
                  >
                    <Glyph name={item.icon} />
                    <span>{item.label}</span>
                    {item.href === "/account/profile" && !profile.completion.complete && (
                      <em className="st-nav-dot" aria-label="ناقص" />
                    )}
                  </Link>
                ))}
              </div>
            ))}
            {(isInstructor || isStaff) && (
              <div className="st-nav-group">
                <p className="st-nav-title">پنل‌های دیگر</p>
                {isInstructor && (
                  <Link href="/instructor" className="st-nav-item">
                    <Glyph name="building" />
                    <span>پنل مدرس</span>
                  </Link>
                )}
                {isStaff && (
                  <Link href="/admin" className="st-nav-item">
                    <Glyph name="layers" />
                    <span>پنل مدیریت</span>
                  </Link>
                )}
              </div>
            )}
          </nav>

          <Link href="/guides/registration-calendar-1406" className="st-count">
            <span className="st-count-num" suppressHydrationWarning>{toPersianDigits(days)}</span>
            <span>
              <strong>روز تا {examDate.label}</strong>
              <small>{examDate.dateLabel}</small>
            </span>
          </Link>

          <div className="st-side-foot">
            <Link href="/">بازگشت به سایت</Link>
            <button type="button" onClick={() => void logout()}>
              خروج
            </button>
          </div>
        </aside>

        <div className="st-main">
          <header className="st-top">
            <button
              type="button"
              className="st-burger"
              aria-label="باز کردن منو"
              aria-expanded={drawer}
              onClick={() => setDrawer(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div className="st-crumbs">
              <span>پنل دانشجو</span>
              <span aria-hidden>/</span>
              <strong>{current?.label ?? "حساب من"}</strong>
            </div>
            <div className="st-top-actions">
              <Link href="/search" className="st-icon-btn" aria-label="جست‌وجو">
                <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              </Link>
              <Link href="/today" className="st-btn st-btn-soft st-top-today">
                <Glyph name="calendar" />
                برنامهٔ امروز
              </Link>
              <Link href="/account/profile" className="st-avatar st-avatar-sm" aria-label="پروفایل">
                {initials(profile)}
              </Link>
            </div>
          </header>

          {!profile.completion.complete && pathname !== "/account/profile" && (
            <div className="st-banner">
              <Glyph name="shield" />
              <span>
                پروفایلت {toPersianDigits(profile.completion.percent)}٪ کامل است. برای شرکت در آزمون‌ها، نام و
                اطلاعات تحصیلی‌ات را کامل کن.
              </span>
              <Link href="/account/profile" className="st-btn st-btn-primary st-btn-sm">
                تکمیل پروفایل
              </Link>
            </div>
          )}

          <div className="st-content">{children}</div>
        </div>
      </div>
    </StudentContext.Provider>
  );
}
