import type { Metadata } from "next";

export const SITE_NAME = "کنکور کامپیوتر";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kunkurcomputer.ir").replace(/\/$/, "");
export const SITE_DESCRIPTION = "مرجع فارسی کنکور ارشد و دکتری مهندسی کامپیوتر، فناوری اطلاعات و علوم کامپیوتر؛ راهنما، منابع، برنامه‌ریزی، کارنامه و تحلیل.";
export const PRIVATE_PAGE_METADATA: Metadata = { robots: { index: false, follow: false } };

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// The owner is described once, on /about. Articles he writes point at the same
// @id so search and answer engines see one person, not two.
export const OWNER_PROFILE_SLUG = "mohammad-rostami";
export const OWNER_PERSON_ID = absoluteUrl("/about#mohammad-rostami");

export function personReference(profile: { slug: string; displayName: string }) {
  return {
    "@type": "Person",
    ...(profile.slug === OWNER_PROFILE_SLUG ? { "@id": OWNER_PERSON_ID } : {}),
    name: profile.displayName,
    url: absoluteUrl(`/authors/${profile.slug}`),
  };
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
