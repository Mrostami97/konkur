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
              <Link className="nav-link" href="/today">امروز</Link>
              <Link className="nav-link" href="/courses">دوره‌ها</Link>
              <Link className="nav-link" href="/questions">بانک سؤال</Link>
              <Link className="nav-link" href="/exams">آزمون‌ها</Link>
              <Link className="nav-link" href="/admissions">انتخاب‌رشته</Link>
            </nav>
            <span className="auth-link"><AuthStatus /></span>
          </div>
        </header>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
