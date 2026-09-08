import type { Metadata } from "next";
import Link from "next/link";
import { PublicBreadcrumbs, PublicServiceError, degreeLabel } from "../../components/PublicContent";
import { StructuredData } from "../../components/StructuredData";
import { EmptyState, PageHeader, StatCard } from "../../components/ui";
import { apiGetPublic } from "../../lib/api";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";

interface SubjectScore {
  subject_code: string;
  percent: number;
}

interface RankValue {
  value: number;
  scope: "national" | "quota" | "field";
}

interface AdmissionValue {
  program_code: string;
  status: "accepted" | "rejected" | "waitlisted";
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

interface PublicReportCardsResponse {
  items: PublicReportCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function requestedPage(value?: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function generateMetadata({ searchParams }: { searchParams: { page?: string | string[] } }): Metadata {
  const page = requestedPage(searchParams.page);
  const hasPaginationParameter = searchParams.page !== undefined;
  return pageMetadata({
    title: page > 1 ? `بانک کارنامه‌های عمومی؛ صفحهٔ ${toPersianDigits(page)}` : "بانک کارنامه‌های عمومی کنکور کامپیوتر",
    description: "نمونه‌های ناشناس کارنامه‌های کنکور کامپیوتر که رضایت انتشار آن‌ها ثبت شده است.",
    path: "/report-cards",
    noIndex: hasPaginationParameter,
  });
}

function rankScopeLabel(scope: RankValue["scope"]) {
  return ({ national: "کشوری", quota: "در سهمیه", field: "در رشته" })[scope];
}

function admissionStatusLabel(status: AdmissionValue["status"]) {
  return ({ accepted: "قبول", rejected: "رد", waitlisted: "ذخیره" })[status];
}

async function loadReportCards(page: number) {
  try {
    return {
      data: await apiGetPublic<PublicReportCardsResponse>(`/report-cards?page=${page}&limit=12`),
      unavailable: false,
    };
  } catch {
    return { data: null, unavailable: true };
  }
}

function ReportCard({ report }: { report: PublicReportCard }) {
  return (
    <article className="surface-card">
      <div className="article-card-top">
        <span className="article-meta">کنکور {degreeLabel(report.degree)} {toPersianDigits(report.examYear)}</span>
        <span>{toPersianDigits(report.quota)}</span>
      </div>
      <h2>{toPersianDigits(report.field)}</h2>
      <p>
        رتبهٔ {formatPersianNumber(report.rank.value)} {rankScopeLabel(report.rank.scope)}
      </p>
      {report.subjectScores.length > 0 && (
        <div className="responsive-table">
          <table>
            <thead><tr><th>درس</th><th>درصد</th></tr></thead>
            <tbody>
              {report.subjectScores.map((score) => (
                <tr key={score.subject_code}>
                  <td>{toPersianDigits(score.subject_code)}</td>
                  <td>{formatPersianNumber(score.percent, { maximumFractionDigits: 2 })}٪</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.admissions.length > 0 && (
        <div className="subject-tags" aria-label="نتیجه‌های انتخاب رشته">
          {report.admissions.map((admission) => (
            <span key={`${admission.program_code}-${admission.status}`}>
              {toPersianDigits(admission.program_code)}: {admissionStatusLabel(admission.status)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function ReportCardsPage({ searchParams }: { searchParams: { page?: string | string[] } }) {
  const page = requestedPage(searchParams.page);
  const result = await loadReportCards(page);
  const path = "/report-cards";
  const breadcrumbs = [{ name: "خانه", href: "/" }, { name: "کارنامه‌ها" }];

  if (result.unavailable) {
    return <main className="page-container"><PublicServiceError label="بانک کارنامه" /></main>;
  }
  const data = result.data ?? { items: [], page, limit: 12, total: 0, totalPages: 0 };
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
      includedInDataCatalog: {
        "@type": "DataCatalog",
        name: "مستندات کنکورصفریک",
        url: absoluteUrl("/report-cards"),
      },
      variableMeasured: ["سال آزمون", "مقطع", "رشته", "سهمیه", "درصد درس‌ها", "رتبه", "نتیجهٔ پذیرش"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.href ?? "/report-cards"),
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
        description="فقط کارنامه‌هایی نمایش داده می‌شوند که رضایت انتشارشان ثبت شده است؛ هیچ شناسهٔ فردی، فایل منبع یا provenance خصوصی در این صفحه وجود ندارد."
      />
      <aside className="official-disclaimer">
        <strong>نحوهٔ خواندن داده‌ها</strong>
        <p>این نمونه‌ها تضمین رتبه یا قبولی مشابه نیستند. سال آزمون، سهمیه و حجم نمونه را هنگام مقایسه در نظر بگیرید.</p>
      </aside>

      {data.items.length === 0 ? (
        <EmptyState
          title={page > 1 ? "در این صفحه کارنامه‌ای نیست" : "هنوز کارنامهٔ عمومی ثبت نشده است"}
          description="کارنامه فقط پس از ثبت رضایت انتشار به این مجموعه افزوده می‌شود."
          action={page > 1 ? <Link className="button button-secondary" href="/report-cards">بازگشت به صفحهٔ اول</Link> : undefined}
        />
      ) : (
        <>
          <div className="stats-grid" aria-label="خلاصهٔ مجموعه">
            <StatCard label="کارنامهٔ عمومی" value={formatPersianNumber(data.total)} detail="دارای رضایت ثبت‌شده" />
            <StatCard label="صفحهٔ فعلی" value={toPersianDigits(data.page)} detail={`از ${toPersianDigits(data.totalPages)}`} tone="blue" />
          </div>
          <section className="content-grid-wide" aria-label="فهرست کارنامه‌های عمومی">
            {data.items.map((report, index) => <ReportCard report={report} key={`${report.examYear}-${report.field}-${report.rank.value}-${index}`} />)}
          </section>
          {data.totalPages > 1 && (
            <nav className="page-header-action" aria-label="صفحه‌بندی کارنامه‌ها">
              {data.page > 1 && (
                <Link className="button button-secondary" href={data.page === 2 ? "/report-cards" : `/report-cards?page=${data.page - 1}`}>
                  صفحهٔ قبل
                </Link>
              )}
              {data.page < data.totalPages && (
                <Link className="button button-secondary" href={`/report-cards?page=${data.page + 1}`}>
                  صفحهٔ بعد
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
