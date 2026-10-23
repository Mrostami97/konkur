import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { StructuredData } from "../../components/StructuredData";
import { EvidenceScorecard } from "../../components/EvidenceScorecard";
import { Glyph } from "../../components/SubjectIcon";
import { VideoPlayer } from "../../components/video/VideoPlayer";
import { alignmentEvidence, evidenceStats, matchedQuestions, questionDesignEvidence, studentResults, studentVideo, type EvidenceDocument } from "../../content/evidence";
import { toEnglishDigits, toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import "./evidence.css";

export const metadata: Metadata = pageMetadata({
  title: "نتیجهٔ شاگردها و تطبیق کلاس با کنکور، با سند",
  description:
    "سؤالی که محمد رستمی تألیف کرد و در کنکور ۱۴۰۱ آمد، ۹ تست از ۱۲ تست ساختمان داده و الگوریتم ۱۴۰۵ که در کلاس کار شده بود و نتیجهٔ شاگردها؛ هرکدام با تصویر سند اصلی.",
  path: "/evidence",
});

const thesisUrl =
  "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";

// Within a year: a subject percent first, then the full scorecards, then what
// the class did -- so each kind of card sits together instead of alternating.
const CATEGORY_ORDER: EvidenceDocument["category"][] = ["نتایج دانشجویان", "کارنامه", "طراحی سؤال", "تطبیق سؤال", "آموزش"];

const yearNumber = (year: string) => Number(toEnglishDigits(year)) || 0;

const timeline = [questionDesignEvidence, alignmentEvidence, ...studentResults, ...matchedQuestions]
  .reduce<{ year: string; items: EvidenceDocument[] }[]>((groups, item) => {
    const group = groups.find((row) => row.year === item.year);
    if (group) group.items.push(item);
    else groups.push({ year: item.year, items: [item] });
    return groups;
  }, [])
  // Newest konkur first; posts with no known year close the timeline.
  .sort((a, b) => yearNumber(b.year) - yearNumber(a.year))
  .map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)),
  }));

const videoYear = "۱۴۰۳";

function summaryOf(items: EvidenceDocument[]) {
  const results = items.filter((item) => item.student || item.category === "کارنامه").length;
  const classwork = items.length - results;
  return [
    results > 0 ? `${toPersianDigits(results)} نتیجهٔ شاگرد` : null,
    classwork > 0 ? `${toPersianDigits(classwork)} سند از کلاس` : null,
  ].filter(Boolean).join(" · ");
}

const headline = studentResults.filter((item) => item.student && item.hero && item.category === "کارنامه");
const orderedDocuments = timeline.flatMap((group) => group.items);

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "نتیجهٔ شاگردها و تطبیق کلاس با کنکور",
  url: absoluteUrl("/evidence"),
  inLanguage: "fa-IR",
  // The Person is described in full on /about; referencing its @id keeps one identity.
  about: { "@id": absoluteUrl("/about#mohammad-rostami") },
  mainEntity: {
    "@type": "ItemList",
    name: "مستندات کلاس‌های محمد رستمی",
    description: "نتیجهٔ شاگردها و سؤال‌هایی از کنکور که سر کلاس کار شده بود، هرکدام کنار تصویر سند اصلی‌اش.",
    numberOfItems: orderedDocuments.length,
    itemListElement: orderedDocuments.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(`/evidence#${item.id}`),
    })),
  },
};

export default function EvidencePage() {
  return (
    <main className="page-container ev-page">
      <StructuredData data={jsonLd} />

      <section className="ev-hero" aria-labelledby="evidence-title">
        <div className="ev-hero-copy">
          <span className="ev-eyebrow"><Glyph name="shield" />سند، نه ادعا</span>
          <h1 id="evidence-title">هر عددی که از کلاس‌هایم می‌گویم، اینجا کنار سندش است</h1>
          <p>
            نتیجهٔ شاگردها، سؤال‌هایی از کنکور که پیش‌تر در کلاس کار شده بود، و سؤالی که تألیف کرده بودم و در کنکور ۱۴۰۱
            آمد؛ از تازه‌ترین سال به قدیمی‌تر. هر کارت، سند اصلی‌اش را همراه دارد. خودت ببین و قضاوت کن.
          </p>
        </div>
        {headline.length > 0 && (
          <ul className="ev-wall" aria-label="چند نتیجهٔ شاگردها">
            {headline.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>
                  <b>{item.hero!.value}</b>
                  <span>{item.hero!.label}</span>
                  <small>{item.student} · {item.year}</small>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ev-stats" aria-label="خلاصهٔ مستندات">
        {evidenceStats.map((stat) => (
          <div className={`ev-stat ev-stat-${stat.tone}`} key={stat.label}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
            <small>{stat.detail}</small>
          </div>
        ))}
      </section>

      <aside className="ev-honesty" aria-label="پیش از خواندن">
        <Glyph name="flag" />
        <div>
          <strong>پیش از اینکه به این عددها تکیه کنی</strong>
          <p>
            همهٔ این موارد از آرشیو خودم در تلگرام آمده‌اند و هیچ نهاد مستقلی تأییدشان نکرده؛ من هم از آن‌ها برای معرفی
            کلاس‌هایم استفاده می‌کنم، پس حق داری با تردید نگاهشان کنی. هر مورد یک نمونه است، از یک درس و یک سال، و قول
            نمی‌دهد نتیجهٔ تو هم همین شود. سند اصلی کنار هر کارت هست.
          </p>
        </div>
      </aside>

      <nav className="ev-years" aria-label="پرش به سال">
        {timeline.map((group) => (
          <a href={`#year-${group.year === "—" ? "undated" : toEnglishDigits(group.year)}`} key={group.year}>
            <b>{group.year === "—" ? "بدون سال" : group.year}</b>
            <span>{toPersianDigits(group.items.length)} سند</span>
          </a>
        ))}
      </nav>

      <div className="ev-timeline">
        {timeline.map((group) => {
          const anchor = group.year === "—" ? "undated" : toEnglishDigits(group.year);
          return (
            <section className="ev-year" id={`year-${anchor}`} aria-labelledby={`year-${anchor}-title`} key={group.year}>
              <header className="ev-year-head">
                <span className="ev-year-num" aria-hidden="true">{group.year === "—" ? "؟" : group.year}</span>
                <div>
                  <h2 id={`year-${anchor}-title`}>{group.year === "—" ? "بدون سال مشخص" : `کنکور ${group.year}`}</h2>
                  <p>{summaryOf(group.items)}</p>
                </div>
              </header>

              <div className="ev-grid">
                {group.items.map((item) => <EvidenceScorecard item={item} key={item.id} />)}
              </div>

              {group.year === videoYear && (
                <section className="ev-video" aria-labelledby="student-video">
                  <div>
                    <span className="ev-eyebrow"><Glyph name="play" />ویدئو · {studentVideo.duration}</span>
                    <h3 id="student-video">{studentVideo.title}</h3>
                    <p>{studentVideo.description}</p>
                  </div>
                  <VideoPlayer src={studentVideo.src} title={studentVideo.title} />
                </section>
              )}
            </section>
          );
        })}
      </div>

      <section className="surface-card evidence-author">
        <Image src="/brand/mohammad-rostami.png" alt="محمد رستمی" width={72} height={72} style={{ objectFit: "cover" }} />
        <div>
          <strong>محمد رستمی</strong>
          <p>
            کارشناس ارشد نرم‌افزار، گرایش الگوریتم و محاسبات، از دانشگاه صنعتی شریف و چند ترم دستیار آموزشی همان‌جا.{" "}
            <a className="text-link" href={thesisUrl} target="_blank" rel="noreferrer">پایان‌نامه در کتابخانهٔ شریف ↗</a>
          </p>
        </div>
        <Link className="text-link" href="/about">بیشتر دربارهٔ من ←</Link>
      </section>

      <section className="about-cta">
        <div>
          <span className="eyebrow eyebrow-dark">قدم بعدی</span>
          <h2>به‌جای عددها، خود کلاس را امتحان کن</h2>
          <p>ویدیوهای رایگان هر درس را ببین، یا اگر نمی‌دانی از کجا شروع کنی، یک جلسهٔ مشاوره بگذار.</p>
        </div>
        <div className="evidence-cta-actions">
          <Link className="button button-light" href="/free-videos">ویدیوهای رایگان</Link>
          <Link className="button evidence-cta-secondary" href="/consultations">مشاوره با من</Link>
        </div>
      </section>
    </main>
  );
}
