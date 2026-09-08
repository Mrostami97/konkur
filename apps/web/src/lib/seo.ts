import type { Metadata } from "next";

export const SITE_NAME = "کنکورصفریک";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kunkur01.ir").replace(/\/$/, "");
export const SITE_DESCRIPTION = "مرجع فارسی کنکور ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر؛ راهنما، منابع، برنامه‌ریزی، کارنامه و تحلیل.";
export const PRIVATE_PAGE_METADATA: Metadata = { robots: { index: false, follow: false } };

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const image = absoluteUrl("/brand/konkurcom-logo.png");
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type,
      locale: "fa_IR",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: image, width: 600, height: 600, alt: SITE_NAME }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
