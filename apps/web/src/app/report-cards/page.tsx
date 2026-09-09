import type { Metadata } from "next";
import Link from "next/link";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import { PublicBreadcrumbs, PublicServiceError, degreeLabel } from "../../components/PublicContent";
import { StructuredData } from "../../components/StructuredData";
import { EmptyState, PageHeader, StatCard } from "../../components/ui";
import { apiGetPublic } from "../../lib/api";
import { formatPersianNumber, toEnglishDigits, toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";

type SearchValue = string | string[] | undefined;

interface ReportCardSearchParams {
  page?: SearchValue;
  examYear?: SearchValue;
  degree?: SearchValue;
  field?: SearchValue;
  quota?: SearchValue;
  specialization?: SearchValue;
  university?: SearchValue;
  rankMin?: SearchValue;
  rankMax?: SearchValue;
}

interface SubjectScore { subject_code: string; percent: number }
interface RankValue { value: number; scope: "national" | "quota" | "field" }
interface AdmissionValue {
  program_code: string;
  status: "accepted" | "rejected" | "waitlisted";
  program?: { code: string; title: string; university: { code: string; title: string } };
}
interface PublicReportCard {
  examYear: number;
  degree: string;
  field: string;
  quota: string;
  subjectScores: SubjectScore[];
  rank: RankValue;
  admissions: AdmissionValue[];
}
interface CohortSummary {
  sampleSize: number;
  minimumSampleSize: number;
  dataYears: number[];
  aggregate: null | {
    rankMedian: number;
    rankP25: number;
    rankP75: number;
    rankCentral80Low: number;
    rankCentral80High: number;
    intervalKind: "EMPIRICAL_CENTRAL_80";
    intervalNote: string;
  };
  limitations: string[];
}
interface PublicReportCardsResponse {
  items: PublicReportCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  cohort: CohortSummary;
}
interface PublicProgramOption {
  id: string;
  code: string;
  title: string;
  university: { code: string; title: string };
}

const filterKeys = ["examYear", "degree", "field", "quota", "specialization", "university", "rankMin", "rankMax"] as const;
const fieldLabels: Record<string, string> = {
  "computer-engineering": "مهندسی کامپیوتر",
  "information-technology": "فناوری اطلاعات",
  "computer-science": "علوم کامپیوتر",
  software: "نرم‌افزار",
  "artificial-intelligence": "هوش مصنوعی",
  artificial_intelligence: "هوش مصنوعی",
};
const subjectLabels: Record<string, string> = {
  english: "زبان عمومی و تخصصی",
  "discrete-math": "ریاضیات گسسته",
  statistics: "آمار و احتمال",
  "linear-algebra": "جبر خطی",
  "programming-fundamentals": "مبانی برنامه‌سازی",
  "digital-logic": "مدارهای منطقی",
  "computer-architecture": "معماری کامپیوتر",
  "data-structures-algorithms": "داده‌ساختارها و الگوریتم‌ها",
  "data-structures": "ساختمان داده‌ها",
  algorithms: "طراحی الگوریتم‌ها",
  automata: "نظریهٔ زبان‌ها و ماشین‌ها",
  "operating-systems": "سیستم‌عامل",
  "artificial-intelligence": "هوش مصنوعی",
  "computer-networks": "شبکه‌های کامپیوتری",
  databases: "طراحی پایگاه داده‌ها",
  "software-engineering": "مهندسی نرم‌افزار",
};

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function normalizedNumber(value: SearchValue): string {
  return toEnglishDigits(first(value)).replace(/[^0-9]/g, "");
}

function requestedPage(value: SearchValue): number {
  const parsed = Number(normalizedNumber(value) || "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function filterQuery(searchParams: ReportCardSearchParams, page?: number): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of filterKeys) {
    const value = key === "examYear" || key === "rankMin" || key === "rankMax"
      ? normalizedNumber(searchParams[key])
      : first(searchParams[key]);
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  return params;
}

function pageHref(searchParams: ReportCardSearchParams, page: number): string {
  const query = filterQuery(searchParams, page).toString();
  return query ? `/report-cards?${query}` : "/report-cards";
}

export function generateMetadata({ searchParams }: { searchParams: ReportCardSearchParams }): Metadata {
  const page = requestedPage(searchParams.page);
  const hasQuery = Object.values(searchParams).some((value) => first(value) !== "");
  return pageMetadata({
    title: page > 1 ? `بانک کارنامه‌های عمومی؛ صفحهٔ ${toPersianDigits(page)}` : "بانک کارنامه‌های عمومی کنکور کامپیوتر",
    description: "نمونه‌های ناشناس و رضایت‌دار کارنامه‌های کنکور کامپیوتر، همراه با حجم نمونه و محدودیت‌های مقایسه.",
    path: "/report-cards",
    noIndex: hasQuery,
  });
}

function rankScopeLabel(scope: RankValue["scope"]) {
  return ({ national: "کشوری", quota: "در سهمیه", field: "در رشته" })[scope];
}

function admissionStatusLabel(status: AdmissionValue["status"]) {
  return ({ accepted: "قبول", rejected: "رد", waitlisted: "ذخیره" })[status];
}

function fieldLabel(value: string) {
  return fieldLabels[value] ?? toPersianDigits(value.replace(/[-_]+/g, " "));
}

function subjectLabel(value: string) {
  return subjectLabels[value] ?? toPersianDigits(value.replace(/[-_]+/g, " "));
}

function quotaLabel(value: string) {
  const match = value.match(/^region[-_ ]?(\d+)$/i);
  return match ? `سهمیهٔ منطقهٔ ${toPersianDigits(match[1])}` : toPersianDigits(value.replace(/[-_]+/g, " "));
}

async function loadPageData(searchParams: ReportCardSearchParams, page: number) {
  const apiParams = filterQuery(searchParams, page);
  apiParams.set("limit", "12");
  const [reportResult, programResult] = await Promise.allSettled([
    apiGetPublic<PublicReportCardsResponse>(`/report-cards?${apiParams.toString()}`),
    apiGetPublic<PublicProgramOption[]>("/programs"),
  ]);
  return {
    reportData: reportResult.status === "fulfilled" ? reportResult.value : null,
    reportUnavailable: reportResult.status === "rejected",
    programs: programResult.status === "fulfilled" ? programResult.value ?? [] : [],
  };
}

function ReportCard({ report }: { report: PublicReportCard }) {
  return (
    <article className="surface-card">
      <div className="article-card-top">
        <span className="article-meta">کنکور {degreeLabel(report.degree)} {toPersianDigits(report.examYear)}</span>
        <span>{quotaLabel(report.quota)}</span>
      </div>
      <h2>{fieldLabel(report.field)}</h2>
      <p>رتبهٔ {formatPersianNumber(report.rank.value)} {rankScopeLabel(report.rank.scope)}</p>
      <div className="responsive-table">
        <table>
          <thead><tr><th>درس</th><th>درصد</th></tr></thead>
          <tbody>
            {report.subjectScores.map((score) => (
              <tr key={score.subject_code}>
                <td>{subjectLabel(score.subject_code)}</td>
                <td>{formatPersianNumber(score.percent, { maximumFractionDigits: 2 })}٪</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.admissions.length > 0 && (
        <div className="subject-tags" aria-label="نتیجه‌های انتخاب رشته">
          {report.admissions.map((admission, index) => (
            <span key={`${admission.program_code}-${admission.status}-${index}`}>
              {admission.program ? (
                <Link href={`/programs/${admission.program.code}`}>
                  {admission.program.title}، {admission.program.university.title}
                </Link>
              ) : toPersianDigits(admission.program_code)}: {admissionStatusLabel(admission.status)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function ReportCardsPage({ searchParams }: { searchParams: ReportCardSearchParams }) {
  const page = requestedPage(searchParams.page);
  const result = await loadPageData(searchParams, page);
  const path = "/report-cards";
  const breadcrumbs = [{ name: "خانه", href: "/" }, { name: "کارنامه‌ها" }];
  if (result.reportUnavailable) {
    return <main className="page-container"><PublicServiceError label="بانک کارنامه" /></main>;
  }
  const emptyData: PublicReportCardsResponse = {
    items: [], page, limit: 12, total: 0, totalPages: 0,
    cohort: { sampleSize: 0, minimumSampleSize: 5, dataYears: [], aggregate: null, limitations: [] },
  };
  const data = result.reportData && Array.isArray(result.reportData.items) && result.reportData.cohort
    ? result.reportData
    : emptyData;
  const hasFilters = filterKeys.some((key) => first(searchParams[key]) !== "");
  const universities = [...new Map(result.programs.map((program) => [program.university.code, program.university])).values()]
    .sort((left, right) => left.title.localeCompare(right.title, "fa"));
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "کارنامه‌های عمومی کنکور کامپیوتر کنکورصفریک",
      description: "کارنامه‌های ناشناس که رضایت انتشار عمومی آن‌ها در سامانه ثبت شده است.",
      url: absoluteUrl(path),
      inLanguage: "fa-IR",
      isAccessibleForFree: true,
      creator: { "@id": absoluteUrl("/#organization") },
      includedInDataCatalog: { "@type": "DataCatalog", name: "مستندات کنکورصفریک", url: absoluteUrl(path) },
      variableMeasured: ["سال آزمون", "مقطع", "رشته", "سهمیه", "درصد درس‌ها", "رتبه", "نتیجهٔ پذیرش"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem", position: index + 1, name: item.name, item: absoluteUrl(item.href ?? path),
      })),
    },
  ];

  return (
    <main className="page-container">
      <StructuredData data={schemas} />
      <PublicBreadcrumbs items={breadcrumbs} />
      <PageHeader
        eyebrow="دادهٔ مستند و رضایت‌محور"
        title="بانک کارنامه‌های عمومی"
        description="فقط کارنامه‌های دارای رضایت انتشار نمایش داده می‌شوند؛ شناسهٔ فردی، فایل خام و منشأ خصوصی هر رکورد از خروجی عمومی حذف شده است."
        action={<Link className="button button-primary" href="/rank-estimate">تخمین بازه‌ای رتبه</Link>}
      />
      <aside className="official-disclaimer">
        <strong>این بانک چگونه خوانده شود؟</strong>
        <p>این نمونه‌ها تضمین رتبه یا قبولی مشابه نیستند. سال آزمون، سهمیه، رشته و اندازهٔ نمونه را کنار هر مقایسه ببینید.</p>
      </aside>

      <form className="surface-card" action="/report-cards" method="get">
        <div className="section-heading">
          <div><h2>فیلتر کارنامه‌ها</h2><p>هر فیلتر، حجم نمونه و دامنهٔ آمار را هم‌زمان تغییر می‌دهد.</p></div>
          {hasFilters && <Link className="text-link" href="/report-cards">پاک‌کردن فیلترها</Link>}
        </div>
        <div className="field-grid field-grid-two">
          <label className="field-group"><span>سال آزمون</span><input className="field-input" inputMode="numeric" name="examYear" defaultValue={toPersianDigits(first(searchParams.examYear))} placeholder="۱۴۰۵" /></label>
          <label className="field-group"><span>مقطع</span><select className="field-input" name="degree" defaultValue={first(searchParams.degree)}><option value="">همهٔ مقاطع</option><option value="MASTER">ارشد</option><option value="PHD">دکتری</option></select></label>
          <label className="field-group"><span>رشته یا مجموعه</span><input className="field-input" name="field" defaultValue={first(searchParams.field)} placeholder="مثلاً computer-engineering" /></label>
          <label className="field-group"><span>سهمیه</span><input className="field-input" name="quota" defaultValue={first(searchParams.quota)} placeholder="مثلاً region-1" /></label>
          <label className="field-group"><span>گرایش و برنامه</span><select className="field-input" name="specialization" defaultValue={first(searchParams.specialization)}><option value="">همهٔ برنامه‌ها</option>{result.programs.map((program) => <option value={program.code} key={program.id}>{program.title} — {program.university.title}</option>)}</select></label>
          <label className="field-group"><span>دانشگاه</span><select className="field-input" name="university" defaultValue={first(searchParams.university)}><option value="">همهٔ دانشگاه‌ها</option>{universities.map((university) => <option value={university.code} key={university.code}>{university.title}</option>)}</select></label>
          <label className="field-group"><span>رتبه از</span><input className="field-input" inputMode="numeric" name="rankMin" defaultValue={toPersianDigits(first(searchParams.rankMin))} placeholder="۱" /></label>
          <label className="field-group"><span>رتبه تا</span><input className="field-input" inputMode="numeric" name="rankMax" defaultValue={toPersianDigits(first(searchParams.rankMax))} placeholder="۱۰۰" /></label>
        </div>
        <button className="button button-primary" type="submit">اعمال فیلتر</button>
      </form>

      <section aria-labelledby="cohort-summary-title">
        <div className="section-heading"><div><h2 id="cohort-summary-title">خلاصهٔ همین نمونه</h2><p>آمار فقط روی رکوردهای منطبق با فیلترهای بالا محاسبه شده است.</p></div></div>
        <div className="stats-grid">
          <StatCard label="حجم نمونه" value={formatPersianNumber(data.cohort.sampleSize)} detail="کارنامهٔ رضایت‌دار" />
          <StatCard label="سال‌های داده" value={data.cohort.dataYears.length ? data.cohort.dataYears.map(toPersianDigits).join("، ") : "—"} detail="دامنهٔ زمانی این نتیجه" tone="blue" />
          <StatCard label="حداقل تجمیع" value={formatPersianNumber(data.cohort.minimumSampleSize)} detail="کمتر از این عدد، آمار پنهان می‌ماند" tone="purple" />
        </div>
        {data.cohort.aggregate ? (
          <div className="surface-card">
            <h3>توزیع تجربی رتبه در این نمونه</h3>
            <div className="stats-grid">
              <StatCard label="میانهٔ رتبه" value={formatPersianNumber(data.cohort.aggregate.rankMedian)} detail="نقطهٔ میانی نمونه" />
              <StatCard label="۵۰٪ میانی" value={`${formatPersianNumber(data.cohort.aggregate.rankP25)} تا ${formatPersianNumber(data.cohort.aggregate.rankP75)}`} detail="صدک ۲۵ تا ۷۵" tone="blue" />
              <StatCard label="۸۰٪ مرکزی" value={`${formatPersianNumber(data.cohort.aggregate.rankCentral80Low)} تا ${formatPersianNumber(data.cohort.aggregate.rankCentral80High)}`} detail="صدک ۱۰ تا ۹۰" tone="purple" />
            </div>
            <p className="muted-copy">{data.cohort.aggregate.intervalNote}</p>
          </div>
        ) : (
          <aside className="official-disclaimer"><strong>آمار تجمیعی نمایش داده نشد</strong><p>برای جلوگیری از نتیجه‌گیری گمراه‌کننده، تا وقتی حداقل {formatPersianNumber(data.cohort.minimumSampleSize)} رکورد منطبق وجود نداشته باشد، میانه و بازه محاسبه نمی‌شود.</p></aside>
        )}
        {data.cohort.limitations.length > 0 && <ul className="check-list">{data.cohort.limitations.map((item) => <li key={item}>{item}</li>)}</ul>}
      </section>

      {data.items.length === 0 ? (
        <EmptyState
          title={hasFilters ? "کارنامه‌ای با این فیلترها پیدا نشد" : "هنوز کارنامهٔ عمومی ثبت نشده است"}
          description="کارنامه فقط پس از ثبت رضایت انتشار وارد این مجموعه می‌شود."
          action={hasFilters ? <Link className="button button-secondary" href="/report-cards">نمایش همه</Link> : undefined}
        />
      ) : (
        <>
          <section className="content-grid-wide" aria-label="فهرست کارنامه‌های عمومی">
            {data.items.map((report, index) => <ReportCard report={report} key={`${report.examYear}-${report.field}-${report.rank.value}-${index}`} />)}
          </section>
          {data.totalPages > 1 && (
            <nav className="page-header-action" aria-label="صفحه‌بندی کارنامه‌ها">
              {data.page > 1 && <Link className="button button-secondary" href={pageHref(searchParams, data.page - 1)}>صفحهٔ قبل</Link>}
              <span className="muted-copy">صفحهٔ {toPersianDigits(data.page)} از {toPersianDigits(data.totalPages)}</span>
              {data.page < data.totalPages && <Link className="button button-secondary" href={pageHref(searchParams, data.page + 1)}>صفحهٔ بعد</Link>}
            </nav>
          )}
        </>
      )}
      <AdmissionsJourney current="evidence" />
    </main>
  );
}
