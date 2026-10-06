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
import { formatPersianNumber, toPersianDigits } from "../../../lib/format";
import { GENDER_LABEL, examSetTitle, groupLabel, isKeyNote, noteItems, periodLabel, type ProgramGender } from "../../../lib/admissions";
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
  selectionCode?: string | null;
  notes?: string | null;
  bookletPage?: number | null;
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
  examSetCode?: string | null;
  coefficientGroup?: number | null;
  orientation?: string | null;
  period?: string | null;
  location?: string | null;
  city?: string | null;
  gender?: ProgramGender;
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
    "term-1": "نیمسال اول",
    "term-2": "نیمسال دوم",
  } as Record<string, string>)[quota.toLocaleLowerCase("en-US")] ?? toPersianDigits(quota);
}

function publicSourceReference(source: PublicSource, claim: string, order: number): PublicSourceReference {
  return {
    relation: "EVIDENCE",
    locator: null,
    claim,
    order,
    source: {
      ...source,
      deepUrl: null,
      licenseName: null,
      licenseUrl: null,
      attributionText: null,
    },
  };
}

async function loadProgram(code: string) {
  try {
    return {
      program: await apiGetPublic<PublicProgram>(`/programs/code/${encodeURIComponent(code)}`),
      unavailable: false,
    };
  } catch {
    return { program: null, unavailable: true };
  }
}

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const params = await pendingParams;
  const result = await loadProgram(params.code);
  if (!result.program) {
    return pageMetadata({
      title: "رشته‌محل در دسترس نیست",
      description: "این رشته‌محل منبع رسمی فعال ندارد، پیدا نشد یا سرویس انتخاب‌رشته در دسترس نیست.",
      path: `/programs/${encodeURIComponent(params.code)}`,
      noIndex: true,
    });
  }
  const program = result.program;
  return {
    ...pageMetadata({
      title: `${program.title} در ${program.university.title}`,
      description: `اطلاعات و ظرفیت‌های منبع‌دار ${program.title}، مقطع ${degreeLabel(program.degree)} در ${program.university.title}.`,
      path: `/programs/${encodeURIComponent(program.code)}`,
      noIndex: true,
    }),
    // One page per کد رشته‌محل would be hundreds of near-identical pages; the
    // owner has not approved programmatic SEO pages yet (CLAUDE.md), so only
    // the finder at /programs is indexed.
    robots: { index: false, follow: true },
  };
}

export default async function ProgramPage({ params: pendingParams }: { params: Promise<{ code: string }> }) {
  const params = await pendingParams;
  const result = await loadProgram(params.code);
  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="صفحهٔ رشته‌محل" /></main>;
  }
  if (!result.program) notFound();

  const program = result.program;
  const city = program.city ?? program.university.city;
  const place = program.location && program.location !== city ? `${city}، ${program.location}` : city;
  const path = `/programs/${encodeURIComponent(program.code)}`;
  const breadcrumbs = [
    { name: "خانه", href: "/" },
    { name: "انتخاب‌رشته", href: "/admissions" },
    { name: "رشته‌محل‌ها", href: "/programs" },
    { name: program.university.title, href: `/universities/${encodeURIComponent(program.university.code)}` },
    { name: program.title },
  ];
  const years = [...new Set(program.capacities.map((capacity) => capacity.examYear))].sort((a, b) => b - a);
  const reportCardQuery = new URLSearchParams({
    degree: program.degree,
    field: program.field,
    specialization: program.code,
    university: program.university.code,
  });
  const capacitySourceGroups = new Map<string, { source: PublicSource; records: string[] }>();
  for (const capacity of program.capacities) {
    const current = capacitySourceGroups.get(capacity.source.canonicalUrl) ?? { source: capacity.source, records: [] };
    current.records.push(`${toPersianDigits(capacity.examYear)}، ${quotaLabel(capacity.quota)}`);
    capacitySourceGroups.set(capacity.source.canonicalUrl, current);
  }
  const sourceReferences = [
    publicSourceReference(
      program.source,
      "عنوان، مقطع، رشته یا گرایش، نوع شهریه و وضعیت خوابگاه این رشته‌محل از رکورد متصل به این منبع رسمی نمایش داده می‌شود.",
      0,
    ),
    publicSourceReference(
      program.university.source,
      "نام و شهر دانشگاه از رکورد متصل به این منبع رسمی نمایش داده می‌شود.",
      1,
    ),
    ...[...capacitySourceGroups.values()].map((group, index) => publicSourceReference(
      group.source,
      `رکوردهای ظرفیت ${group.records.join("؛ ")} از این منبع ثبت شده‌اند.`,
      index + 2,
    )),
  ];
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${absoluteUrl(path)}#webpage`,
      url: absoluteUrl(path),
      name: `${program.title} در ${program.university.title}`,
      inLanguage: "fa-IR",
      citation: [...new Set(sourceReferences.map((item) => item.source.canonicalUrl))],
      mainEntity: {
        "@type": "EducationalOccupationalProgram",
        name: program.title,
        url: absoluteUrl(path),
        provider: {
          "@type": "CollegeOrUniversity",
          name: program.university.title,
          address: { "@type": "PostalAddress", addressLocality: program.university.city },
        },
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
        eyebrow={`${degreeLabel(program.degree)} · ${program.examSetCode ? `${examSetTitle(program.examSetCode)} (${toPersianDigits(program.examSetCode)})` : fieldLabel(program.field)}`}
        title={`${program.title}${program.period ? `، ${periodLabel(program.period)}` : ""}`}
        description={`${program.university.title}، ${place}؛ اطلاعات این صفحه فقط از رکوردهای متصل به منبع رسمی فعال ساخته شده است.`}
        action={<AddChoiceButton programId={program.id} />}
      />

      <aside className="official-disclaimer">
        <strong>دادهٔ تاریخی، نه وعدهٔ قبولی</strong>
        <p>ظرفیت هر سال برای همان سال معنا دارد و می‌تواند با اصلاحیه تغییر کند. این صفحه شانس قبولی تولید نمی‌کند؛ دفترچه و اصلاحیه‌های رسمی سازمان سنجش ملاک نهایی‌اند.</p>
      </aside>

      <div className="stats-grid" aria-label="مشخصات رشته‌محل">
        <StatCard label="مقطع" value={degreeLabel(program.degree)} detail={fieldLabel(program.field)} />
        <StatCard label="نوع دوره" value={program.period ? periodLabel(program.period) : tuitionLabel(program.tuitionType)} detail={program.hasDormitory ? "خوابگاه در دادهٔ این رکورد ثبت شده" : "وضعیت مثبت خوابگاه ثبت نشده"} tone="blue" />
        <StatCard label="رکورد ظرفیت" value={formatPersianNumber(program.capacities.length)} detail={years.length > 0 ? `سال‌های ${years.map(toPersianDigits).join("، ")}` : "هنوز ظرفیتی ثبت نشده"} tone="purple" />
      </div>

      <section className="surface-card" aria-labelledby="program-context-title">
        <div className="section-heading"><div><h2 id="program-context-title">جایگاه این رشته‌محل</h2><p>اطلاعات پایه‌ای که برای مقایسه لازم است.</p></div></div>
        <div className="responsive-table">
          <table>
            <tbody>
              <tr><th scope="row">دانشگاه</th><td><Link href={`/universities/${encodeURIComponent(program.university.code)}`}>{program.university.title}</Link></td></tr>
              <tr><th scope="row">محل تحصیل</th><td>{place}</td></tr>
              <tr><th scope="row">مقطع</th><td>{degreeLabel(program.degree)}</td></tr>
              {program.examSetCode && <tr><th scope="row">مجموعهٔ امتحانی</th><td>{examSetTitle(program.examSetCode)} ({toPersianDigits(program.examSetCode)})</td></tr>}
              {program.coefficientGroup ? <tr><th scope="row">کد ضریب</th><td>{toPersianDigits(groupLabel(program.examSetCode, program.coefficientGroup))}</td></tr> : null}
              <tr><th scope="row">گرایش</th><td>{program.orientation ?? fieldLabel(program.field)}</td></tr>
              <tr><th scope="row">دوره</th><td>{program.period ? `${periodLabel(program.period)} (${tuitionLabel(program.tuitionType)})` : tuitionLabel(program.tuitionType)}</td></tr>
              {program.gender && program.gender !== "ANY" && <tr><th scope="row">پذیرش</th><td>{GENDER_LABEL[program.gender]}</td></tr>}
              <tr><th scope="row">خوابگاه</th><td>{program.hasDormitory ? "در دادهٔ رسمی این رکورد ثبت شده" : "وضعیت مثبت در این رکورد ثبت نشده"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeader title="ظرفیت‌های ثبت‌شده" description="هر ردیف به منبع رسمی همان رکورد متصل است؛ ظرفیت سال‌های مختلف با هم ادغام نمی‌شود." />
        {program.capacities.length === 0 ? (
          <EmptyState
            title="ظرفیت رسمی برای این رشته‌محل ثبت نشده است"
            description="نبودن رکورد در این صفحه به معنی ظرفیت صفر نیست. برای تصمیم نهایی دفترچه و اصلاحیهٔ رسمی را بررسی کنید."
          />
        ) : (
          <div className="responsive-table">
            <table>
              <thead><tr><th>سال آزمون</th><th>کد رشته‌محل</th><th>نیمسال یا سهمیه</th><th>ظرفیت</th><th>توضیحات دفترچه</th><th>منبع رسمی</th></tr></thead>
              <tbody>
                {program.capacities.map((capacity) => (
                  <tr key={`${capacity.examYear}-${capacity.quota}`}>
                    <td>{toPersianDigits(capacity.examYear)}</td>
                    <td>{capacity.selectionCode ? toPersianDigits(capacity.selectionCode) : "—"}</td>
                    <td>{quotaLabel(capacity.quota)}</td>
                    <td>{formatPersianNumber(capacity.capacity)} نفر</td>
                    <td>{noteItems(capacity.notes).map((note) => isKeyNote(note) ? <strong key={note}>{note}. </strong> : <span key={note}>{note}. </span>)}</td>
                    <td>
                      <a href={capacity.source.canonicalUrl} target="_blank" rel="noreferrer">
                        {capacity.source.publisher}
                      </a>
                      {capacity.bookletPage ? `، صفحهٔ ${toPersianDigits(capacity.bookletPage)}` : ""}
                      {formatPublicDate(capacity.source.checkedAt) ? ` · بررسی ${formatPublicDate(capacity.source.checkedAt)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card" aria-labelledby="program-next-step-title">
        <div className="section-heading"><div><h2 id="program-next-step-title">این داده را وارد تصمیم کن</h2><p>ابتدا نمونه‌های دارای رضایت را ببین، بعد تخمین را بازه‌ای تفسیر کن و در پایان گزینه را اولویت بده.</p></div></div>
        <div className="about-actions">
          <Link className="button button-secondary" href={`/report-cards?${reportCardQuery.toString()}`}>کارنامه‌های مرتبط</Link>
          <Link className="button button-secondary" href="/rank-estimate">تخمین بازه‌ای رتبه</Link>
          <Link className="button button-secondary" href="/programs">ابزار انتخاب رشته</Link>
          <Link className="button button-secondary" href="/choices">فهرست انتخاب‌های من</Link>
        </div>
      </section>

      <PublicSourceList sources={sourceReferences} />
      <AdmissionsJourney current="programs" />
    </main>
  );
}
