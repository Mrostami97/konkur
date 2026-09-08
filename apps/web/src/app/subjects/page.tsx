import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { findSubject, subjects as legacySubjects } from "../../content/editorial";
import { phase11MasterTracks } from "../../content/phase11";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";

interface PublicSubjectSummary {
  code: string;
  slug: string;
  title: string;
  description: string | null;
  prerequisites?: { prerequisite?: { code: string; title: string } }[];
}

export function generateMetadata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }): Metadata {
  return pageMetadata({
    title: "درس‌های کنکور کامپیوتر و IT ۱۴۰۶",
    description: "صفحهٔ جامع هر درس با پیش‌نیازها، مباحث و محتوای آموزشی منتشرشده.",
    path: "/subjects",
    noIndex: Object.keys(searchParams).length > 0,
  });
}

export default async function SubjectsPage() {
  let apiUnavailable = false;
  let subjects: PublicSubjectSummary[] = [];
  try {
    subjects = (await apiGetPublic<PublicSubjectSummary[]>("/subjects")) ?? [];
  } catch {
    apiUnavailable = true;
  }
  const canonicalSlugs = new Set(subjects.map((subject) => subject.slug));
  const legacyOnly = legacySubjects.filter((subject) => !canonicalSlugs.has(subject.slug));

  return (
    <main className="page-container">
      <PageHeader
        eyebrow="نقشهٔ دانش"
        title="درس‌ها را جدا نخوان؛ مسیرشان را ببین"
        description="سرفصل مرجع، جایگاه رسمی در سه مجموعهٔ ارشد ۱۴۰۶، پیش‌نیاز و ترتیب شروع هر درس را در یک صفحه ببین."
        action={<Link className="button button-primary" href="/guides">دیدن مسیرهای آزمون ←</Link>}
      />

      {apiUnavailable && (
        <aside className="official-disclaimer">
          <strong>نسخهٔ آفلاین</strong>
          <p>سرویس نقشهٔ دانش در دسترس نیست؛ درس‌های پایه نمایش داده می‌شوند و ممکن است آخرین ویرایش taxonomy هنوز در دسترس نباشد.</p>
        </aside>
      )}
      <section className="subjects-intro" aria-label="خلاصهٔ نقشهٔ دانش">
        <div><span className="subjects-intro-kicker">نقشهٔ یکپارچه</span><h2>درس، مبحث و پیش‌نیاز در یک مسیر</h2><p>هر صفحه از جدول رسمی آزمون و سرفصل دانشگاهی تفکیک می‌کند تا عنوان آزمونی با دامنهٔ آموزش اشتباه نشود.</p></div>
        <div className="subjects-intro-metrics"><div><strong>{toPersianDigits(subjects.length + legacyOnly.length)}</strong><span>درس در دسترس</span></div></div>
      </section>

      <section className="track-snapshot" aria-labelledby="master-tracks-title">
        <div className="track-snapshot-heading">
          <span className="eyebrow">سه مسیر رسمی ارشد</span>
          <h2 id="master-tracks-title">ابتدا مجموعه‌ات را انتخاب کن</h2>
          <p>مواد ۱۴۰۶ برای مجموعه‌های ۱۲۷۷، ۱۲۷۶ و ۱۲۰۹ یکسان نیستند؛ صفحهٔ هر مسیر جدول دقیق خودش را دارد.</p>
        </div>
        <div className="track-snapshot-grid">
          {Object.values(phase11MasterTracks).map((track) => (
            <Link className="track-snapshot-card track-snapshot-card-featured" href={`/guides/${track.guideSlug}`} key={track.guideSlug}>
              <span>مجموعهٔ {toPersianDigits(track.collectionCode)}</span>
              <strong>{track.officialName}</strong>
              <small>مواد، ضرایب و صفحهٔ درس‌ها ←</small>
            </Link>
          ))}
        </div>
      </section>

      <div className="subject-grid">
        {subjects.map((subject) => {
          const editorial = findSubject(subject.slug);
          return (
            <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
              <div className="subject-monogram">{editorial?.accent ?? subject.code.slice(0, 3).toUpperCase()}</div>
              <div>
                <span className="subject-status">{editorial?.status1406 ?? "درس مرجع"}</span>
                <h2>{subject.title}</h2>
                {(subject.description ?? editorial?.description) && <p>{subject.description ?? editorial?.description}</p>}
                {editorial && <div className="subject-tags">{editorial.tracks.slice(0, 3).map((track) => <span key={track}>{track}</span>)}</div>}
                <span className="subject-card-link">سرفصل و مسیر یادگیری ←</span>
              </div>
            </Link>
          );
        })}
        {legacyOnly.map((subject) => (
          <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
            <div className="subject-monogram">{subject.accent}</div>
            <div>
              <span className="subject-status">{subject.status1406}</span>
              <h2>{subject.title}</h2>
              <p>{subject.description}</p>
              <div className="subject-tags">{subject.tracks.slice(0, 3).map((track) => <span key={track}>{track}</span>)}</div>
              <span className="subject-card-link">مشاهدهٔ سرفصل و مسیر ←</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
