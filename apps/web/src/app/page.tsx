import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CourseCard } from "../components/CourseCard";
import { contentTypeLabel, formatPublicDate, publicArticlePath, type PublicArticleRecord } from "../components/PublicContent";
import { StructuredData } from "../components/StructuredData";
import { Glyph, type GlyphName } from "../components/SubjectIcon";
import { evidenceStats, studentResults } from "../content/evidence";
import { guides, subjects } from "../content/editorial";
import { findPhase12EditorialPage, phase12EditorialPages } from "../content/phase12";
import { apiGetPublic } from "../lib/api";
import { canonicalHref, withoutMergedGuides } from "../lib/merged-pages";
import { toPersianDigits } from "../lib/format";
import { absoluteUrl, pageMetadata, SITE_NAME } from "../lib/seo";
import { buildCourseCatalog, courseFormat, type CatalogCourse, type CatalogProduct } from "./courses/catalog";
import { HeroSearch, type HeroEntry } from "./HeroSearch";
import { SHELVES, shelvesOf } from "./articles/shelves";
import { HomeHeroArt } from "./HomeHeroArt";
import "./home.css";

export const metadata: Metadata = pageMetadata({
  title: "کنکور ارشد و دکتری کامپیوتر ۱۴۰۶؛ کلاس، نتایج شاگردان و ویدیوی رایگان",
  description:
    "کلاس‌های کنکور ارشد مهندسی کامپیوتر، IT و علوم کامپیوتر با نتایج واقعی شاگردان، ویدیوی رایگان برای هر درس، راهنمای رسمی ۱۴۰۶، تخمین رتبه و انتخاب رشته.",
  path: "/",
});

async function safe<T>(path: string): Promise<T | null> {
  try {
    return await apiGetPublic<T>(path);
  } catch {
    return null;
  }
}

/** The whole path, in the order a candidate walks it. */
const STEPS: { title: string; body: string; href: string; link: string; icon: GlyphName }[] = [
  {
    title: "مسیرت را بشناس",
    body: "رشته، درس‌ها، ضرایب و تقویم رسمی ۱۴۰۶ را ببین تا بدانی دقیقاً برای چه می‌خوانی.",
    href: "/guides",
    link: "راهنمای رسمی ۱۴۰۶",
    icon: "compass",
  },
  {
    title: "درس‌به‌درس یاد بگیر",
    body: "از نقشهٔ درس‌ها شروع کن؛ برای هر درس ویدیوی رایگان و دورهٔ کامل کنکوری هست.",
    href: "/subjects",
    link: "نقشهٔ درس‌ها",
    icon: "book",
  },
  {
    title: "خودت را بسنج",
    body: "با تست‌های کنکور و آزمون زمان‌دار تمرین کن، بعد با درصدهایت رتبه‌ات را تخمین بزن.",
    href: "/questions",
    link: "بانک سؤال",
    icon: "target",
  },
];

/** Tools and entry points every visitor should know about. */
const TOOLS: HeroEntry[] = [
  { title: "شروع کنکور کامپیوتر از صفر", href: "/articles/study-plan-from-zero", kind: "شروع" },
  { title: "بانک سؤال کنکور با پاسخ تشریحی", href: "/questions", kind: "ابزار" },
  { title: "ویدیوی رایگان هر درس", href: "/free-videos", kind: "ویدیو" },
  { title: "تخمین رتبه با درصدهایت", href: "/rank-calculator/master-computer-engineering", kind: "ابزار" },
  { title: "نتیجهٔ شاگردها، کنار سندش", href: "/evidence", kind: "نتایج" },
];

/** What the search box suggests trying while it is empty. */
const SEARCH_EXAMPLES = ["درخت AVL", "ضرایب ۱۴۰۶", "الگوریتم دایکسترا", "برنامهٔ شش‌ماهه", "نظریه زبان‌ها", "تخمین رتبه"];

/** Official 1406 guides shown until enough published articles exist; a
 * published article always comes first. */
const ESSENTIAL_GUIDES = ["start-from-zero", "registration-calendar-1406", "master-exam-changes-1406"];

const toLatin = (value: string) => value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/**
 * The latest master's results (every named 1405 master's scorecard), then the
 * two best ranks of earlier years, then the class figure. Each rank carries
 * its year and student, as on the evidence page.
 */
const proof = (() => {
  const named = studentResults.filter((row) => row.student && row.hero && row.category === "کارنامه");
  const latest = named.filter((row) => row.year === "۱۴۰۵" && row.hero!.label.includes("ارشد"));
  const earlier = named
    .filter((row) => !latest.includes(row))
    .sort((a, b) => Number(toLatin(a.hero!.value)) - Number(toLatin(b.hero!.value)));
  const best = earlier.filter((row, index) => earlier.findIndex((other) => other.hero!.value === row.hero!.value) === index).slice(0, 2);
  const figures = [...latest, ...best].map((row) => ({
    value: `رتبهٔ ${row.hero!.value}`,
    // The figure already says «رتبهٔ», so the label starts at what the rank is in.
    label: `کنکور ${row.year} · ${row.hero!.label.replace(/^رتبهٔ\s*/, "")} · ${row.student}`,
  }));
  const alignment = evidenceStats.find((stat) => stat.value.includes("از ۱۲"));
  if (alignment) figures.push({ value: alignment.value, label: alignment.label });
  return figures;
})();

interface Reading {
  href: string;
  kind: string;
  title: string;
  summary: string;
  date: string | null;
}

export default async function HomePage() {
  const [published, courses, products] = await Promise.all([
    safe<PublicArticleRecord[]>("/articles"),
    safe<CatalogCourse[]>("/courses"),
    safe<CatalogProduct[]>("/products"),
  ]);

  const fromPublished: Reading[] = (published ?? [])
    .filter((article) => article.contentType !== "GUIDE")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((article) => ({
      href: publicArticlePath(article),
      kind: SHELVES.find((shelf) => shelf.key === shelvesOf(article.taxonomyTags, article.subjectCodes)[0])?.label ?? contentTypeLabel(article.contentType),
      title: article.title,
      summary: article.summary,
      date: article.publishedAt ? formatPublicDate(article.publishedAt) : null,
    }));
  const fromGuides: Reading[] = ESSENTIAL_GUIDES.flatMap((slug) => {
    const page = findPhase12EditorialPage(slug);
    return page ? [{ href: canonicalHref(`/guides/${slug}`), kind: page.category, title: page.title, summary: page.description, date: null }] : [];
  });
  const seen = new Set<string>();
  const reading = [...fromPublished, ...fromGuides].filter((row) => !seen.has(row.href) && seen.add(row.href)).slice(0, 3);

  // Lesson courses first: they are where a newcomer starts.
  const catalog = courses
    ? buildCourseCatalog(courses, products ?? [], products === null).sort(
        (a, b) => Number(courseFormat(a.course) === "حل تست") - Number(courseFormat(b.course) === "حل تست"),
      )
    : [];

  // The search box answers from these pages as the student types.
  const guideList = withoutMergedGuides([...phase12EditorialPages, ...guides]);
  const guideEntries: HeroEntry[] = guideList.map((page) => ({
    title: page.title,
    href: `/guides/${page.slug}`,
    kind: "راهنما",
  }));
  const articleEntries: HeroEntry[] = fromPublished.map((row) => ({ title: row.title, href: row.href, kind: row.kind }));
  const subjectEntries: HeroEntry[] = subjects.map((subject) => ({ title: subject.title, href: `/subjects/${subject.slug}`, kind: "درس" }));
  const unique = (list: HeroEntry[]) => {
    const hrefs = new Set<string>();
    return list.filter((entry) => !hrefs.has(entry.href) && hrefs.add(entry.href));
  };
  const searchEntries = unique([...TOOLS, ...articleEntries, ...guideEntries, ...subjectEntries]);

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

      {/* What the site is for, a search box, and the two ways in. */}
      <section className="hx-hero">
        <div className="h-wrap hx-hero-inner">
          <div className="hx-hero-text">
            <p className="hx-pill">
              <span className="hx-pill-dot" aria-hidden="true" />
              ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر
            </p>
            <h1>
              کنکور کامپیوتر را
              <br />
              <span className="hx-h1-accent">از همین‌جا</span> شروع کن
            </h1>
            <p className="hx-lede">راهنمای رسمی ۱۴۰۶، ویدیوی رایگان هر درس، دوره‌های کامل، تست و آزمون، و تخمین رتبه؛ همه در یک جا.</p>
            <div className="hx-actions">
              <Link href={catalog.length > 0 ? "/courses" : "/subjects"} className="hx-btn hx-btn-primary">
                {catalog.length > 0 ? "دیدن دوره‌ها" : "نقشهٔ درس‌ها"}
              </Link>
              <Link href="/articles/study-plan-from-zero" className="hx-btn hx-btn-ghost">از صفر شروع کن</Link>
            </div>
            <HeroSearch entries={searchEntries} examples={SEARCH_EXAMPLES} rows={[]} />
          </div>
          <HomeHeroArt />
        </div>
      </section>

      {/* The courses: the product, right after the promise. */}
      {catalog.length > 0 && (
        <section className="hc-sec" aria-labelledby="hc-courses-title">
          <div className="h-wrap">
            <header className="hx-head">
              <div>
                <p className="hc-eyebrow">دوره‌ها</p>
                <h2 id="hc-courses-title">دوره‌های کامل، از پایه تا تست</h2>
                <p>درس‌نامه مفهوم را از پایه می‌سازد و حل تست همان را روی سؤال‌های کنکور محک می‌زند.</p>
              </div>
              <Link href="/courses" className="h-link">همهٔ دوره‌ها ←</Link>
            </header>
            <div className="hx-courses">
              {catalog.slice(0, 4).map((item) => (
                <CourseCard item={item} key={item.course.slug} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The path in three steps, one link each. */}
      <section className="hc-sec hc-sec-paper" aria-labelledby="hc-steps-title">
        <div className="h-wrap">
          <header className="hc-head">
            <p className="hc-eyebrow">مسیر کنکور</p>
            <h2 id="hc-steps-title">سه قدم تا روز آزمون</h2>
          </header>
          <ol className="hx-steps">
            {STEPS.map((step, index) => (
              <li className="hx-step" key={step.title}>
                <span className="hx-step-top">
                  <span className="hx-step-icon"><Glyph name={step.icon} /></span>
                  <span className="hx-step-n" aria-hidden="true">{toPersianDigits(`0${index + 1}`)}</span>
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <Link href={step.href} className="hc-step-link">{step.link} ←</Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who teaches, and the proof, each figure linked to its source. */}
      <section className="hx-teacher" aria-labelledby="hc-proof-title">
        <div className="h-wrap hx-teacher-inner">
          <div className="hx-teacher-who">
            <div className="hx-teacher-photo">
              <Image src="/brand/mohammad-rostami.png" alt="محمد رستمی" width={160} height={160} />
            </div>
            <p className="hc-eyebrow hx-on-ink">مدرس و نویسندهٔ محتوا</p>
            <h2 id="hc-proof-title">کلاسی که نتیجه‌اش را نشان می‌دهد</h2>
            <p className="hx-teacher-bio">
              <strong>محمد رستمی</strong>؛ کارشناس ارشد نرم‌افزار، گرایش الگوریتم و محاسبات، از دانشگاه صنعتی شریف و چند ترم دستیار آموزشی همان‌جا.
              هر عددی که این‌جا می‌بینی، سندش کنارش منتشر شده است.
            </p>
            <div className="hx-actions">
              <Link href="/evidence" className="hx-btn hx-btn-light">دیدن سند هر عدد</Link>
              <Link href="/about" className="hx-btn hx-btn-ghost-light">دربارهٔ مدرس</Link>
            </div>
          </div>
          <dl className="hx-figures">
            {proof.map((figure) => (
              <div key={figure.value}>
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Practical reading; the newest published articles first. */}
      {reading.length > 0 && (
        <section className="hc-sec" aria-labelledby="hc-reading-title">
          <div className="h-wrap">
            <header className="hx-head">
              <div>
                <p className="hc-eyebrow">تازه‌ترین مطالب</p>
                <h2 id="hc-reading-title">برای همین امروز</h2>
              </div>
              <Link href="/articles" className="h-link">همهٔ مقاله‌ها ←</Link>
            </header>
            <div className="hx-reading">
              {reading.map((item) => (
                <Link href={item.href} className="hx-read" key={item.href}>
                  <span className="hx-read-kind">{item.kind}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  {item.date && <small>{item.date}</small>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  );
}
