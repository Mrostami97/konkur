import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { publicArticlePath, type PublicArticleRecord } from "../components/PublicContent";
import { FreeVideoCard, type FreeVideo } from "../components/FreeVideoCard";
import { StructuredData } from "../components/StructuredData";
import { Glyph, SubjectGlyph, SUBJECT_TONE } from "../components/SubjectIcon";
import { subjects } from "../content/editorial";
import { EvidenceRebuildView } from "../components/EvidenceRebuild";
import { alignmentEvidence, evidenceStats, ownerResults, questionDesignEvidence, studentResults } from "../content/evidence";
import { evidenceRebuilds, type QuestionsRebuild } from "../content/evidence-rebuilds";
import { API_URL, apiGetPublic } from "../lib/api";
import { daysUntil, EXAM_DATES } from "../lib/exam-dates";
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

/** Named students whose scorecard leads with a rank, best rank first. */
const rankedStudents = studentResults
  .filter((row) => row.student && row.hero && row.category === "کارنامه")
  .sort((a, b) => Number(a.hero!.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) - Number(b.hero!.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))));

/** Every named result, for the running ticker under the hero. */
const tickerItems = studentResults.filter((row) => row.student && row.hero);

const designQuestions = evidenceRebuilds["question-design-1401"]?.[0] as QuestionsRebuild | undefined;
const answerSheet = evidenceRebuilds["data-1405-a"]?.[0];

const JOURNEYS = [
  { href: "/free-videos", glyph: "play", title: "ویدیوی رایگان", text: "هر درس را رایگان شروع کن", tone: "teal" },
  { href: "/questions", glyph: "list", title: "بانک سؤال", text: "تست‌های کنکور با پاسخ تشریحی", tone: "blue" },
  { href: "/exams", glyph: "target", title: "آزمون", text: "خودت را با زمان واقعی بسنج", tone: "violet" },
  { href: "/today", glyph: "calendar", title: "برنامهٔ امروز", text: "امروز دقیقاً چه بخوانم؟", tone: "amber" },
  { href: "/rank-estimate", glyph: "curve", title: "تخمین رتبه", text: "با درصدهایت، بازهٔ رتبه", tone: "rose" },
  { href: "/choices", glyph: "building", title: "انتخاب رشته", text: "رتبه‌ات کجا قبول می‌شود", tone: "teal" },
] as const;

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
  const catalogue = courses ?? [];
  const productList = products ?? [];
  const freeVideos = (videos ?? []).filter((video): video is FreeVideo & { externalUrl: string } => Boolean(video.externalUrl));
  const consultations = offerings ?? [];
  const latestArticles = (published ?? []).slice(0, 3);

  const masterDays = daysUntil(EXAM_DATES.master1406.iso);
  const phdDays = daysUntil(EXAM_DATES.phd1406.iso);

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
      <section className="hx-hero">
        <div className="hx-hero-bg" aria-hidden="true" />
        <div className="h-wrap hx-hero-grid">
          <div className="hx-hero-copy">
            <p className="hx-kicker">
              <span className="hx-live" /> {toPersianDigits(masterDays)} روز تا {EXAM_DATES.master1406.label}
            </p>
            <h1>
              کنکور کامپیوتر را با کلاسی بخوان که <em>نتیجه‌اش سند دارد</em>
            </h1>
            <p className="hx-lede">
              کلاس‌های ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر با محمد رستمی، ارشد نرم‌افزار شریف. از ۱۲ تست
              ساختمان داده و الگوریتم کنکور ۱۴۰۵، نُه‌تا پیش‌تر سر کلاس کار شده بود.
            </p>

            <div className="hx-cta">
              <Link href="/free-videos" className="hx-btn hx-btn-primary">
                <Glyph name="play" /> شروع رایگان
              </Link>
              <Link href="/evidence" className="hx-btn hx-btn-ghost">
                <Glyph name="shield" /> نتایج، با سند
              </Link>
            </div>

            <form className="hx-search" action="/search" method="get" role="search">
              <Glyph name="compass" />
              <input
                name="q"
                type="search"
                placeholder="چه چیزی می‌خواهی یاد بگیری؟ مثلاً «درخت AVL»"
                aria-label="جست‌وجو در درس‌ها، راهنماها و مقاله‌ها"
              />
              <button type="submit">جست‌وجو</button>
            </form>
            <div className="hx-chips" aria-label="درس‌های پرجست‌وجو">
              {subjects.slice(4, 10).map((subject) => (
                <Link key={subject.slug} href={`/subjects/${subject.slug}`}>
                  {subject.shortTitle}
                </Link>
              ))}
            </div>
          </div>

          <div className="hx-stage" aria-label="چند نتیجهٔ شاگردها">
            {rankedStudents.slice(0, 4).map((row, index) => (
              <Link href={`/evidence#${row.id}`} className={`hx-card hx-card-${index}`} key={row.id}>
                <span className="hx-card-top">
                  <span>{row.subject.split(" · ")[0]}</span>
                  <span>کنکور {row.year}</span>
                </span>
                <b>
                  <small>رتبهٔ</small>
                  {row.hero!.value}
                </b>
                <span className="hx-card-label">{row.hero!.label}</span>
                <span className="hx-card-name">
                  <i aria-hidden="true">{row.student!.replace(/^(آقای|خانم)\s+/, "").charAt(0)}</i>
                  {row.student}
                </span>
              </Link>
            ))}
            <div className="hx-float hx-float-a">
              <b>۹ از ۱۲</b>
              <span>تست ۱۴۰۵، قبلاً سر کلاس</span>
            </div>
            <div className="hx-float hx-float-b">
              <b>۱۰۰٪</b>
              <span>نظریه، دو شاگرد کلاس ۱۴۰۵</span>
            </div>
          </div>
        </div>

        <div className="hx-ticker" aria-label="نتایج شاگردها">
          <div className="hx-ticker-track">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {tickerItems.map((row) => (
                  <li key={row.id}>
                    <Glyph name="trophy" />
                    <b>{row.hero!.value}</b> {row.hero!.label}
                    <span>{row.student} · {row.year}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- journeys */}
      <section className="hx-journeys" aria-label="از کجا شروع کنم">
        <div className="h-wrap hx-journey-grid">
          {JOURNEYS.map((item) => (
            <Link href={item.href} className={`hx-journey hx-j-${item.tone}`} key={item.href}>
              <span className="hx-journey-ico"><Glyph name={item.glyph} /></span>
              <b>{item.title}</b>
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- proof */}
      <section className="h-sec hx-proof" id="proof">
        <div className="h-wrap">
          <header className="h-head h-head-row">
            <div>
              <p className="h-kicker">امضای این کلاس</p>
              <h2>کلاس با سؤال واقعی کنکور سنجیده می‌شود</h2>
              <p>عددها ادعا نیستند؛ هر کدام کنار سندش در صفحهٔ مستندات هست.</p>
            </div>
            <Link href="/evidence" className="h-link">
              همهٔ مستندات <span aria-hidden="true">←</span>
            </Link>
          </header>

          <div className="hx-proof-stats">
            {evidenceStats.map((stat) => (
              <div className={`hx-proof-stat hx-ps-${stat.tone}`} key={stat.label}>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
                <small>{stat.detail}</small>
              </div>
            ))}
          </div>

          <div className="hx-proof-grid">
            {designQuestions && (
              <article className="hx-proof-card hx-proof-q">
                <span className="hx-proof-tag"><Glyph name="spark" /> طراحی سؤال · ۱۴۰۱</span>
                <h3>{questionDesignEvidence.title}</h3>
                <EvidenceRebuildView rebuild={{ ...designQuestions, panels: designQuestions.panels.slice(0, 2) }} />
                <Link href={`/evidence#${questionDesignEvidence.id}`} className="h-link">سؤال ۶۹ و سند اصلی ←</Link>
              </article>
            )}
            {answerSheet && (
              <article className="hx-proof-card hx-proof-sheet">
                <span className="hx-proof-tag"><Glyph name="target" /> پاسخ‌برگ یک شاگرد · ۱۴۰۵</span>
                <h3>ساختمان داده و الگوریتم: ۱۰ درست از ۱۱ سؤال معتبر</h3>
                <EvidenceRebuildView rebuild={answerSheet} />
                <Link href="/evidence#data-1405-a" className="h-link">پاسخ‌برگ‌های دیگر ←</Link>
              </article>
            )}
          </div>

          {alignmentEvidence.topics && (
            <div className="hx-topics">
              <span>مبحث‌هایی از ۱۴۰۵ که سر کلاس بود:</span>
              {alignmentEvidence.topics.map((topic) => <em key={topic}>{topic}</em>)}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- students */}
      <section className="h-sec hx-students" id="students">
        <div className="h-wrap">
          <header className="h-head h-head-row">
            <div>
              <p className="h-kicker">نتایج شاگردان</p>
              <h2>رتبه‌هایی که از همین کلاس‌ها بیرون آمد</h2>
              <p>با اسم خودشان و کارنامه‌ای که بازسازی‌اش را در صفحهٔ مستندات می‌بینی.</p>
            </div>
            <Link href="/evidence" className="h-link">
              همهٔ کارنامه‌ها <span aria-hidden="true">←</span>
            </Link>
          </header>
          <div className="hx-student-grid">
            {rankedStudents.map((row) => (
              <Link href={`/evidence#${row.id}`} className="hx-student" key={row.id}>
                <span className="hx-student-head">
                  <span className="hx-student-rank">
                    <small>رتبهٔ</small>
                    {row.hero!.value}
                  </span>
                  <span className="hx-student-who">
                    <b>{row.student}</b>
                    <small>{row.role ?? row.subject}</small>
                  </span>
                </span>
                <span className="hx-student-title">{row.metric}</span>
                {row.facts && (
                  <span className="hx-student-facts">
                    {row.facts.slice(0, 3).map((fact) => (
                      <span key={fact.label}><b>{fact.value}</b>{fact.label}</span>
                    ))}
                  </span>
                )}
                <span className="hx-student-foot">کنکور {row.year} · دیدن کارنامه ←</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- results wall */}
      {results.length > 0 && summary && (
        <section className="h-sec h-results" id="results">
          <div className="h-wrap">
            <header className="h-head h-head-row">
              <div>
                <p className="h-kicker">قبولی‌های ثبت‌شده</p>
                <h2>همهٔ رتبه‌ها و دانشگاه‌ها</h2>
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

      {/* ------------------------------------------------------------ teacher */}
      <section className="h-sec hx-teacher">
        <div className="h-wrap hx-teacher-grid">
          <div className="hx-teacher-photo">
            <Image src="/brand/mohammad-rostami.png" alt="محمد رستمی" width={320} height={320} />
            <span className="hx-teacher-badge">
              <b>رتبهٔ ۳۲</b>
              دکتری ۱۴۰۱، خودم
            </span>
          </div>
          <div className="hx-teacher-copy">
            <p className="h-kicker">مدرس</p>
            <h2>محمد رستمی؛ آنچه درس می‌دهم را سر جلسه امتحان کرده‌ام</h2>
            <p>
              کارشناس ارشد نرم‌افزار، گرایش الگوریتم و محاسبات، از دانشگاه صنعتی شریف و چند ترم دستیار آموزشی همان‌جا.
              در کلاس اول ایده را باز می‌کنم که چرا یک روش جواب می‌دهد، بعد سراغ تست می‌رویم.
            </p>
            <ul className="hx-teacher-facts">
              {ownerResults.map((row) => (
                <li key={row.id}>
                  <b>{row.metric}</b>
                  <span>{row.subject} · {row.year}</span>
                </li>
              ))}
              <li>
                <b>سؤال ۶۱</b>
                <span>کنکور ۱۴۰۱، کنار سؤال تألیفی من</span>
              </li>
            </ul>
            <div className="hx-cta">
              <Link href="/about" className="hx-btn hx-btn-dark">دربارهٔ من</Link>
              <Link href="/consultations" className="hx-btn hx-btn-outline">مشاوره با من</Link>
            </div>
          </div>
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
              {freeVideos.slice(0, 6).map((video) => (
                <FreeVideoCard video={video} key={video.slug} />
              ))}
            </div>
          </div>
        </section>
      )}

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
      {/* --------------------------------------------------------- final cta */}
      <section className="hx-final">
        <div className="h-wrap hx-final-grid">
          <div>
            <p className="hx-kicker">وقت، مهم‌ترین منبع توست</p>
            <h2>از امروز شروع کن، نه از فردا</h2>
            <p>یک جلسهٔ رایگان ببین، یک آزمون بزن، یا برنامهٔ امروزت را بگیر.</p>
            <div className="hx-cta">
              <Link href="/free-videos" className="hx-btn hx-btn-primary">شروع رایگان</Link>
              <Link href="/today" className="hx-btn hx-btn-ghost">برنامهٔ امروز</Link>
            </div>
          </div>
          <div className="hx-countdowns">
            <div>
              <b>{toPersianDigits(masterDays)}</b>
              <span>روز تا {EXAM_DATES.master1406.label}</span>
              <small>{EXAM_DATES.master1406.dateLabel}</small>
            </div>
            <div>
              <b>{toPersianDigits(phdDays)}</b>
              <span>روز تا {EXAM_DATES.phd1406.label}</span>
              <small>{EXAM_DATES.phd1406.dateLabel}</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
