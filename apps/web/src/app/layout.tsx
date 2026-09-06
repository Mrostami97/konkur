import type { Metadata, Viewport } from "next";
import Image from "next/image";
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
  title: { default: "کنکورصفریک | مرجع کنکور ارشد و دکتری کامپیوتر", template: "%s | کنکورصفریک" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["کنکور ارشد کامپیوتر", "کنکور دکتری کامپیوتر", "کنکور IT", "علوم کامپیوتر", "منابع کنکور کامپیوتر"],
  authors: [{ name: "تحریریه kunkur01" }, { name: "محمد رستمی" }],
  creator: "kunkur01",
  publisher: "kunkur01",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "fa_IR", siteName: SITE_NAME, title: "کنکورصفریک", description: SITE_DESCRIPTION, url: "/" },
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
          { "@context": "https://schema.org", "@type": "Organization", "@id": absoluteUrl("/#organization"), name: "کنکورصفریک", alternateName: "kunkur01", url: absoluteUrl("/"), logo: absoluteUrl("/brand/konkurcom-logo.png"), sameAs: ["https://t.me/konkurcom"] },
          { "@context": "https://schema.org", "@type": "WebSite", "@id": absoluteUrl("/#website"), name: "کنکورصفریک", alternateName: "kunkur01", url: absoluteUrl("/"), inLanguage: "fa-IR", publisher: { "@id": absoluteUrl("/#organization") } },
        ]} />
        <header className="site-header">
          <div className="nav-wrap">
            <Link href="/" className="brand" aria-label="کنکورصفریک">
              <span className="brand-logo-wrap"><Image className="brand-logo" src="/brand/konkurcom-logo.png" alt="" width={64} height={64} priority /></span>
              <span className="brand-copy">
                <strong>کنکورصفریک</strong>
                <span>kunkur01 · مرجع کنکور کامپیوتر</span>
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
            <div className="footer-brand"><span className="brand-logo-wrap footer-logo-wrap"><Image className="brand-logo" src="/brand/konkurcom-logo.png" alt="" width={72} height={72} /></span><div><strong>کنکورصفریک <small>kunkur01</small></strong><p>مسیر روشن‌تر برای ارشد و دکتری کامپیوتر، IT و علوم کامپیوتر.</p></div></div>
            <div><strong>مسیرهای مطالعه</strong><Link href="/guides">راهنمای آزمون ۱۴۰۶</Link><Link href="/subjects">صفحهٔ درس‌ها</Link><Link href="/articles">مقاله‌ها</Link></div>
            <div><strong>اعتماد و شفافیت</strong><Link href="/about">دربارهٔ محمد رستمی</Link><Link href="/editorial-policy">روش تولید محتوا</Link><Link href="/corrections">سیاست اصلاح</Link></div>
            <div><strong>کانال رسمی</strong><a href="https://t.me/konkurcom" target="_blank" rel="noreferrer">@konkurcom — خبر، آموزش و منابع</a></div>
          </div>
          <div className="footer-bottom"><span>© ۱۴۰۵ کنکورصفریک · kunkur01</span><span>اطلاعات زمان‌حساس با تاریخ بازبینی و منبع منتشر می‌شوند.</span></div>
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
