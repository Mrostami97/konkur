import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddChoiceButton } from "../../../components/AddChoiceButton";
import { AdmissionsJourney } from "../../../components/AdmissionsJourney";
import {
  PublicBreadcrumbs,
  PublicServiceError,
  PublicSourceList,
  degreeLabel,
  formatPublicDate,
  type PublicSourceReference,
} from "../../../components/PublicContent";
import { StructuredData } from "../../../components/StructuredData";
import { EmptyState, PageHeader, SectionHeader, StatCard } from "../../../components/ui";
import { apiGetPublic } from "../../../lib/api";
import { formatPersianNumber } from "../../../lib/format";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";

interface PublicSource {
  title: string;
  publisher: string;
  canonicalUrl: string;
  checkedAt: string;
}

interface PublicCapacity {
  examYear: number;
  quota: string;
  capacity: number;
  source: PublicSource;
}

interface PublicProgram {
  id: string;
  code: string;
  title: string;
  degree: string;
  field: string;
  tuitionType: string;
  hasDormitory: boolean;
  source: PublicSource;
  university: {
    id: string;
    code: string;
    title: string;
    city: string;
    source: PublicSource;
  };
  capacities: PublicCapacity[];
}

interface PublicUniversity {
  id: string;
  code: string;
  title: string;
  city: string;
  source: PublicSource;
  programs: PublicProgram[];
}

function fieldLabel(field: string) {
  return ({
    "computer-engineering": "مهندسی کامپیوتر",
    computer: "مهندسی کامپیوتر",
    "information-technology": "فناوری اطلاعات",
    it: "فناوری اطلاعات",
    "computer-science": "علوم کامپیوتر",
    software: "نرم‌افزار",
    "artificial-intelligence": "هوش مصنوعی",
    ai: "هوش مصنوعی",
  } as Record<string, string>)[field.toLocaleLowerCase("en-US")] ?? field;
}

function tuitionLabel(tuitionType: string) {
  return ({ FREE: "بدون شهریه", PAID: "شهریه‌پرداز" } as Record<string, string>)[tuitionType] ?? tuitionType;
}

function publicSourceReference(source: PublicSource, claim: string): PublicSourceReference {
  return {
    relation: "EVIDENCE",
    locator: null,
    claim,
    order: 0,
    source: {
      ...source,
      deepUrl: null,
      licenseName: null,
      licenseUrl: null,
      attributionText: null,
    },
  };
}

async function loadUniversity(code: string) {
  try {
    return {
      university: await apiGetPublic<PublicUniversity>(`/universities/${encodeURIComponent(code)}`),
      unavailable: false,
    };
  } catch {
    return { university: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const result = await loadUniversity(params.code);
  if (!result.university) {
    return pageMetadata({
      title: "دانشگاه در دسترس نیست",
      description: "این دانشگاه منبع رسمی فعال ندارد، پیدا نشد یا سرویس انتخاب‌رشته در دسترس نیست.",
      path: `/universities/${encodeURIComponent(params.code)}`,
      noIndex: true,
    });
  }
  return {
    ...pageMetadata({
      title: `${result.university.title}؛ رشته‌محل‌های کنکور کامپیوتر`,
      description: `رشته‌محل‌ها و ظرفیت‌های منبع‌دار ${result.university.title} در ${result.university.city}.`,
      path: `/universities/${encodeURIComponent(result.university.code)}`,
    }),
    robots: { index: true, follow: true },
  };
}

export default async function UniversityPage({ params }: { params: { code: string } }) {
  const result = await loadUniversity(params.code);
  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="صفحهٔ دانشگاه" /></main>;
  }
  if (!result.university) notFound();

  const university = result.university;
  const path = `/universities/${encodeURIComponent(university.code)}`;
  const breadcrumbs = [
    { name: "خانه", href: "/" },
    { name: "انتخاب‌رشته", href: "/admissions" },
    { name: "رشته‌محل‌ها", href: "/programs" },
    { name: university.title },
  ];
  const degrees = new Set(university.programs.map((program) => program.degree));
  const capacityRecords = university.programs.reduce((sum, program) => sum + program.capacities.length, 0);
  const programSources = [...new Map(
    university.programs.map((program) => [program.source.canonicalUrl, program.source] as const),
  ).values()];
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${absoluteUrl(path)}#webpage`,
      url: absoluteUrl(path),
      name: `${university.title}؛ رشته‌محل‌های کنکور کامپیوتر`,
      inLanguage: "fa-IR",
      citation: university.source.canonicalUrl,
      about: {
        "@type": "CollegeOrUniversity",
        name: university.title,
        address: { "@type": "PostalAddress", addressLocality: university.city },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.href ?? path),
      })),
    },
  ];

  return (
    <main className="page-container">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={breadcrumbs} />
      <PageHeader
        eyebrow="دانشگاه دارای منبع رسمی"
        title={university.title}
        description={`رشته‌محل‌های ثبت‌شده برای ${university.city}؛ فقط داده‌هایی نمایش داده می‌شوند که منبع رسمی فعال دارند.`}
        action={<Link className="button button-secondary" href={`/report-cards?university=${encodeURIComponent(university.code)}`}>کارنامه‌های مرتبط</Link>}
      />

      <aside className="official-disclaimer">
        <strong>دامنهٔ این صفحه</strong>
        <p>این صفحه رتبه‌بندی یا توصیهٔ دانشگاه نیست. ظرفیت و ارائهٔ رشته‌محل ممکن است در اصلاحیه‌ها تغییر کند؛ دفترچه و اصلاحیهٔ رسمی سازمان سنجش ملاک نهایی است.</p>
      </aside>

      <div className="stats-grid" aria-label="خلاصهٔ دانشگاه">
        <StatCard label="رشته‌محل منبع‌دار" value={formatPersianNumber(university.programs.length)} detail="در پایگاه فعلی" />
        <StatCard label="مقطع ثبت‌شده" value={formatPersianNumber(degrees.size)} detail="ارشد یا دکتری" tone="blue" />
        <StatCard label="رکورد ظرفیت" value={formatPersianNumber(capacityRecords)} detail="هر رکورد با منبع رسمی" tone="purple" />
      </div>

      <section>
        <SectionHeader title="رشته‌محل‌های منبع‌دار" description="برای دیدن سال، سهمیه و سند ظرفیت وارد صفحهٔ هر رشته‌محل شوید." />
        {university.programs.length === 0 ? (
          <EmptyState
            title="هنوز رشته‌محل عمومی برای این دانشگاه ثبت نشده است"
            description="رکورد بدون منبع رسمی فعال در این صفحه منتشر نمی‌شود."
          />
        ) : (
          <div className="program-grid">
            {university.programs.map((program) => (
              <article className="catalog-card program-card" key={program.id}>
                <div>
                  <div className="catalog-card-meta">
                    <span>{degreeLabel(program.degree)}</span>
                    <span>{fieldLabel(program.field)}</span>
                  </div>
                  <h3><Link href={`/programs/${encodeURIComponent(program.code)}`}>{program.title}</Link></h3>
                  <p>{tuitionLabel(program.tuitionType)}{program.hasDormitory ? " · وضعیت مثبت خوابگاه ثبت شده" : ""}</p>
                  <p className="muted-copy">
                    منبع رشته‌محل: <a href={program.source.canonicalUrl} target="_blank" rel="noreferrer">{program.source.publisher}</a>
                    {formatPublicDate(program.source.checkedAt) ? ` · بررسی ${formatPublicDate(program.source.checkedAt)}` : ""}
                  </p>
                </div>
                <div>
                  <Link className="text-link" href={`/programs/${encodeURIComponent(program.code)}`}>مشاهدهٔ جزئیات ←</Link>
                  <AddChoiceButton programId={program.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PublicSourceList sources={[
        publicSourceReference(university.source, "نام و شهر دانشگاه از رکورد متصل به این منبع رسمی نمایش داده می‌شود."),
        ...programSources.map((source) => publicSourceReference(
          source,
          "اطلاعات یک یا چند رشته‌محل نمایش‌داده‌شده در این صفحه به این منبع رسمی متصل است.",
        )),
      ]} />
      <p className="muted-copy">آخرین بررسی منبع: {formatPublicDate(university.source.checkedAt) ?? "ثبت نشده"}</p>
      <AdmissionsJourney current="programs" />
    </main>
  );
}
