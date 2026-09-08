import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "../../components/ui";
import { subjects as legacySubjects } from "../../content/editorial";
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
        description="هر درس به مباحث، پیش‌نیازها و محتوای منتشرشدهٔ مرتبط متصل می‌شود؛ دادهٔ API مرجع اصلی این نقشه است."
        action={<Link className="button button-primary" href="/guides">دیدن مسیرهای آزمون ←</Link>}
      />

      {apiUnavailable && (
        <aside className="official-disclaimer">
          <strong>نسخهٔ آفلاین</strong>
          <p>سرویس نقشهٔ دانش در دسترس نیست؛ درس‌های پایه نمایش داده می‌شوند و ممکن است آخرین ویرایش taxonomy هنوز در دسترس نباشد.</p>
        </aside>
      )}
      <section className="subjects-intro" aria-label="خلاصهٔ نقشهٔ دانش">
        <div><span className="subjects-intro-kicker">نقشهٔ یکپارچه</span><h2>درس، مبحث و پیش‌نیاز در یک مسیر</h2><p>دادهٔ مرجع منتشرشده در اولویت است و درس‌های پایهٔ سایت تا انتقال کامل محتوا حفظ می‌شوند.</p></div>
        <div className="subjects-intro-metrics"><div><strong>{toPersianDigits(subjects.length + legacyOnly.length)}</strong><span>درس در دسترس</span></div></div>
      </section>
      <div className="subject-grid">
        {subjects.map((subject) => (
          <Link className="subject-card" href={`/subjects/${subject.slug}`} key={subject.slug}>
            <div className="subject-monogram">{subject.code.slice(0, 3).toUpperCase()}</div>
            <div>
              <span className="subject-status">درس مرجع</span>
              <h2>{subject.title}</h2>
              {subject.description && <p>{subject.description}</p>}
              <span className="subject-card-link">مشاهدهٔ مباحث و محتوای مرتبط ←</span>
            </div>
          </Link>
        ))}
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
