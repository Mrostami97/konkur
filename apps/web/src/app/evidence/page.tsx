import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, SectionHeader, StatCard } from "../../components/ui";
import { StructuredData } from "../../components/StructuredData";
import { EvidenceFigures } from "../../components/EvidenceFigures";
import { alignmentEvidence, archiveLinks, evidenceStats, matchedQuestions, questionDesignEvidence, studentResults, studentVideo, type EvidenceDocument } from "../../content/evidence";
import { absoluteUrl, pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "نتیجهٔ شاگردها و تطبیق کلاس با کنکور، با سند",
  description:
    "سؤالی که محمد رستمی تألیف کرد و در کنکور ۱۴۰۱ آمد، ۹ تست از ۱۲ تست ساختمان داده و الگوریتم ۱۴۰۵ که در کلاس کار شده بود و نتیجهٔ شاگردها؛ هرکدام با لینک پست اصلی.",
  path: "/evidence",
});

const thesisUrl =
  "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";

const allDocuments = [questionDesignEvidence, alignmentEvidence, ...matchedQuestions, ...studentResults, ...archiveLinks];

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
    description: "ادعاهای خوداظهاری از آرشیو مدرس، هرکدام با لینک پست اصلی؛ مستقلاً راستی‌آزمایی نشده‌اند.",
    numberOfItems: allDocuments.length,
    itemListElement: allDocuments.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: item.telegramUrl,
    })),
  },
};

function ResultCard({ item }: { item: EvidenceDocument }) {
  return (
    <article className="surface-card evidence-card">
      <div className="article-card-top">
        <span className="article-meta">{item.subject}</span>
        {item.year !== "—" && <span>کنکور {item.year}</span>}
      </div>
      <strong className="evidence-metric">{item.metric}</strong>
      {item.student && <span className="evidence-student">{item.student}</span>}
      <h3>{item.title}</h3>
      <EvidenceFigures images={item.images} />
      <p>{item.description}</p>
      <div className="evidence-links evidence-source">
        {item.telegramUrl && (
          <a className="text-link" href={item.telegramUrl} target="_blank" rel="noopener noreferrer">پست اصلی در تلگرام ↗</a>
        )}
        {item.related && (
          <a className="text-link" href={item.related.url} target="_blank" rel="noopener noreferrer">{item.related.label} ↗</a>
        )}
      </div>
    </article>
  );
}

export default function EvidencePage() {
  return (
    <main className="page-container trust-page about-page">
      <StructuredData data={jsonLd} />
      <PageHeader
        eyebrow="سند، نه ادعا"
        title="هر عددی که از کلاس‌هایم می‌گویم، اینجا کنار سندش است"
        description="نتیجهٔ شاگردها، سؤال‌هایی از کنکور که پیش‌تر در کلاس کار شده بود، و سؤالی که تألیف کرده بودم و در کنکور ۱۴۰۱ آمد. هر مورد به پست اصلی‌اش لینک دارد؛ خودت ببین و قضاوت کن."
      />

      <section aria-label="خلاصهٔ مستندات" className="evidence-stats">
        {evidenceStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} tone={stat.tone} />
        ))}
      </section>

      <aside className="official-disclaimer evidence-honesty" aria-label="پیش از خواندن">
        <strong>پیش از اینکه به این عددها تکیه کنی</strong>
        <p>
          همهٔ این موارد از آرشیو خودم در تلگرام آمده‌اند و هیچ نهاد مستقلی تأییدشان نکرده؛ من هم از آن‌ها برای معرفی
          کلاس‌هایم استفاده می‌کنم، پس حق داری با تردید نگاهشان کنی. هر مورد یک نمونه است، از یک درس و یک سال، و قول
          نمی‌دهد نتیجهٔ تو هم همین شود. سند اصلی کنار هر کارت هست.
        </p>
      </aside>

      <div className="trust-layout about-grid evidence-feature">
        <section className="surface-card about-card about-card-dark">
          <span className="eyebrow eyebrow-dark">طراحی سؤال · {questionDesignEvidence.subject}</span>
          <h2>{questionDesignEvidence.title}</h2>
          <p>{questionDesignEvidence.description}</p>
          <EvidenceFigures images={questionDesignEvidence.images} />
          <a className="button button-light" href={questionDesignEvidence.telegramUrl} target="_blank" rel="noopener noreferrer">
            دیدن پست اصلی ↗
          </a>
        </section>

        <section className="surface-card about-card">
          <span className="eyebrow">تطبیق کلاس با کنکور {alignmentEvidence.year}</span>
          <h2>{alignmentEvidence.title}</h2>
          <p>{alignmentEvidence.description}</p>
          {alignmentEvidence.topics && (
            <div className="subject-tags" aria-label="مبحث‌هایی که هم در کلاس بود و هم در کنکور">
              {alignmentEvidence.topics.map((topic) => <span key={topic}>{topic}</span>)}
            </div>
          )}
          <div className="evidence-links">
            <a className="text-link" href={alignmentEvidence.telegramUrl} target="_blank" rel="noopener noreferrer">فایل تطبیق ↗</a>
            {alignmentEvidence.related && (
              <a className="text-link" href={alignmentEvidence.related.url} target="_blank" rel="noopener noreferrer">{alignmentEvidence.related.label} ↗</a>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="matched-questions">
        <SectionHeader
          title="سخت‌ترین سؤال‌ها، قبلاً سر کلاس"
          description="چند سؤال کنکور که پیش از آزمون، خودش یا عینش در کلاس حل شده بود."
        />
        <div className="content-grid-wide" id="matched-questions">
          {matchedQuestions.map((item) => <ResultCard item={item} key={item.id} />)}
        </div>
      </section>

      <section aria-labelledby="student-results">
        <SectionHeader
          title="نتیجهٔ شاگردها"
          description="درصد و تعداد پاسخ درست شاگردها، همان‌طور که در آرشیو ثبت شده."
        />
        <div className="content-grid-wide evidence-results" id="student-results">
          {studentResults.map((item) => <ResultCard item={item} key={item.id} />)}
        </div>
      </section>

      <section className="surface-card evidence-video" aria-labelledby="student-video">
        <div>
          <span className="eyebrow">ویدئو · {studentVideo.duration}</span>
          <h2 id="student-video">{studentVideo.title}</h2>
          <p>{studentVideo.description}</p>
          <a className="text-link" href={studentVideo.telegramUrl} target="_blank" rel="noopener noreferrer">پست اصلی در تلگرام ↗</a>
        </div>
        <video controls preload="metadata" playsInline src={studentVideo.src}>
          مرورگرت پخش ویدئو را پشتیبانی نمی‌کند؛ <a href={studentVideo.src}>فایل ویدئو را دانلود کن</a>.
        </video>
      </section>

      <section aria-labelledby="archive-links">
        <SectionHeader
          title="بیشتر در آرشیو"
          description="فایل کامل تطبیق، سال‌های قبل، کلیدهای بعد از کنکور و یک جلسه از کلاس."
        />
        <div className="resource-grid" id="archive-links">
          {archiveLinks.map((item) => (
            <a className="resource-card" href={item.telegramUrl} target="_blank" rel="noopener noreferrer" key={item.id}>
              <span aria-hidden="true">↗</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <strong>{item.metric}{item.year !== "—" ? ` · ${item.year}` : ""}</strong>
            </a>
          ))}
        </div>
      </section>

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
          <p>چند جلسه از دوره رایگان روی سایت است. اگر هم نمی‌دانی از کجا شروع کنی، یک جلسهٔ مشاوره بگذار.</p>
        </div>
        <div className="evidence-cta-actions">
          <Link className="button button-light" href="/courses">جلسه‌های رایگان</Link>
          <Link className="button evidence-cta-secondary" href="/consultations">مشاوره با من</Link>
        </div>
      </section>
    </main>
  );
}
