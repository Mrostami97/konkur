import type { Metadata } from "next";

export const SITE_NAME = "kunkur01";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kunkur01.ir").replace(/\/$/, "");
export const SITE_DESCRIPTION = "مرجع فارسی کنکور ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر؛ راهنما، منابع، برنامه‌ریزی، کارنامه و تحلیل.";

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      locale: "fa_IR",
      siteName: SITE_NAME,
      title,
      description,
      url,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
