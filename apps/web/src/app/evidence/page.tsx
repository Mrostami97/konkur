import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader, SectionHeader, StatCard } from "../../components/ui";
import { StructuredData } from "../../components/StructuredData";
import { alignmentEvidence, evidenceStats, learningEvidence, questionDesignEvidence, sourceDocuments, studentResults, type EvidenceDocument } from "../../content/evidence";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "نتایج دانشجویان، مستندات آموزشی و سابقه طراحی سؤال",
  description: "نمونه‌ای از نتایج ثبت‌شده دانشجویان، تحلیل سؤالات کنکور، تطبیق مطالب آموزشی با آزمون‌های واقعی و سوابق آموزشی محمد رستمی.",
  path: "/evidence",
});

const thesisUrl = "https://library.sharif.ir/parvan/resource/503037/%D9%85%D8%B3%D8%A7%DB%8C%D9%84-%D8%A8%D9%87%DB%8C%D9%86%D9%87%E2%80%8C%D8%B3%D8%A7%D8%B2%DB%8C-%D8%B4%D8%A8%DA%A9%D9%87-%D8%B1%D9%88%DB%8C-%D9%85%D9%86%D8%A7%D8%A8%D8%B9-%D8%A7%D9%81%D8%B1%D8%A7%D8%B2%D8%B4%D8%AF%D9%87/&from=search&&query=%D9%85%D8%AD%D9%85%D8%AF%20%D8%B1%D8%B3%D8%AA%D9%85%DB%8C&collectionPID=9&count=20&execute=true";

function EvidenceCard({ item }: { item: EvidenceDocument }) {
  return (
    <article className="surface-card">
      <div className="article-card-top"><span className="article-meta">{item.category}</span><span>{item.year}</span></div>
      <h3>{item.title}</h3>
      <p><strong>{item.subject}</strong></p>
      <p>{item.description}</p>
      <strong>{item.metric}</strong>
      <div className="article-card-footer"><span>ادعای ثبت‌شده در آرشیو</span><a className="text-link" href={item.telegramUrl} target="_blank" rel="noreferrer">مشاهده مستند اصلی ↗</a></div>
    </article>
  );
}

export default function EvidencePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "نتایج دانشجویان، مستندات آموزشی و سابقه طراحی سؤال",
    inLanguage: "fa-IR",
    about: {
      "@type": "Person",
      name: "محمد رستمی",
      subjectOf: { "@type": "CreativeWork", name: "پایان‌نامه در کتابخانهٔ دانشگاه صنعتی شریف", url: thesisUrl },
    },
    mainEntity: {
      "@type": "ItemList",
      name: "فهرست ادعاها و مستندات آموزشی kunkur01",
      description: "نمونه‌های خوداظهاری از نتایج، تطبیق سؤال و محتوای آموزشی همراه با پیوند سند اصلی و محدودیت راستی‌آزمایی.",
    },
  };

  return (
    <main className="page-container">
      <StructuredData data={jsonLd} />
      <PageHeader
        eyebrow="مستندات و نتایج"
        title="نتایج دانشجویان، مستندات آموزشی و سابقه طراحی سؤال"
        description="نمونه‌ای از نتایج ثبت‌شده دانشجویان، تحلیل سؤالات کنکور، تطبیق مطالب آموزشی با آزمون‌های واقعی و سوابق آموزشی. به جای ادعا، مستندات را ببینید."
      />

      <section className="content-grid" aria-label="معرفی مدرس و پایان‌نامه">
        <div className="surface-card">
          <span className="eyebrow">محمد رستمی</span>
          <h2>مسیر آموزشی بر پایهٔ حل مسئله و مستندات</h2>
          <p>این صفحه نمونه‌هایی از نتایج منتشرشده، تحلیل سؤال، محتوای آموزشی و سابقهٔ طراحی سؤال را کنار هم قرار می‌دهد. هر مورد به مستند اصلی خود لینک دارد و به‌عنوان تضمین نتیجهٔ مشابه برای همهٔ داوطلبان ارائه نمی‌شود.</p>
          <div className="subject-tags"><span>دانش‌آموختهٔ دانشگاه صنعتی شریف</span><span>الگوریتم و محاسبات</span><a href="https://t.me/konkurcom" target="_blank" rel="noreferrer">@konkurcom</a></div>
          <a className="button button-primary" href={thesisUrl} target="_blank" rel="noreferrer">مشاهدهٔ پایان‌نامه در کتابخانهٔ شریف ↗</a>
        </div>
        <div className="surface-card"><Image src="/brand/mohammad-rostami.png" alt="محمد رستمی" width={320} height={320} priority style={{ width: "100%", height: "auto", borderRadius: "16px" }} /></div>
      </section>

      <section aria-label="آمارهای شاخص">
        <SectionHeader title="آمارهای شاخص" description="نمونه‌هایی از نتایج ثبت‌شده در مستندات آموزشی." />
        <div className="stats-grid">{evidenceStats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
        <div className="official-disclaimer"><strong>یادآوری</strong><p>این موارد نمونه‌هایی از نتایج ثبت‌شده هستند و تضمین نتیجهٔ مشابه برای همهٔ داوطلبان نیستند.</p></div>
        <div className="official-disclaimer">
          <strong>شفافیت منبع و تعارض منافع</strong>
          <p>این نمونه‌ها از آرشیوی متعلق به مدرس و مالک kunkur01 آمده‌اند، تأیید مستقل محسوب نمی‌شوند و ممکن است در معرفی آموزش او به کار روند. برای داوری، سند اصلی و محدودیت اندازهٔ نمونه را بررسی کنید. نام اشخاص بدون ثبت رضایت صریح در سایت بازنشر نمی‌شود.</p>
        </div>
      </section>

      <section aria-label="نتایج شاخص دانشجویان">
        <SectionHeader title="نتایج شاخص دانشجویان" description="هر کارت از دادهٔ جداگانه ساخته شده و مستند اصلی آن در دسترس است." />
        <div className="content-grid-wide">{studentResults.map((item) => <EvidenceCard item={item} key={item.id} />)}</div>
      </section>

      <section aria-label="رتبه‌ها و مسیرهای موفقیت">
        <SectionHeader title="رتبه‌ها و مسیرهای موفقیت" description="نمونه‌های رتبه و کارنامه در مستندات منتشرشده." />
        <div className="content-grid-wide">
          <div className="surface-card"><span className="feature-icon">۱۷</span><h3>رتبهٔ ۱۷ نرم‌افزار</h3><p>ادعای درج‌شده در پست آرشیوی، در کنار نتیجهٔ ۱۶ پاسخ صحیح از ۱۹ تست دکتری؛ بدون راستی‌آزمایی مستقل.</p><a className="text-link" href="https://t.me/Konkur_answer/4753" target="_blank" rel="noreferrer">مشاهده مستند ↗</a></div>
          <div className="surface-card"><span className="feature-icon">۲۶</span><h3>رتبهٔ ۲۶ هوش</h3><p>ادعای درج‌شده در همان پست آرشیوی نتیجهٔ دکتری؛ بدون راستی‌آزمایی مستقل.</p><a className="text-link" href="https://t.me/Konkur_answer/4753" target="_blank" rel="noreferrer">مشاهده مستند ↗</a></div>
        </div>
      </section>

      <section aria-label="تطبیق آموزش با سؤالات واقعی کنکور">
        <SectionHeader title="تطبیق آموزش با سؤالات واقعی کنکور" description="هم‌پوشانی مطالب تدریس‌شده با یک نمونهٔ آزمون واقعی." />
        <div className="surface-card"><div className="article-card-top"><span className="article-meta">{alignmentEvidence.year} · {alignmentEvidence.subject}</span><span>{alignmentEvidence.metric}</span></div><h3>{alignmentEvidence.title}</h3><p>{alignmentEvidence.description}</p><div className="subject-tags"><span>Merge Sorted Lists</span><span>Quick Sort</span><span>Insertion Sort</span><span>Huffman</span><span>MST</span><span>روابط بازگشتی</span><span>Hash</span></div><a className="button button-secondary" href={alignmentEvidence.telegramUrl} target="_blank" rel="noreferrer">مشاهده مستند اصلی ↗</a></div>
      </section>

      <section aria-label="از تحلیل سؤال تا طراحی سؤال">
        <SectionHeader title="از تحلیل سؤال تا طراحی سؤال" description="سابقهٔ آموزشی برای شناخت سبک تحلیل و طراحی سؤال، نه تضمین پیش‌بینی کنکور." />
        <div className="surface-card"><div className="article-card-top"><span className="article-meta">{questionDesignEvidence.year} · {questionDesignEvidence.subject}</span><span>سابقه آموزشی</span></div><h3>{questionDesignEvidence.title}</h3><p>{questionDesignEvidence.metric}</p><p>{questionDesignEvidence.description}</p><a className="button button-secondary" href={questionDesignEvidence.telegramUrl} target="_blank" rel="noreferrer">مشاهده مستند اصلی ↗</a></div>
      </section>

      <section aria-label="نمونه آموزش‌ها و تحلیل‌ها">
        <SectionHeader title="نمونه آموزش‌ها و تحلیل‌ها" description="ویدئو، جزوه، حل تمرین و تحلیل سؤال از آرشیو مستند." />
        <div className="resource-grid">{learningEvidence.map((item) => <a className="resource-card" href={item.telegramUrl} target="_blank" rel="noreferrer" key={item.id}><span>↗</span><h2>{item.title}</h2><p>{item.description}</p><strong>{item.metric} · مشاهده در تلگرام</strong></a>)}</div>
      </section>

      <section aria-label="لینک مستندات اصلی">
        <SectionHeader title="لینک مستندات اصلی" description="برای هر مورد، منبع اصلی در تلگرام حفظ شده است." />
        <div className="content-grid-wide">{sourceDocuments.map((item) => <EvidenceCard item={item} key={item.id} />)}</div>
      </section>
    </main>
  );
}
