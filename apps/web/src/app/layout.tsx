import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import { AuthStatus } from "../components/AuthStatus";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { StructuredData } from "../components/StructuredData";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "kunkur01 | مرجع کنکور ارشد و دکتری کامپیوتر", template: "%s | kunkur01" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["کنکور ارشد کامپیوتر", "کنکور دکتری کامپیوتر", "کنکور IT", "علوم کامپیوتر", "منابع کنکور کامپیوتر"],
  authors: [{ name: "تحریریه kunkur01" }, { name: "محمد رستمی" }],
  creator: "kunkur01",
  publisher: "kunkur01",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "fa_IR", siteName: SITE_NAME, title: "kunkur01", description: SITE_DESCRIPTION, url: "/" },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#243B53",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <StructuredData data={[
          { "@context": "https://schema.org", "@type": "Organization", "@id": absoluteUrl("/#organization"), name: "kunkur01", url: absoluteUrl("/"), sameAs: ["https://t.me/konkurcom", "https://t.me/Konkur_answer"] },
          { "@context": "https://schema.org", "@type": "WebSite", "@id": absoluteUrl("/#website"), name: "kunkur01", url: absoluteUrl("/"), inLanguage: "fa-IR", publisher: { "@id": absoluteUrl("/#organization") } },
        ]} />
        <header className="site-header">
          <div className="nav-wrap">
            <Link href="/" className="brand" aria-label="kunkur01">
              <span className="brand-mark">01</span>
              <span className="brand-copy">
                <strong>kunkur01</strong>
                <span>مرجع کنکور کامپیوتر</span>
              </span>
            </Link>
            <nav className="main-nav" aria-label="منوی اصلی">
              <Link className="nav-link" href="/guides"><span>▤</span> راهنمای ۱۴۰۶</Link>
              <Link className="nav-link" href="/subjects"><span>◈</span> درس‌ها</Link>
              <Link className="nav-link" href="/articles"><span>✦</span> مقاله‌ها</Link>
              <Link className="nav-link" href="/resources"><span>↓</span> منابع رایگان</Link>
              <Link className="nav-link" href="/admissions"><span>◎</span> انتخاب‌رشته</Link>
            </nav>
            <span className="auth-link"><AuthStatus /></span>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-grid">
            <div className="footer-brand"><span className="brand-mark">01</span><div><strong>kunkur01</strong><p>مسیر روشن‌تر برای ارشد و دکتری کامپیوتر، IT و علوم کامپیوتر.</p></div></div>
            <div><strong>مسیرهای مطالعه</strong><Link href="/guides">راهنمای آزمون ۱۴۰۶</Link><Link href="/subjects">صفحهٔ درس‌ها</Link><Link href="/articles">مقاله‌ها</Link></div>
            <div><strong>اعتماد و شفافیت</strong><Link href="/about">دربارهٔ محمد رستمی</Link><Link href="/editorial-policy">روش تولید محتوا</Link><Link href="/corrections">سیاست اصلاح</Link></div>
            <div><strong>کانال‌های رسمی</strong><a href="https://t.me/konkurcom" target="_blank" rel="noreferrer">@konkurcom — کانال اصلی</a><a href="https://t.me/Konkur_answer" target="_blank" rel="noreferrer">@Konkur_answer — پاسخ و منابع</a></div>
          </div>
          <div className="footer-bottom"><span>© ۱۴۰۵ kunkur01</span><span>اطلاعات زمان‌حساس با تاریخ بازبینی و منبع منتشر می‌شوند.</span></div>
        </footer>
        <nav className="mobile-nav" aria-label="ناوبری موبایل">
          <Link href="/today"><span>◷</span><small>امروز</small></Link>
          <Link href="/courses"><span>◈</span><small>یادگیری</small></Link>
          <Link className="mobile-nav-main" href="/exams"><span>✓</span><small>آزمون</small></Link>
          <Link href="/rank-estimate"><span>↗</span><small>تحلیل</small></Link>
          <Link href="/account"><span>◎</span><small>حساب من</small></Link>
        </nav>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
