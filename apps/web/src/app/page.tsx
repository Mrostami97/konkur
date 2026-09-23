import type { Metadata } from "next";
import Link from "next/link";
import { publicArticlePath, type PublicArticleRecord } from "../components/PublicContent";
import { FreeVideoCard, lectureSubject, type FreeVideo } from "../components/FreeVideoCard";
import { StructuredData } from "../components/StructuredData";
import { Glyph, SubjectGlyph, SUBJECT_TONE, type GlyphName } from "../components/SubjectIcon";
import { articles as editorialArticles, guides, subjects } from "../content/editorial";
import { evidenceStats, questionDesignEvidence, studentResults } from "../content/evidence";
import { API_URL, apiGetPublic } from "../lib/api";
import { daysUntil, EXAM_DATES, EXAM_DATES_SOURCE } from "../lib/exam-dates";
import { formatPersianNumber, formatRial, toPersianDigits } from "../lib/format";
import { absoluteUrl, pageMetadata, SITE_NAME } from "../lib/seo";
import "./home.css";

export const metadata: Metadata = pageMetadata({
  title: "کنکور ارشد و دکتری کامپیوتر ۱۴۰۶؛ کلاس، نتایج شاگردان و ویدیوی رایگان",
  description:
    "کلاس‌های کنکور ارشد مهندسی کامپیوتر، IT و علوم کامپیوتر با نتایج واقعی شاگردان، ویدیوی رایگان برای هر درس، راهنمای رسمی ۱۴۰۶، تخمین رتبه و انتخاب رشته.",
  path: "/",
});

// --- data shapes ---------------------------------------------------------------

interface Achievement {
  id: string;
  displayName: string;
  examYear: number;
  degree: "MASTER" | "PHD";
  field: string;
  rank: number;
  rankLabel: string | null;
  acceptedUniversity: string | null;
  acceptedProgram: string | null;
  quote: string | null;
  isFeatured: boolean;
  photoPath: string | null;
}

interface AchievementSummary {
  total: number;
  under10: number;
  under100: number;
  under1000: number;
  bestRank: number | null;
  years: { examYear: number; bestRank: number; count: number }[];
}

/** Catalogue fields are optional on the wire: the homepage must survive an
 * API one version behind during a deploy rather than fail to render. */
interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  instructors?: { slug: string; displayName: string }[];
  moduleCount?: number;
  lessonCount?: number;
  hasVideo?: boolean;
}

interface Product {
  id: string;
  slug: string;
  kind: string;
  courseId: string | null;
  prices: { amountRial: number; isActive: boolean }[];
  courseGrants?: { course: { slug: string } }[];
}

interface ConsultationOffering {
  id: string;
  kind: "SINGLE_SESSION" | "PACKAGE";
  sessionQuota: number;
  durationMinutes: number;
  headline: string;
  description: string;
  amountRial: number | null;
  instructorProfile: { slug: string; displayName: string };
}

async function safe<T>(path: string): Promise<T | null> {
  try {
    return await apiGetPublic<T>(path);
  } catch {
    return null;
  }
}

// --- static content ------------------------------------------------------------

/** The three master's fields and the guide that maps each one. */
const TRACKS = [
  {
    field: "مهندسی کامپیوتر",
    code: "مجموعهٔ ۱۲۷۷",
    guide: "master-computer-engineering-1406",
    tone: "teal",
    track: "ارشد مهندسی و علم کامپیوتر",
  },
  {
    field: "فناوری اطلاعات (IT)",
    code: "مجموعهٔ ۱۲۷۶",
    guide: "master-information-technology-1406",
    tone: "rose",
    track: "ارشد مهندسی فناوری اطلاعات",
  },
  {
    field: "علوم کامپیوتر",
    code: "مجموعهٔ ۱۲۰۹",
    guide: "master-computer-science-1406",
    tone: "violet",
    track: "ارشد علوم کامپیوتر",
  },
] as const;

const TOOLS: { href: string; title: string; body: string; icon: GlyphName; tone: string }[] = [
  { href: "/rank-estimate", title: "تخمین رتبه", body: "با درصدهایت، بازهٔ رتبه و سطح اطمینانش را ببین.", icon: "target", tone: "violet" },
  { href: "/choices", title: "لیست انتخاب رشته", body: "دانشگاه و گرایش‌ها را بچین و پیش‌نویس بساز.", icon: "list", tone: "teal" },
  { href: "/report-cards", title: "کارنامه‌های قبولی", body: "درصد، تراز و رتبهٔ پذیرفته‌شده‌های سال‌های قبل.", icon: "trophy", tone: "amber" },
  { href: "/programs", title: "ظرفیت و گرایش‌ها", body: "کدام دانشگاه چه گرایشی و چند ظرفیت دارد.", icon: "building", tone: "blue" },
  { href: "/today", title: "برنامهٔ امروز من", body: "کار امروزت را بدان و مطالعه‌ات را ثبت کن.", icon: "calendar", tone: "rose" },
  { href: "/guides", title: "راهنمای رسمی ۱۴۰۶", body: "مواد، ضرایب و مجموعه‌ها از اطلاعیهٔ رسمی.", icon: "book", tone: "teal" },
];

const STRENGTHS: { icon: GlyphName; title: string; body: string }[] = [
  {
    icon: "trophy",
    title: "نتیجهٔ واقعی، با نام و رضایت",
    body: "هر رتبه‌ای که اینجا می‌بینی مال یک شاگرد واقعی است که خودش رضایت داده نامش دیده شود؛ عدد ساختگی نداریم.",
  },
  {
    icon: "play",
    title: "ویدیوی رایگان برای هر درس",
    body: "برای شروع هر درس، بهترین کلاس ضبط‌شدهٔ رایگان دانشگاهی را کنار دوره‌ها گذاشته‌ایم.",
  },
  {
    icon: "shield",
    title: "منبع رسمی و تاریخ بازبینی",
    body: "مواد، ضرایب و تاریخ‌ها از اطلاعیهٔ رسمی سنجش؛ روی هر صفحه می‌نویسیم کِی بازبینی شده.",
  },
  {
    icon: "chat",
    title: "مشاوره با خود مدرس",
    body: "جلسهٔ تکی یا بستهٔ سالیانه تا روز کنکور؛ زمان را خودت پیشنهاد می‌دهی.",
  },
  {
    icon: "layers",
    title: "همه‌چیز زیر یک حساب",
    body: "دوره، برنامه، تخمین رتبه و انتخاب رشته در یک جا؛ لازم نیست بین سایت‌ها بچرخی.",
  },
  {
    icon: "spark",
    title: "مطابق ساختار ۱۴۰۶",
    body: "جبر خطی و مبانی برنامه‌سازی که امسال اضافه شد، و درس‌هایی که کنار رفت، همه به‌روز است.",
  },
];

const RANK_TONES = ["gold", "silver", "bronze"] as const;

function mediaUrl(path: string) {
  return `${API_URL}${path}`;
}

function initials(name: string) {
  return name.trim().slice(0, 1);
}

function degreeLabel(degree: Achievement["degree"]) {
  return degree === "PHD" ? "دکتری" : "ارشد";
}

function coursePrice(course: Course, products: Product[]) {
  const product = products.find(
    (item) =>
      item.courseId === course.id || item.courseGrants?.some((grant) => grant.course.slug === course.slug),
  );
  const price = product?.prices.find((row) => row.isActive) ?? product?.prices[0];
  return price ? price.amountRial : null;
}

// --- page ------------------------------------------------------------------------

export default async function HomePage() {
  const [achievements, summary, courses, products, videos, offerings, published] = await Promise.all([
    safe<Achievement[]>("/achievements?limit=40"),
    safe<AchievementSummary>("/achievements/summary"),
    safe<Course[]>("/courses"),
    safe<Product[]>("/products"),
    safe<FreeVideo[]>("/resources?kind=VIDEO"),
    safe<ConsultationOffering[]>("/consultations"),
    safe<PublicArticleRecord[]>("/articles"),
  ]);

  const results = achievements ?? [];
  const featured = results.filter((row) => row.isFeatured).slice(0, 3);
  const wall = results.filter((row) => !featured.includes(row));
  const heroFaces = (featured.length ? featured : results).slice(0, 5);
  const catalogue = courses ?? [];
  const productList = products ?? [];
  const freeVideos = (videos ?? []).filter((video): video is FreeVideo & { externalUrl: string } => Boolean(video.externalUrl));
  const videoSubjects = new Set(freeVideos.flatMap((video) => video.subjectCodes));
  const consultations = offerings ?? [];
  const latestArticles = (published ?? []).slice(0, 6);

  const masterDays = daysUntil(EXAM_DATES.master1406.iso);
  const phdDays = daysUntil(EXAM_DATES.phd1406.iso);

  const faqs = [...guides, ...editorialArticles]
    .filter((page) => page.quickAnswer)
    .slice(0, 5)
    .map((page) => ({ q: page.title, a: page.quickAnswer!, href: `/guides/${page.slug}` }));

  // Extends the site-wide WebSite entity from the layout (same @id) with the
  // search box, rather than declaring a second, competing site entity.
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE_NAME,
      url: absoluteUrl("/"),
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteUrl("/search")}?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <main className="h">
      <StructuredData data={structured} />

      {/* ---------------------------------------------------------------- hero */}
      <section className="h-hero">
        <div className="h-hero-glow" aria-hidden="true" />
        <div className="h-wrap h-hero-grid">
          <div className="h-hero-copy">
            <p className="h-kicker h-kicker-light">
              <span className="h-dot" /> ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر
            </p>
            <h1>
              {summary && summary.total > 0 ? (
                <>
                  رتبه‌های برتر کنکور کامپیوتر،
                  <br />
                  <span className="h-grad">از همین کلاس‌ها</span>
                </>
              ) : (
                <>
                  کنکور ارشد کامپیوتر ۱۴۰۶ را
                  <br />
                  <span className="h-grad">با برنامه شروع کن</span>
                </>
              )}
            </h1>
            <p className="h-lede">
              کلاس‌های کامل هر درس، ویدیوی رایگان برای شروع، راهنمای رسمی ۱۴۰۶ و ابزار تخمین رتبه و انتخاب
              رشته — همه در یک جا.
            </p>

            <form className="h-search" action="/search" method="get" role="search">
              <Glyph name="compass" className="h-search-ico" />
              <input
                name="q"
                type="search"
                placeholder="امروز می‌خواهی چه چیزی یاد بگیری؟ مثلاً «درخت AVL»"
                aria-label="جست‌وجو در درس‌ها، راهنماها و مقاله‌ها"
              />
              <button type="submit">جست‌وجو</button>
            </form>

            <div className="h-chips" aria-label="درس‌های پرجست‌وجو">
              {subjects.slice(4, 11).map((subject) => (
                <Link key={subject.slug} href={`/subjects/${subject.slug}`} className="h-chip">
                  {subject.shortTitle}
                </Link>
              ))}
            </div>

            {summary && summary.total > 0 ? (
              <dl className="h-hero-stats">
                {summary.bestRank !== null && (
                  <div>
                    <dt>بهترین رتبه</dt>
                    <dd>{toPersianDigits(summary.bestRank)}</dd>
                  </div>
                )}
                {summary.under100 > 0 && (
                  <div>
                    <dt>رتبهٔ زیر ۱۰۰</dt>
                    <dd>{toPersianDigits(summary.under100)}</dd>
                  </div>
                )}
                <div>
                  <dt>قبولی ثبت‌شده</dt>
                  <dd>{toPersianDigits(summary.total)}</dd>
                </div>
              </dl>
            ) : (
              <div className="h-hero-cta">
                <Link href="/courses" className="h-btn h-btn-light">
                  دوره‌ها
                </Link>
                <Link href="#free-videos" className="h-btn h-btn-ghost">
                  ویدیوهای رایگان
                </Link>
              </div>
            )}
          </div>

          <div className="h-hero-art" aria-hidden={heroFaces.length === 0}>
            {heroFaces.length > 0 ? (
              <div className="h-fan">
                {heroFaces.map((row, index) => (
                  <figure className={`h-fan-card h-fan-${index}`} key={row.id}>
                    {row.photoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(row.photoPath)} alt={row.displayName} loading="lazy" />
                    ) : (
                      <span className="h-avatar-fallback">{initials(row.displayName)}</span>
                    )}
                    <figcaption>
                      <b>رتبهٔ {toPersianDigits(row.rank)}</b>
                      <span>{row.displayName}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="h-hero-panel">
                <div className="h-countdown-mini">
                  <span>تا {EXAM_DATES.master1406.label}</span>
                  <b>{toPersianDigits(masterDays)}</b>
                  <small>روز</small>
                </div>
                <div className="h-hero-panel-list">
                  {freeVideos.slice(0, 4).map((video) => {
                    const subject = lectureSubject(video);
                    return (
                      <div key={video.slug}>
                        <span className={`h-tone-dot h-t-${SUBJECT_TONE[subject?.slug ?? ""] ?? "teal"}`}>
                          <Glyph name="play" />
                        </span>
                        <span>{subject?.title ?? video.title}</span>
                        <small>رایگان</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-wrap">
          <div className="h-count-strip">
            <span>
              <b>{toPersianDigits(masterDays)}</b> روز تا {EXAM_DATES.master1406.label}
            </span>
            <span>
              <b>{toPersianDigits(phdDays)}</b> روز تا {EXAM_DATES.phd1406.label}
            </span>
            <Link href={EXAM_DATES_SOURCE.href}>{EXAM_DATES_SOURCE.label} ←</Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- results wall */}
      {results.length > 0 && summary && (
        <section className="h-sec h-results" id="results">
          <div className="h-wrap">
            <header className="h-head h-head-row">
              <div>
                <p className="h-kicker">نتایج شاگردان</p>
                <h2>رتبه‌هایی که از همین کلاس‌ها بیرون آمد</h2>
                <p>هر کارت یک شاگرد واقعی است، با رتبه، سال و دانشگاهی که قبول شد — و رضایت خودش برای دیده‌شدن.</p>
              </div>
              <Link href="/results" className="h-link">
                همهٔ نتایج <span aria-hidden="true">←</span>
              </Link>
            </header>

            <div className="h-stats">
              {summary.bestRank !== null && (
                <div className="h-stat h-stat-gold">
                  <b>{toPersianDigits(summary.bestRank)}</b>
                  <span>بهترین رتبه</span>
                </div>
              )}
              <div className="h-stat">
                <b>{toPersianDigits(summary.under100)}</b>
                <span>رتبهٔ زیر ۱۰۰</span>
              </div>
              <div className="h-stat">
                <b>{toPersianDigits(summary.under1000)}</b>
                <span>رتبهٔ زیر ۱۰۰۰</span>
              </div>
              <div className="h-stat">
                <b>{toPersianDigits(summary.total)}</b>
                <span>قبولی ثبت‌شده</span>
              </div>
            </div>

            {featured.length > 0 && (
              <div className="h-featured">
                {featured.map((row, index) => (
                  <article className={`h-star h-star-${RANK_TONES[index] ?? "gold"}`} key={row.id}>
                    <div className="h-star-photo">
                      {row.photoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(row.photoPath)} alt={row.displayName} loading="lazy" />
                      ) : (
                        <span className="h-avatar-fallback h-avatar-lg">{initials(row.displayName)}</span>
                      )}
                      <span className="h-rank-badge">
                        <small>رتبهٔ</small>
                        {toPersianDigits(row.rank)}
                      </span>
                    </div>
                    <h3>{row.displayName}</h3>
                    <p className="h-star-meta">
                      {degreeLabel(row.degree)} {row.field} · {toPersianDigits(row.examYear)}
                      {row.rankLabel ? ` · ${row.rankLabel}` : ""}
                    </p>
                    {row.acceptedUniversity && (
                      <p className="h-star-uni">
                        <Glyph name="building" />
                        {row.acceptedUniversity}
                        {row.acceptedProgram ? ` — ${row.acceptedProgram}` : ""}
                      </p>
                    )}
                    {row.quote && <blockquote>«{row.quote}»</blockquote>}
                  </article>
                ))}
              </div>
            )}

            {wall.length > 0 && (
              <ul className="h-wall">
                {wall.map((row) => (
                  <li key={row.id} title={`${row.displayName} — رتبهٔ ${row.rank}، ${row.examYear}`}>
                    <div className="h-wall-photo">
                      {row.photoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(row.photoPath)} alt={row.displayName} loading="lazy" />
                      ) : (
                        <span className="h-avatar-fallback">{initials(row.displayName)}</span>
                      )}
                    </div>
                    <b>{toPersianDigits(row.rank)}</b>
                    <span>{row.displayName}</span>
                    <small>{toPersianDigits(row.examYear)}</small>
                  </li>
                ))}
              </ul>
            )}

            {summary.years.length > 0 && (
              <div className="h-years">
                {summary.years.map((year) => (
                  <span key={year.examYear}>
                    کنکور {toPersianDigits(year.examYear)}: {toPersianDigits(year.count)} قبولی، بهترین رتبهٔ{" "}
                    {toPersianDigits(year.bestRank)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* -------------------------------------------------- teaching record */}
      <section className="h-sec h-record">
        <div className="h-wrap">
          <header className="h-head h-head-row">
            <div>
              <p className="h-kicker">کارنامهٔ تدریس</p>
              <h2>کلاس با سؤال واقعی کنکور سنجیده می‌شود</h2>
              <p>نمونه‌های ثبت‌شده از نتیجهٔ شاگردان و تطبیق مطالب کلاس با کنکور؛ هر عدد به پست اصلی‌اش لینک دارد.</p>
            </div>
            <Link href="/evidence" className="h-link">
              همهٔ مستندات <span aria-hidden="true">←</span>
            </Link>
          </header>

          <div className="h-record-grid">
            {evidenceStats.map((stat) => (
              <div className={`h-record-stat h-record-${stat.tone}`} key={stat.label}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
                <small>{stat.detail}</small>
              </div>
            ))}
          </div>

          <div className="h-record-docs">
            {[questionDesignEvidence, ...studentResults.filter((row) => row.featured && row.category === "کارنامه")].map((doc) => (
              <a className="h-record-doc" href={doc.telegramUrl} target="_blank" rel="noopener noreferrer" key={doc.id}>
                <span className="h-record-doc-ico">
                  <Glyph name={doc.category === "طراحی سؤال" ? "spark" : "trophy"} />
                </span>
                <span>
                  <small>{doc.category} · {doc.subject}{doc.year !== "—" ? ` · ${doc.year}` : ""}</small>
                  <strong>{doc.metric}</strong>
                  <em>{doc.description}</em>
                </span>
                <span className="h-record-doc-go" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
          <p className="h-record-note">این‌ها نمونه‌های منتشرشده‌اند، نه تضمین نتیجه یا پیش‌بینی سؤال آینده.</p>
        </div>
      </section>

      {/* ------------------------------------------------------------ courses */}
      {catalogue.length > 0 && (
        <section className="h-sec" id="courses">
          <div className="h-wrap">
            <header className="h-head h-head-row">
              <div>
                <p className="h-kicker">دوره‌های {SITE_NAME}</p>
                <h2>دوره‌های کامل، از پایه تا تست کنکور</h2>
              </div>
              <Link href="/courses" className="h-link">
                همهٔ دوره‌ها ←
              </Link>
            </header>
            <div className="h-courses">
              {catalogue.slice(0, 6).map((course) => {
                const subject = subjects.find((item) => course.title.includes(item.shortTitle) || course.title.includes(item.title));
                const tone = SUBJECT_TONE[subject?.slug ?? ""] ?? "teal";
                const price = coursePrice(course, productList);
                return (
                  <Link href={`/courses/${course.slug}`} className="h-course" key={course.id}>
                    <div className={`h-course-cover h-t-${tone}`}>
                      <SubjectGlyph slug={subject?.slug ?? ""} className="h-course-glyph" />
                      {course.hasVideo && <span className="h-pill">ویدیو در اسپات‌پلیر</span>}
                    </div>
                    <div className="h-course-body">
                      <h3>{course.title}</h3>
                      <p>{course.description}</p>
                      <div className="h-course-meta">
                        {(course.instructors ?? []).length > 0 && (
                          <span>{(course.instructors ?? []).map((row) => row.displayName).join("، ")}</span>
                        )}
                        {(course.lessonCount ?? 0) > 0 && <span>{toPersianDigits(course.lessonCount ?? 0)} درس</span>}
                      </div>
                      <div className="h-course-foot">
                        {price !== null ? <b>{formatRial(price)}</b> : <b>ثبت‌نام</b>}
                        <span className="h-arrow">مشاهده ←</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- free videos */}
      {freeVideos.length > 0 && (
        <section className="h-sec h-free" id="free-videos">
          <div className="h-wrap">
            <header className="h-head h-head-row">
              <div>
                <p className="h-kicker">
                  <span className="h-free-badge">رایگان</span> ویدیوی هر درس
                </p>
                <h2>هر درس را رایگان شروع کن</h2>
                <p>
                  کلاس‌های ضبط‌شدهٔ دانشگاه شریف و استادهای برتر؛ روی هر کارت بزنی، به صفحهٔ اصلی درس در سایت
                  ناشر می‌روی.
                </p>
              </div>
              <Link href="/free-videos" className="h-link">
                همهٔ ویدیوها ←
              </Link>
            </header>
            <div className="h-videos">
              {freeVideos.map((video) => (
                <FreeVideoCard video={video} key={video.slug} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- strengths */}
      <section className="h-sec h-why">
        <div className="h-wrap">
          <header className="h-head h-head-center">
            <p className="h-kicker">چرا {SITE_NAME}</p>
            <h2>چیزی که جای دیگر پیدا نمی‌کنی</h2>
          </header>
          <div className="h-why-grid">
            {STRENGTHS.map((item) => (
              <div className="h-why-card" key={item.title}>
                <span className="h-why-ico">
                  <Glyph name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- subjects */}
      <section className="h-sec" id="subjects">
        <div className="h-wrap">
          <header className="h-head h-head-row">
            <div>
              <p className="h-kicker">نقشهٔ درس‌ها</p>
              <h2>{toPersianDigits(subjects.length)} درس، با وضعیت واقعی ۱۴۰۶</h2>
              <p>ضریب و جایگاه هر درس در مجموعه‌های امسال، پیش‌نیازش و از کجا شروع کنی.</p>
            </div>
            <Link href="/subjects" className="h-link">
              همهٔ درس‌ها ←
            </Link>
          </header>
          <div className="h-subjects">
            {subjects.map((subject) => {
              const tone = SUBJECT_TONE[subject.slug] ?? "teal";
              return (
                <Link href={`/subjects/${subject.slug}`} className={`h-subject h-ts-${tone}`} key={subject.slug}>
                  <span className={`h-subject-ico h-t-${tone}`}>
                    <SubjectGlyph slug={subject.slug} />
                  </span>
                  <span className="h-subject-text">
                    <b>{subject.title}</b>
                    <small>{subject.status1406}</small>
                  </span>
                  {videoSubjects.has(subject.slug) && <span className="h-subject-free">ویدیوی رایگان</span>}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- tracks */}
      <section className="h-sec h-tracks-sec">
        <div className="h-wrap">
          <header className="h-head h-head-center">
            <p className="h-kicker">سه رشته، سه مسیر</p>
            <h2>رشته‌ات را انتخاب کن</h2>
            <p>هر مجموعه درس‌ها و ضرایب خودش را دارد؛ از راهنمای همان رشته شروع کن.</p>
          </header>
          <div className="h-tracks">
            {TRACKS.map((track) => {
              const trackSubjects = subjects.filter((subject) => subject.tracks.includes(track.track));
              return (
                <Link href={`/guides/${track.guide}`} className={`h-track h-tt-${track.tone}`} key={track.guide}>
                  <span className="h-track-code">{track.code}</span>
                  <h3>{track.field}</h3>
                  <ul>
                    {trackSubjects.slice(0, 7).map((subject) => (
                      <li key={subject.slug}>{subject.shortTitle}</li>
                    ))}
                  </ul>
                  <span className="h-arrow">راهنمای کامل ۱۴۰۶ ←</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- tools */}
      <section className="h-sec">
        <div className="h-wrap">
          <header className="h-head">
            <p className="h-kicker">ابزارهای رایگان</p>
            <h2>از تخمین رتبه تا انتخاب رشته</h2>
          </header>
          <div className="h-tools">
            {TOOLS.map((tool) => (
              <Link href={tool.href} className="h-tool" key={tool.href}>
                <span className={`h-tool-ico h-t-${tool.tone}`}>
                  <Glyph name={tool.icon} />
                </span>
                <span>
                  <b>{tool.title}</b>
                  <small>{tool.body}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- consultation */}
      {consultations.length > 0 && (
        <section className="h-sec h-consult">
          <div className="h-wrap h-consult-grid">
            <div className="h-consult-copy">
              <p className="h-kicker h-kicker-light">مشاوره</p>
              <h2>با خود مدرس برنامه‌ات را بچین</h2>
              <p>
                جلسهٔ تکی برای رفع ابهام، یا بستهٔ سالیانه که تا روز کنکور کنارت است. بعد از پرداخت، زمان
                پیشنهادی‌ات را ثبت می‌کنی و مدرس تأیید می‌کند.
              </p>
              <Link href="/consultations" className="h-btn h-btn-light">
                همهٔ مشاوره‌ها
              </Link>
            </div>
            <div className="h-consult-cards">
              {consultations.slice(0, 2).map((offering) => (
                <Link href="/consultations" className="h-consult-card" key={offering.id}>
                  <span className="h-pill">{offering.kind === "PACKAGE" ? "بستهٔ سالیانه" : "تک‌جلسه‌ای"}</span>
                  <h3>{offering.headline}</h3>
                  <p>
                    {offering.instructorProfile.displayName} · {formatPersianNumber(offering.sessionQuota)} جلسهٔ{" "}
                    {formatPersianNumber(offering.durationMinutes)} دقیقه‌ای
                  </p>
                  {offering.amountRial !== null && <b>{formatRial(offering.amountRial)}</b>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- countdown */}
      <section className="h-sec h-countdown">
        <div className="h-wrap h-countdown-grid">
          <div className="h-cd h-cd-master">
            <span>روزشمار {EXAM_DATES.master1406.label}</span>
            <b>{toPersianDigits(masterDays)}</b>
            <small>روز مانده · {EXAM_DATES.master1406.dateLabel}</small>
          </div>
          <div className="h-cd h-cd-phd">
            <span>روزشمار {EXAM_DATES.phd1406.label}</span>
            <b>{toPersianDigits(phdDays)}</b>
            <small>روز مانده · {EXAM_DATES.phd1406.dateLabel}</small>
          </div>
          <p className="h-cd-src">
            <Link href={EXAM_DATES_SOURCE.href}>{EXAM_DATES_SOURCE.label}</Link> — پیش از هر اقدام، اطلاعیهٔ روز سنجش
            را هم ببین.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- articles */}
      {latestArticles.length > 0 && (
        <section className="h-sec">
          <div className="h-wrap">
            <header className="h-head h-head-row">
              <div>
                <p className="h-kicker">راهنما و مقاله</p>
                <h2>تازه‌ترین مطالب</h2>
              </div>
              <Link href="/articles" className="h-link">
                همهٔ مطالب ←
              </Link>
            </header>
            <div className="h-articles">
              {latestArticles.map((article, index) => (
                <Link href={publicArticlePath(article)} className="h-article" key={article.slug}>
                  <div className={`h-article-cover h-ac-${index % 5}`}>
                    <span>{article.contentType === "GUIDE" ? "راهنما" : "مقاله"}</span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- faq */}
      {faqs.length > 0 && (
        <section className="h-sec h-faq-sec">
          <div className="h-wrap h-faq-wrap">
            <header className="h-head">
              <p className="h-kicker">پرسش‌های پرتکرار</p>
              <h2>جواب کوتاه، با منبع</h2>
            </header>
            <div className="h-faq">
              {faqs.map((faq) => (
                <details key={faq.q}>
                  <summary>{faq.q}</summary>
                  <p>{faq.a}</p>
                  <Link href={faq.href}>ادامه در راهنما ←</Link>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
