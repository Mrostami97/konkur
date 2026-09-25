import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoon } from "../../components/ComingSoon";
import { FreeVideoCard, type FreeVideo } from "../../components/FreeVideoCard";
import { StructuredData } from "../../components/StructuredData";
import { SubjectGlyph, SUBJECT_TONE } from "../../components/SubjectIcon";
import { subjects } from "../../content/editorial";
import { apiGetPublic } from "../../lib/api";
import { toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import "../home.css";
import "../landing.css";

interface Course {
  slug: string;
  title: string;
  subject?: { slug: string } | null;
}

type LinkedVideo = FreeVideo & { externalUrl: string };

async function load<T>(path: string): Promise<T | null> {
  try {
    return await apiGetPublic<T>(path);
  } catch {
    return null;
  }
}

async function loadVideos(): Promise<LinkedVideo[] | null> {
  const rows = await load<FreeVideo[]>("/resources?kind=VIDEO");
  return rows ? rows.filter((row): row is LinkedVideo => Boolean(row.externalUrl)) : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const videos = await loadVideos();
  return pageMetadata({
    title: "ویدیوی رایگان دروس کنکور ارشد کامپیوتر",
    description:
      "کلاس‌های ضبط‌شدهٔ رایگان دانشگاه شریف و استادهای برتر برای هر درس کنکور ارشد کامپیوتر و IT: مدار منطقی، ساختمان داده، معماری، آمار، گسسته، هوش مصنوعی و برنامه‌سازی.",
    path: "/free-videos",
    noIndex: videos === null || videos.length === 0,
  });
}

/** The course that teaches a subject: its linked subject first, then its title. */
function courseFor(courses: Course[], slug: string, titles: string[]) {
  return (
    courses.find((course) => course.subject?.slug === slug) ??
    courses.find((course) => titles.some((title) => course.title.includes(title)))
  );
}

export default async function FreeVideosPage() {
  const [videos, courses] = await Promise.all([loadVideos(), load<Course[]>("/courses")]);
  const list = videos ?? [];
  const catalogue = courses ?? [];

  // A series filed under two subjects (the integrated and the standalone data
  // structures course share one) is listed once, under the first of them.
  const home = new Map(
    list.map((video) => [video.slug, subjects.find((subject) => video.subjectCodes.includes(subject.slug))?.slug]),
  );
  const groups = subjects
    .map((subject) => ({
      subject,
      videos: list.filter((video) => home.get(video.slug) === subject.slug),
      course: courseFor(catalogue, subject.slug, [subject.shortTitle, subject.title]),
    }))
    .filter((group) => group.videos.length > 0);
  const covered = new Set(list.flatMap((video) => video.subjectCodes));
  const uncovered = subjects.filter((subject) => !covered.has(subject.slug));

  const structured = list.length
    ? [
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "ویدیوی رایگان دروس کنکور ارشد کامپیوتر",
          url: absoluteUrl("/free-videos"),
          itemListElement: list.map((video, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: video.title,
            url: absoluteUrl(`/resources/${video.slug}`),
          })),
        },
      ]
    : [];

  return (
    <main className="h">
      {structured.length > 0 && <StructuredData data={structured} />}

      <section className="lp-hero lp-hero-teal">
        <div className="h-wrap">
          <nav className="lp-crumbs" aria-label="مسیر صفحه">
            <Link href="/">خانه</Link>
            <span aria-hidden="true">/</span>
            <span>ویدیوی رایگان</span>
          </nav>
          <p className="h-kicker h-kicker-light">
            <span className="h-free-badge">رایگان</span> برای شروع هر درس
          </p>
          <h1>ویدیوی رایگان دروس کنکور کامپیوتر</h1>
          <p className="lp-lede">
            برای هر درسی که هنوز دورهٔ کنکوری‌اش را نداری، بهترین کلاس ضبط‌شدهٔ رایگان دانشگاهی را اینجا
            جمع کرده‌ایم. با آن پایه را بساز، بعد با تست و دورهٔ کنکوری جلو برو.
          </p>
          {list.length > 0 && (
            <div className="lp-facts">
              <span><b>{toPersianDigits(list.length)}</b> دورهٔ کامل رایگان</span>
              <span><b>{toPersianDigits(groups.length)}</b> درس کنکور</span>
              <span><b>۱۰۰٪</b> رایگان، بدون ثبت‌نام</span>
            </div>
          )}
        </div>
      </section>

      <div className="h-wrap lp-body">
        {videos === null ? (
          <div className="lp-empty">
            <h2>فهرست ویدیوها الان در دسترس نیست</h2>
            <p>چند دقیقهٔ دیگر دوباره سر بزن، یا تا آن موقع از صفحهٔ درس‌ها شروع کن.</p>
            <Link href="/subjects" className="h-btn h-btn-primary">دیدن درس‌ها</Link>
          </div>
        ) : groups.length === 0 ? (
          <ComingSoon
            icon="spark"
            title="فهرست ویدیوهای رایگان به‌زودی"
            text="بهترین کلاس‌های ضبط‌شدهٔ رایگان دانشگاهی برای هر درس کنکور، با لینک به منبع اصلی، در حال بازبینی است. تا آن موقع، صفحهٔ هر درس سرفصل و مسیر مطالعه‌اش را دارد."
            alternatives={[
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
              { href: "/articles/how-to-choose-study-resources", label: "انتخاب منبع مطالعه" },
              { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
            ]}
          />
        ) : (
          <>
            <nav className="lp-jump" aria-label="پرش به درس">
              {groups.map(({ subject }) => (
                <a href={`#${subject.slug}`} key={subject.slug} className={`lp-jump-chip h-ts-${SUBJECT_TONE[subject.slug] ?? "teal"}`}>
                  <SubjectGlyph slug={subject.slug} />
                  {subject.shortTitle}
                </a>
              ))}
            </nav>

            {groups.map(({ subject, videos: rows, course }) => (
              <section className="lp-group" id={subject.slug} key={subject.slug}>
                <header className="lp-group-head">
                  <span className={`lp-group-icon h-t-${SUBJECT_TONE[subject.slug] ?? "teal"}`}>
                    <SubjectGlyph slug={subject.slug} />
                  </span>
                  <div>
                    <h2>{subject.title}</h2>
                    <p>{subject.description}</p>
                  </div>
                  <Link href={`/subjects/${subject.slug}`} className="h-link">صفحهٔ درس ←</Link>
                </header>
                <div className="h-videos">
                  {rows.map((video) => <FreeVideoCard video={video} key={video.slug} />)}
                  {course && (
                    <Link href={`/courses/${course.slug}`} className="lp-upsell">
                      <small>بعد از ویدیوی رایگان</small>
                      <strong>دورهٔ کنکوری {course.title}</strong>
                      <span>دورهٔ کامل کنکوری همین درس ←</span>
                    </Link>
                  )}
                </div>
              </section>
            ))}

            {uncovered.length > 0 && (
              <section className="lp-group lp-uncovered">
                <h2>درس‌هایی که هنوز ویدیوی رایگان معتبرشان را ثبت نکرده‌ایم</h2>
                <p>فقط کلاسی را اینجا می‌گذاریم که کامل، رایگان و از منبع قابل استناد باشد؛ برای این درس‌ها از صفحهٔ خود درس شروع کن.</p>
                <div className="lp-chips">
                  {uncovered.map((subject) => (
                    <Link href={`/subjects/${subject.slug}`} key={subject.slug} className="h-chip-soft">
                      {subject.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <aside className="lp-note">
              <strong>دربارهٔ حق نشر</strong>
              <p>
                ویدیوها متعلق به ناشر اصلی‌شان هستند و روی این سایت کپی، بازنشر یا پخش نمی‌شوند؛ هر کارت فقط شما را
                به صفحهٔ اصلی درس در سایت ناشر می‌برد. <Link href="/source-policy">سیاست منبع و حق نشر</Link>
              </p>
            </aside>
          </>
        )}
      </div>
    </main>
  );
}
