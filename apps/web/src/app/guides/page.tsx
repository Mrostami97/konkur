import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { formatPublicDate, type PublicArticleRecord } from "../../components/PublicContent";
import { guides as legacyGuides } from "../../content/editorial";
import { phase12EditorialPages } from "../../content/phase12";
import { apiGetPublic } from "../../lib/api";
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
  const apiGuides = published.filter((item) => item.contentType === "GUIDE");
  const publishedSlugs = new Set(published.map((guide) => guide.slug));
  const staticOnly = [...legacyGuides, ...phase12EditorialPages].filter((guide) => !publishedSlugs.has(guide.slug));

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="راهنمای منبع‌دار"
        title="از انتخاب مسیر تا برنامهٔ هفته و روز آزمون"
        description="راهنماهای اجرایی مطالعه و صفحات رسمی ۱۴۰۶، با پاسخ کوتاه، تاریخ بررسی، منبع و قدم بعدی روشن."
      />
      {apiUnavailable && (
        <aside className="official-disclaimer">
          <strong>نسخهٔ آفلاین</strong>
          <p>اتصال به سرویس محتوا برقرار نیست؛ راهنماهای پایه نمایش داده می‌شوند و دفترچه و اصلاحیهٔ رسمی همچنان ملاک نهایی‌اند.</p>
        </aside>
      )}
      <div className="guide-grid">
        {apiGuides.map((guide) => (
          <Link href={`/guides/${guide.slug}`} className="guide-card" key={guide.slug}>
            <div className="guide-card-index">{guide.validForYear ? toDegreeMark(guide.taxonomyDegrees) : "Guide"}</div>
            <div>
              <span>{guide.taxonomyFields.join(" · ") || "راهنمای تحریریه"}</span>
              <h2>{guide.title}</h2>
              <p>{guide.summary}</p>
              <div className="guide-card-meta">
                <span>{guide.reviewedAt ? `بررسی ${formatPublicDate(guide.reviewedAt)}` : "تاریخ بررسی منتشرنشده"}</span>
                <strong>مشاهده راهنما ←</strong>
              </div>
            </div>
          </Link>
        ))}
        {staticOnly.map((guide) => (
          <Link href={`/guides/${guide.slug}`} className="guide-card" key={guide.slug}>
            <div className="guide-card-index">{staticDegreeMark(guide.degree)}</div>
            <div>
              <span>{guide.category} · {guide.field}</span>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
              <div className="guide-card-meta"><span>بررسی {guide.reviewedAt}</span><strong>مشاهده راهنما ←</strong></div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function staticDegreeMark(degree: string) {
  if (degree === "ارشد") return "MSc";
  if (degree === "دکتری") return "PhD";
  return "M/P";
}

function toDegreeMark(degrees: string[]) {
  if (degrees.length === 1 && degrees[0] === "PHD") return "PhD";
  if (degrees.length === 1 && degrees[0] === "MASTER") return "MSc";
  return "Guide";
}
