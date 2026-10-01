import type { Metadata } from "next";
import Link from "next/link";
import { formatPublicDate, type PublicArticleRecord } from "../../components/PublicContent";
import { guides as legacyGuides } from "../../content/editorial";
import { phase12EditorialPages } from "../../content/phase12";
import { apiGetPublic } from "../../lib/api";
import { isMergedGuide, withoutMergedGuides } from "../../lib/merged-pages";
import { pageMetadata } from "../../lib/seo";

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  return pageMetadata({
    title: "راهنمای برنامه‌ریزی و کنکور ۱۴۰۶ کامپیوتر",
    description: "راهنماهای عملی برنامه‌ریزی، مرور، جمع‌بندی و اطلاعات رسمی ارشد و دکتری کامپیوتر، IT و علوم کامپیوتر.",
    path: "/guides",
    noIndex: Object.keys(searchParams).length > 0,
  });
}

export default async function GuidesPage() {
  let apiUnavailable = false;
  let published: PublicArticleRecord[] = [];
  try {
    published = (await apiGetPublic<PublicArticleRecord[]>("/articles")) ?? [];
  } catch {
    apiUnavailable = true;
  }
  const apiGuides = published.filter((item) => item.contentType === "GUIDE" && !isMergedGuide(item.slug));
  const publishedSlugs = new Set(published.map((guide) => guide.slug));
  const staticOnly = withoutMergedGuides([...legacyGuides, ...phase12EditorialPages]).filter((guide) => !publishedSlugs.has(guide.slug));

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">راهنمای منبع‌دار</p>
          <h1>از انتخاب مسیر تا برنامهٔ هفته و روز آزمون</h1>
          <p className="pg-lede">راهنماهای اجرایی مطالعه و صفحات رسمی ۱۴۰۶، با پاسخ کوتاه، تاریخ ثبت یا بررسی، منبع و قدم بعدی روشن.</p>
        </div>
      </div>

      {apiUnavailable && (
        <div className="pg-shell pg-band">
          <div className="ds-alert ds-alert-warning">
            <span>
              <strong>نسخهٔ آفلاین.</strong> اتصال به سرویس محتوا برقرار نیست؛ راهنماهای پایه نمایش
              داده می‌شوند و دفترچه و اصلاحیهٔ رسمی همچنان ملاک نهایی‌اند.
            </span>
          </div>
        </div>
      )}

      <section className="pg-shell pg-sec">
        <div className="pg-grid pg-grid-wide">
          {apiGuides.map((guide) => (
            <Link href={`/guides/${guide.slug}`} className="pg-card" key={guide.slug}>
              <span className="pg-badge">{guide.validForYear ? toDegreeMark(guide.taxonomyDegrees) : "راهنما"}</span>
              <span className="pg-card-meta">{guide.taxonomyFields.join(" · ") || "راهنمای تحریریه"}</span>
              <b>{guide.title}</b>
              <small>{guide.summary}</small>
              <span className="pg-card-action pg-card-meta">
                {guide.reviewedAt ? `بررسی ${formatPublicDate(guide.reviewedAt)}` : "تاریخ بررسی منتشرنشده"}
              </span>
            </Link>
          ))}
          {staticOnly.map((guide) => (
            <Link href={`/guides/${guide.slug}`} className="pg-card" key={guide.slug}>
              <span className="pg-badge">{staticDegreeMark(guide.degree)}</span>
              <span className="pg-card-meta">{guide.category} · {guide.field}</span>
              <b>{guide.title}</b>
              <small>{guide.description}</small>
              <span className="pg-card-action pg-card-meta">{guide.reviewer === "در انتظار بازبینی انسانی" ? "تاریخ ثبت" : "بررسی"} {guide.reviewedAt}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

/* The badge is read by Persian-speaking candidates, so it names the degree in
   Persian rather than as an "MSc"/"PhD" abbreviation. */
function staticDegreeMark(degree: string) {
  if (degree === "ارشد") return "ارشد";
  if (degree === "دکتری") return "دکتری";
  return "ارشد و دکتری";
}

function toDegreeMark(degrees: string[]) {
  if (degrees.length === 1 && degrees[0] === "PHD") return "دکتری";
  if (degrees.length === 1 && degrees[0] === "MASTER") return "ارشد";
  return "راهنما";
}
