import type { Metadata } from "next";
import Link from "next/link";
import { contentTypeLabel, publicArticlePath, type PublicArticleRecord } from "../components/PublicContent";
import { StructuredData } from "../components/StructuredData";
import { evidenceStats, studentResults } from "../content/evidence";
import { findPhase12EditorialPage } from "../content/phase12";
import { apiGetPublic } from "../lib/api";
import { toPersianDigits } from "../lib/format";
import { absoluteUrl, pageMetadata, SITE_NAME } from "../lib/seo";
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
const STEPS = [
  {
    title: "مسیرت را بشناس",
    body: "رشته، درس‌ها، ضرایب و تقویم رسمی ۱۴۰۶ را ببین تا بدانی دقیقاً برای چه می‌خوانی.",
    href: "/guides",
    link: "راهنمای رسمی ۱۴۰۶",
  },
  {
    title: "درس‌به‌درس یاد بگیر",
    body: "از نقشهٔ درس‌ها شروع کن؛ برای هر درس ویدیوی رایگان و دورهٔ کامل کنکوری هست.",
    href: "/subjects",
    link: "نقشهٔ درس‌ها",
  },
  {
    title: "خودت را بسنج",
    body: "با تست‌های کنکور و آزمون زمان‌دار تمرین کن، بعد با درصدهایت رتبه‌ات را تخمین بزن.",
    href: "/questions",
    link: "بانک سؤال",
  },
] as const;

const QUICK_LINKS = [
  { href: "/guides/start-from-zero", label: "شروع از صفر" },
  { href: "/free-videos", label: "ویدیوی رایگان هر درس" },
  { href: "/rank-estimate", label: "تخمین رتبه" },
] as const;

/** Official 1406 guides shown until enough published articles exist; a
 * published article always comes first. */
const ESSENTIAL_GUIDES = ["start-from-zero", "registration-calendar-1406", "master-exam-changes-1406"];

const toLatin = (value: string) => value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/** Two named results with different ranks, best first, and the class figure. */
const proof = (() => {
  const ranked = studentResults
    .filter((row) => row.student && row.hero && row.category === "کارنامه")
    .sort((a, b) => Number(toLatin(a.hero!.value)) - Number(toLatin(b.hero!.value)));
  const distinct = ranked.filter((row, index) => ranked.findIndex((other) => other.hero!.value === row.hero!.value) === index);
  const figures = distinct.slice(0, 2).map((row) => ({ value: `رتبهٔ ${row.hero!.value}`, label: `${row.hero!.label} · ${row.student}` }));
  const alignment = evidenceStats.find((stat) => stat.value.includes("از ۱۲"));
  if (alignment) figures.push({ value: alignment.value, label: alignment.label });
  return figures;
})();

interface Reading {
  href: string;
  kind: string;
  title: string;
  summary: string;
}

export default async function HomePage() {
  const published = await safe<PublicArticleRecord[]>("/articles");

  const fromPublished: Reading[] = (published ?? []).map((article) => ({
    href: publicArticlePath(article),
    kind: contentTypeLabel(article.contentType),
    title: article.title,
    summary: article.summary,
  }));
  const fromGuides: Reading[] = ESSENTIAL_GUIDES.flatMap((slug) => {
    const page = findPhase12EditorialPage(slug);
    return page ? [{ href: `/guides/${slug}`, kind: page.category, title: page.title, summary: page.description }] : [];
  });
  const seen = new Set<string>();
  const reading = [...fromPublished, ...fromGuides].filter((row) => !seen.has(row.href) && seen.add(row.href)).slice(0, 3);

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

      {/* One message and one action: what the site is for, and a search box. */}
      <section className="hc-hero">
        <div className="h-wrap hc-hero-inner">
          <p className="hc-eyebrow">ارشد و دکتری مهندسی کامپیوتر، IT و علوم کامپیوتر</p>
          <h1>
            کنکور کامپیوتر را
            <br />
            از همین‌جا شروع کن
          </h1>
          <p className="hc-lede">راهنمای رسمی ۱۴۰۶، ویدیوی رایگان هر درس، تست و آزمون، و تخمین رتبه؛ همه در یک جا.</p>

          <form className="hc-search" action="/search" method="get" role="search">
            <label htmlFor="hc-q" className="sr-only">جست‌وجو در درس‌ها، راهنماها و مقاله‌ها</label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input id="hc-q" name="q" type="search" placeholder="چه می‌خواهی یاد بگیری؟ مثلاً «درخت AVL»" />
            <button type="submit">جست‌وجو</button>
          </form>

          <p className="hc-quick">
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </p>
        </div>
      </section>

      {/* The path in three steps, one link each. */}
      <section className="hc-sec" aria-labelledby="hc-steps-title">
        <div className="h-wrap">
          <header className="hc-head">
            <p className="hc-eyebrow">مسیر کنکور</p>
            <h2 id="hc-steps-title">سه قدم تا روز آزمون</h2>
          </header>
          <ol className="hc-steps">
            {STEPS.map((step, index) => (
              <li className="hc-step" key={step.title}>
                <span className="hc-step-n" aria-hidden="true">{toPersianDigits(`0${index + 1}`)}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <Link href={step.href} className="hc-step-link">{step.link} ←</Link>
              </li>
            ))}
          </ol>
          <div className="hc-center">
            <Link href="/guides/start-from-zero" className="hc-btn">از صفر شروع کن</Link>
          </div>
        </div>
      </section>

      {/* Practical reading; published articles appear here first. */}
      {reading.length > 0 && (
        <section className="hc-sec hc-sec-paper" aria-labelledby="hc-reading-title">
          <div className="h-wrap">
            <header className="hc-head">
              <p className="hc-eyebrow">مطالب کاربردی</p>
              <h2 id="hc-reading-title">برای همین امروز</h2>
            </header>
            <div className="hc-reading">
              {reading.map((item) => (
                <Link href={item.href} className="hc-read" key={item.href}>
                  <span>{item.kind}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </Link>
              ))}
            </div>
            <div className="hc-center">
              <Link href="/guides" className="h-link">همهٔ راهنماها ←</Link>
            </div>
          </div>
        </section>
      )}

      {/* The proof, reduced to three figures and a link to the sources. */}
      <section className="hc-sec" aria-labelledby="hc-proof-title">
        <div className="h-wrap">
          <header className="hc-head">
            <p className="hc-eyebrow">نتایج، با سند</p>
            <h2 id="hc-proof-title">کلاسی که نتیجه‌اش را نشان می‌دهد</h2>
          </header>
          <dl className="hc-figures">
            {proof.map((figure) => (
              <div key={figure.value}>
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
              </div>
            ))}
          </dl>
          <div className="hc-center">
            <Link href="/evidence" className="h-link">دیدن سند هر عدد ←</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
