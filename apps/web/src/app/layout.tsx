import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import { AuthStatus } from "../components/AuthStatus";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "KonkurCom 360",
  description: "سایت مادر پلتفرم KonkurCom 360",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#243B53",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <header className="site-header">
          <div className="nav-wrap">
            <Link href="/" className="brand" aria-label="KonkurCom 360">
              <span className="brand-mark">ک</span>
              <span className="brand-copy">
                <strong>KonkurCom 360</strong>
                <span>مسیر هوشمند موفقیت</span>
              </span>
            </Link>
            <nav className="main-nav" aria-label="منوی اصلی">
              <Link className="nav-link" href="/today"><span>◷</span> امروز</Link>
              <Link className="nav-link" href="/courses"><span>◈</span> یادگیری</Link>
              <Link className="nav-link" href="/exams"><span>✓</span> آزمون</Link>
              <Link className="nav-link" href="/rank-estimate"><span>↗</span> تحلیل</Link>
              <Link className="nav-link" href="/account"><span>◎</span> حساب من</Link>
            </nav>
            <span className="auth-link"><AuthStatus /></span>
          </div>
        </header>
        {children}
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
