import type { Metadata } from "next";
import Link from "next/link";
import { AddChoiceButton } from "../../components/AddChoiceButton";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import { PublicBreadcrumbs, PublicServiceError, degreeLabel, formatPublicDate } from "../../components/PublicContent";
import { StructuredData } from "../../components/StructuredData";
import { EmptyState, PageHeader, SectionHeader, StatCard } from "../../components/ui";
import { apiGetPublic } from "../../lib/api";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

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

interface PublicUniversitySummary {
  id: string;
  code: string;
  title: string;
  city: string;
  programCount: number;
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
  university: Omit<PublicUniversitySummary, "programCount">;
  capacities: PublicCapacity[];
}

interface ProgramFilters {
  degree?: "master" | "phd";
  field?: string;
  city?: string;
  university?: string;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function requestedFilters(searchParams: SearchParams): ProgramFilters {
  const degree = firstParam(searchParams.degree);
  return {
    degree: degree === "master" || degree === "phd" ? degree : undefined,
    field: firstParam(searchParams.field)?.trim() || undefined,
    city: firstParam(searchParams.city)?.trim() || undefined,
    university: firstParam(searchParams.university)?.trim() || undefined,
  };
}

function filterQuery(filters: ProgramFilters) {
  const query = new URLSearchParams();
  if (filters.degree) query.set("degree", filters.degree);
  if (filters.field) query.set("field", filters.field);
  if (filters.city) query.set("city", filters.city);
  if (filters.university) query.set("university", filters.university);
  return query.toString();
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

function quotaLabel(quota: string) {
  return ({
    "region-1": "منطقهٔ یک",
    "region-2": "منطقهٔ دو",
    "region-3": "منطقهٔ سه",
    free: "آزاد",
  } as Record<string, string>)[quota.toLocaleLowerCase("en-US")] ?? toPersianDigits(quota);
}

function latestCapacities(capacities: PublicCapacity[]) {
  if (capacities.length === 0) return [];
  const latestYear = Math.max(...capacities.map((item) => item.examYear));
  return capacities.filter((item) => item.examYear === latestYear);
}

async function loadCatalog(filters: ProgramFilters) {
  try {
    const query = filterQuery(filters);
    const allProgramsRequest = apiGetPublic<PublicProgram[]>("/programs");
    const [programs, allPrograms, universities] = await Promise.all([
      query ? apiGetPublic<PublicProgram[]>(`/programs?${query}`) : allProgramsRequest,
      allProgramsRequest,
      apiGetPublic<PublicUniversitySummary[]>("/universities"),
    ]);
    return {
      programs: programs ?? [],
      allPrograms: allPrograms ?? [],
      universities: universities ?? [],
      unavailable: false,
    };
  } catch {
    return { programs: [], allPrograms: [], universities: [], unavailable: true };
  }
}

export function generateMetadata({ searchParams }: { searchParams: SearchParams }): Metadata {
  const hasFilters = Object.keys(searchParams).length > 0;
  return {
    ...pageMetadata({
      title: "رشته‌محل‌ها و دانشگاه‌های کنکور کامپیوتر",
      description: "جست‌وجوی رشته‌محل‌های ارشد و دکتری کامپیوتر که به منبع رسمی و تاریخ بررسی مشخص متصل‌اند.",
      path: "/programs",
      noIndex: hasFilters,
    }),
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
  };
}

function ProgramCard({ program }: { program: PublicProgram }) {
  const capacities = latestCapacities(program.capacities);
  return (
    <article className="catalog-card program-card">
      <div>
        <div className="catalog-card-meta">
          <span>{degreeLabel(program.degree)}</span>
          <span>{fieldLabel(program.field)}</span>
        </div>
        <h3><Link href={`/programs/${encodeURIComponent(program.code)}`}>{program.title}</Link></h3>
        <p>
          <Link className="text-link" href={`/universities/${encodeURIComponent(program.university.code)}`}>
            {program.university.title}
          </Link>
          {` · ${program.university.city}`}
        </p>
        <p className="muted-copy">
          {tuitionLabel(program.tuitionType)}
          {program.hasDormitory ? " · خوابگاه در دادهٔ این رشته‌محل ثبت شده" : ""}
        </p>
        {capacities.length > 0 && (
          <div className="subject-tags" aria-label="آخرین ظرفیت ثبت‌شده">
            {capacities.map((item) => (
              <span key={`${item.examYear}-${item.quota}`}>
                {toPersianDigits(item.examYear)} · {quotaLabel(item.quota)}: {formatPersianNumber(item.capacity)} نفر
              </span>
            ))}
          </div>
        )}
        <p className="muted-copy">
          منبع: <a href={program.source.canonicalUrl} target="_blank" rel="noreferrer">{program.source.publisher}</a>
          {formatPublicDate(program.source.checkedAt) ? ` · بررسی ${formatPublicDate(program.source.checkedAt)}` : ""}
        </p>
      </div>
      <div>
        <Link className="text-link" href={`/programs/${encodeURIComponent(program.code)}`}>جزئیات و ظرفیت‌ها ←</Link>
        <AddChoiceButton programId={program.id} />
      </div>
    </article>
  );
}

export default async function ProgramsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = requestedFilters(searchParams);
  const result = await loadCatalog(filters);
  const breadcrumbs = [{ name: "خانه", href: "/" }, { name: "انتخاب‌رشته", href: "/admissions" }, { name: "رشته‌محل‌ها" }];

  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="فهرست رشته‌محل‌های رسمی" /></main>;
  }

  const fields = [...new Set(result.allPrograms.map((item) => item.field))].sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b), "fa"));
  const cities = [...new Set(result.universities.map((item) => item.city))].sort((a, b) => a.localeCompare(b, "fa"));
  const filterCount = Object.values(filters).filter(Boolean).length;
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "رشته‌محل‌های منبع‌دار کنکور کامپیوتر",
      description: "فهرست رشته‌محل‌هایی که منبع رسمی فعال برای آن‌ها ثبت شده است.",
      url: absoluteUrl("/programs"),
      inLanguage: "fa-IR",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: result.programs.length,
        itemListElement: result.programs.map((program, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${program.title}، ${program.university.title}`,
          url: absoluteUrl(`/programs/${encodeURIComponent(program.code)}`),
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.href ?? "/programs"),
      })),
    },
  ];

  return (
    <main className="page-container">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={breadcrumbs} />
      <PageHeader
        eyebrow="دادهٔ رسمی انتخاب‌رشته"
        title="دانشگاه‌ها و رشته‌محل‌ها"
        description="فقط رکوردهایی در این صفحه می‌آیند که به منبع رسمی فعال و تاریخ بررسی مشخص متصل باشند. ظرفیت‌ها ممکن است با اصلاحیه‌های بعدی تغییر کنند."
        action={<Link className="button button-secondary" href="/choices">انتخاب‌های من</Link>}
      />

      <aside className="official-disclaimer">
        <strong>ملاک نهایی چیست؟</strong>
        <p>دفترچهٔ انتخاب‌رشته و اصلاحیه‌های سازمان سنجش ملاک نهایی‌اند. نبودن یک رشته‌محل در این فهرست به معنی ارائه‌نشدن آن نیست؛ ممکن است هنوز منبع رسمی آن در سامانه ثبت نشده باشد.</p>
      </aside>

      <form className="surface-card field-grid" action="/programs" method="get">
        <div className="field-grid field-grid-two">
          <label className="field-group">
            <span>مقطع</span>
            <select className="field-input" name="degree" defaultValue={filters.degree ?? ""}>
              <option value="">همهٔ مقاطع</option>
              <option value="master">ارشد</option>
              <option value="phd">دکتری</option>
            </select>
          </label>
          <label className="field-group">
            <span>رشته یا گرایش ثبت‌شده</span>
            <select className="field-input" name="field" defaultValue={filters.field ?? ""}>
              <option value="">همهٔ رشته‌ها و گرایش‌ها</option>
              {fields.map((field) => <option value={field} key={field}>{fieldLabel(field)}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>شهر</span>
            <select className="field-input" name="city" defaultValue={filters.city ?? ""}>
              <option value="">همهٔ شهرها</option>
              {cities.map((city) => <option value={city} key={city}>{city}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span>دانشگاه</span>
            <select className="field-input" name="university" defaultValue={filters.university ?? ""}>
              <option value="">همهٔ دانشگاه‌ها</option>
              {result.universities.map((university) => (
                <option value={university.code} key={university.code}>{university.title}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="catalog-card-footer">
          <button className="button button-primary" type="submit">اعمال فیلترها</button>
          {filterCount > 0 && <Link className="button button-secondary" href="/programs">پاک‌کردن فیلترها</Link>}
        </div>
      </form>

      <div className="stats-grid" aria-label="خلاصهٔ داده‌های رسمی">
        <StatCard label="رشته‌محل منبع‌دار" value={formatPersianNumber(result.programs.length)} detail={filterCount > 0 ? "منطبق با فیلترهای انتخابی" : "در فهرست فعلی"} />
        <StatCard label="دانشگاه منبع‌دار" value={formatPersianNumber(result.universities.length)} detail="دارای منبع رسمی فعال" tone="blue" />
        <StatCard label="فیلتر فعال" value={formatPersianNumber(filterCount)} detail="نشانی فیلتر قابل اشتراک است" tone="purple" />
      </div>

      <SectionHeader
        title="رشته‌محل‌های قابل بررسی"
        description="هر کارت به صفحهٔ جزئیات، ظرفیت‌های منبع‌دار و صفحهٔ دانشگاه متصل است."
      />
      {result.programs.length === 0 ? (
        <EmptyState
          title="رشته‌محل منبع‌داری با این فیلترها پیدا نشد"
          description="فیلترها را پاک کنید یا پس از ثبت و بررسی منبع رسمی دوباره به این صفحه سر بزنید."
          action={filterCount > 0 ? <Link className="button button-secondary" href="/programs">نمایش همهٔ رکوردهای رسمی</Link> : undefined}
        />
      ) : (
        <div className="program-grid">
          {result.programs.map((program) => <ProgramCard program={program} key={program.id} />)}
        </div>
      )}

      {result.universities.length > 0 && (
        <section>
          <SectionHeader title="دانشگاه‌های دارای منبع رسمی" description="صفحهٔ هر دانشگاه فقط برنامه‌هایی را نشان می‌دهد که منبع رسمی فعال دارند." />
          <div className="article-grid">
            {result.universities.map((university) => (
              <Link className="article-card" href={`/universities/${encodeURIComponent(university.code)}`} key={university.id}>
                <span className="article-meta">{university.city}</span>
                <h3>{university.title}</h3>
                <p>{formatPersianNumber(university.programCount)} رشته‌محل منبع‌دار</p>
                <span className="text-link">مشاهدهٔ صفحهٔ دانشگاه ←</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdmissionsJourney current="programs" />
    </main>
  );
}
