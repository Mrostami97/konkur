import type { Metadata } from "next";
import Link from "next/link";
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

  const totalSubjects = subjects.length + legacyOnly.length;

  return (
    <main className="pg">
      <div className="pg-hero-wrap">
        <div className="pg-shell pg-hero">
          <p className="pg-eyebrow">نقشهٔ دانش</p>
          <h1>درس‌ها را جدا نخوان؛ مسیرشان را ببین</h1>
          <p className="pg-lede">سرفصل مرجع، جایگاه رسمی در سه مجموعهٔ ارشد ۱۴۰۶، پیش‌نیاز و ترتیب شروع هر درس را در یک صفحه ببین.</p>
          <Link className="button button-primary pg-hero-action" href="/guides">دیدن مسیرهای آزمون ←</Link>
        </div>
      </div>

      {apiUnavailable && (
        <div className="pg-shell pg-band">
          <div className="ds-alert ds-alert-warning">
            <strong>نسخهٔ آفلاین.</strong>&nbsp;سرویس نقشهٔ دانش در دسترس نیست؛ درس‌های پایه نمایش داده می‌شوند و ممکن است آخرین ویرایش taxonomy هنوز در دسترس نباشد.
          </div>
        </div>
      )}

      <section className="pg-shell pg-sec" aria-labelledby="master-tracks-title">
        <div className="pg-head">
          <div>
            <h2 id="master-tracks-title">ابتدا مجموعه‌ات را انتخاب کن</h2>
            <p>مواد ۱۴۰۶ برای مجموعه‌های ۱۲۷۷، ۱۲۷۶ و ۱۲۰۹ یکسان نیستند؛ صفحهٔ هر مسیر جدول دقیق خودش را دارد.</p>
          </div>
        </div>
        <div className="pg-grid pg-grid-wide">
          {Object.values(phase11MasterTracks).map((track) => (
            <Link className="pg-card" href={`/guides/${track.guideSlug}`} key={track.guideSlug}>
              <span className="pg-card-meta">مجموعهٔ {toPersianDigits(track.collectionCode)}</span>
              <b>{track.officialName}</b>
              <small>مواد، ضرایب و صفحهٔ درس‌ها ←</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="pg-shell pg-sec pg-sec-line" aria-label="خلاصهٔ نقشهٔ دانش">
        <div className="pg-head">
          <div>
            <h2>{toPersianDigits(totalSubjects)} درس در دسترس</h2>
            <p>هر صفحه از جدول رسمی آزمون و سرفصل دانشگاهی تفکیک می‌کند تا عنوان آزمونی با دامنهٔ آموزش اشتباه نشود.</p>
          </div>
        </div>
        {totalSubjects === 0 ? (
          <div className="ds-empty">
            <span className="ds-empty-icon" aria-hidden="true">✦</span>
            <strong>هنوز درسی ثبت نشده است</strong>
            <p>به‌محض انتشار نقشهٔ دانش، درس‌ها اینجا نمایش داده می‌شوند.</p>
          </div>
        ) : (
          <div className="pg-grid">
            {subjects.map((subject) => {
              const editorial = findSubject(subject.slug);
              return (
                <Link className="pg-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
                  <span className="pg-ico" aria-hidden="true">{editorial?.accent ?? subject.code.slice(0, 3).toUpperCase()}</span>
                  <span className="pg-card-meta">{editorial?.status1406 ?? "درس مرجع"}</span>
                  <b>{subject.title}</b>
                  {(subject.description ?? editorial?.description) && <small>{subject.description ?? editorial?.description}</small>}
                </Link>
              );
            })}
            {legacyOnly.map((subject) => (
              <Link className="pg-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
                <span className="pg-ico" aria-hidden="true">{subject.accent}</span>
                <span className="pg-card-meta">{subject.status1406}</span>
                <b>{subject.title}</b>
                <small>{subject.description}</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
