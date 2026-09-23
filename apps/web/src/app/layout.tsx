import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import { PublicChrome } from "../components/PublicChrome";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { Glyph } from "../components/SubjectIcon";
import { ServiceWorkerRegistration } from "../components/ServiceWorkerRegistration";
import { StructuredData } from "../components/StructuredData";
import { subjects } from "../content/editorial";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/seo";
import "./globals.css";
import "./design-system.css";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const bingSiteVerification = process.env.BING_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "کنکورصفریک | مرجع کنکور ارشد و دکتری کامپیوتر", template: "%s | کنکورصفریک" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["کنکور ارشد کامپیوتر", "کنکور دکتری کامپیوتر", "کنکور IT", "علوم کامپیوتر", "منابع کنکور کامپیوتر"],
  authors: [{ name: "kunkur01" }],
  creator: "kunkur01",
  publisher: "kunkur01",
  openGraph: { type: "website", locale: "fa_IR", siteName: SITE_NAME, title: "کنکورصفریک", description: SITE_DESCRIPTION, url: "/", images: [{ url: "/brand/konkurcom-logo.png", width: 600, height: 600, alt: SITE_NAME }] },
  twitter: { card: "summary_large_image", title: "کنکورصفریک", description: SITE_DESCRIPTION, images: ["/brand/konkurcom-logo.png"] },
  manifest: "/manifest.json",
  ...(googleSiteVerification || bingSiteVerification
    ? {
        verification: {
          ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
          ...(bingSiteVerification ? { other: { "msvalidate.01": bingSiteVerification } } : {}),
        },
      }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#243B53",
};

// The header lists every subject; the footer only the ones most candidates
// look for, so its column stays the height of its neighbours.
const NAV_SUBJECTS = subjects.map(({ slug, title }) => ({ slug, title }));
const FOOTER_SUBJECT_SLUGS = [
  "data-structures-algorithms",
  "algorithms",
  "digital-logic",
  "computer-architecture",
  "operating-systems",
  "discrete-math",
  "artificial-intelligence",
  "databases",
];
const FOOTER_SUBJECTS = FOOTER_SUBJECT_SLUGS.flatMap((slug) => NAV_SUBJECTS.filter((subject) => subject.slug === slug));

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <StructuredData data={[
          { "@context": "https://schema.org", "@type": "Organization", "@id": absoluteUrl("/#organization"), name: "کنکورصفریک", alternateName: "kunkur01", url: absoluteUrl("/"), logo: absoluteUrl("/brand/konkurcom-logo.png"), sameAs: ["https://t.me/konkurcom"] },
          { "@context": "https://schema.org", "@type": "WebSite", "@id": absoluteUrl("/#website"), name: "کنکورصفریک", alternateName: "kunkur01", url: absoluteUrl("/"), inLanguage: "fa-IR", publisher: { "@id": absoluteUrl("/#organization") } },
        ]} />
        <PublicChrome>
          <SiteHeader subjects={NAV_SUBJECTS} />
        </PublicChrome>
        {children}
        <PublicChrome>
        <SiteFooter subjects={FOOTER_SUBJECTS} />
        <nav className="mobile-nav" aria-label="ناوبری موبایل">
          <Link href="/"><Glyph name="building" /><small>خانه</small></Link>
          <Link href="/courses"><Glyph name="play" /><small>دوره‌ها</small></Link>
          <Link className="mobile-nav-main" href="/results"><Glyph name="trophy" /><small>نتایج</small></Link>
          <Link href="/free-videos"><Glyph name="spark" /><small>رایگان</small></Link>
          <Link href="/account"><Glyph name="compass" /><small>حساب من</small></Link>
        </nav>
        </PublicChrome>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
