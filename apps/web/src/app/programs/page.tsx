import type { Metadata } from "next";
import Link from "next/link";
import { AdmissionsJourney } from "../../components/AdmissionsJourney";
import { ComingSoon } from "../../components/ComingSoon";
import { PublicServiceError } from "../../components/PublicContent";
import { StructuredData } from "../../components/StructuredData";
import { apiGetPublic } from "../../lib/api";
import { EXAM_SETS } from "../../lib/admissions";
import { formatPersianNumber, toPersianDigits } from "../../lib/format";
import { absoluteUrl, pageMetadata } from "../../lib/seo";
import { ChoiceFinder, type CatalogRow, type FinderFilters } from "./ChoiceFinder";
import "./admissions.css";

type SearchParams = Record<string, string | string[] | undefined>;

interface PublicSource {
  title: string;
  publisher: string;
  canonicalUrl: string;
  checkedAt: string;
}

interface Catalog {
  examYear: number | null;
  source: PublicSource | null;
  programs: {
    id: string;
    code: string;
    title: string;
    examSetCode: string | null;
    coefficientGroup: number | null;
    orientation: string | null;
    period: CatalogRow["period"] | null;
    location: string | null;
    city: string | null;
    gender: CatalogRow["gender"];
    university: { code: string; title: string };
    selectionCode: string | null;
    capacity: number;
    notes: string | null;
  }[];
}

async function loadCatalog() {
  try {
    return { catalog: await apiGetPublic<Catalog>("/admissions/catalog?degree=master"), unavailable: false };
  } catch {
    return { catalog: null, unavailable: true };
  }
}

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) ?? "";

function filtersFrom(searchParams: SearchParams): FinderFilters {
  return {
    set: first(searchParams.set),
    group: first(searchParams.group),
    orientation: first(searchParams.o),
    periods: first(searchParams.period).split(",").filter(Boolean),
    city: first(searchParams.city),
    gender: first(searchParams.gender),
    query: first(searchParams.q),
    sort: first(searchParams.sort),
  };
}

export async function generateMetadata({ searchParams: pending }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const searchParams = await pending;
  const { catalog, unavailable } = await loadCatalog();
  // One indexable page: a filtered view is the same list.
  const noIndex = Object.keys(searchParams).length > 0 || unavailable || !catalog?.programs.length;
  const year = catalog?.examYear ? toPersianDigits(catalog.examYear) : "";
  return {
    ...pageMetadata({
      title: `ابزار انتخاب رشتهٔ ارشد کامپیوتر${year ? ` با ظرفیت‌های ${year}` : ""}`,
      description: "همهٔ کدهای رشته‌محل ارشد مهندسی کامپیوتر، IT و علوم کامپیوتر از دفترچهٔ انتخاب رشته: فیلتر بر اساس گرایش، دوره، شهر و جنسیت، و ساختن فهرست انتخاب‌ها به ترتیب.",
      path: "/programs",
      noIndex,
    }),
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ProgramsPage({ searchParams: pending }: { searchParams: Promise<SearchParams> }) {
  const searchParams = await pending;
  const { catalog, unavailable } = await loadCatalog();

  if (unavailable || !catalog) {
    return (
      <main className="page-container">
        <PublicServiceError label="فهرست رشته‌محل‌ها" />
      </main>
    );
  }

  const rows: CatalogRow[] = catalog.programs
    // Sets the site has labels for; a new set (PhD, say) needs its entry in EXAM_SETS.
    .filter((program) => EXAM_SETS.some((set) => set.code === program.examSetCode) && program.period && program.selectionCode)
    .map((program) => ({
      id: program.id,
      code: program.code,
      set: program.examSetCode!,
      group: program.coefficientGroup ?? 0,
      orientation: program.orientation ?? program.title,
      period: program.period!,
      university: program.university.title,
      universityCode: program.university.code,
      city: program.city ?? "",
      location: program.location ?? "",
      gender: program.gender,
      capacity: program.capacity,
      selectionCode: program.selectionCode!,
      notes: program.notes ?? "",
    }));
  const year = catalog.examYear ?? 0;
  const totalSeats = rows.reduce((sum, row) => sum + row.capacity, 0);

  return (
    <main className="af-page">
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "ابزار انتخاب رشتهٔ ارشد کامپیوتر",
            url: absoluteUrl("/programs"),
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            inLanguage: "fa-IR",
            offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
          },
        ]}
      />
      <header className="af-hero">
        <div className="af-wrap">
          <span className="af-eyebrow">انتخاب رشتهٔ ارشد</span>
          <h1>ابزار انتخاب رشتهٔ ارشد کامپیوتر</h1>
          {rows.length > 0 ? (
            <>
              <p>
                {formatPersianNumber(rows.length)} کد رشته‌محل و {formatPersianNumber(totalSeats)} ظرفیت از دفترچهٔ انتخاب رشتهٔ {toPersianDigits(year)}.
                گرایش، دوره و شهر را فیلتر کن، کدها را به فهرستت اضافه کن و به ترتیب دلخواه بچین.
              </p>
              <ul className="af-hero-facts">
                <li><b>{formatPersianNumber(rows.length)}</b> کد رشته‌محل</li>
                <li><b>{formatPersianNumber(new Set(rows.map((row) => row.university)).size)}</b> دانشگاه و مؤسسه</li>
                <li><b>{formatPersianNumber(totalSeats)}</b> ظرفیت</li>
              </ul>
            </>
          ) : (
            <p>کدهای رشته‌محل هر سال با منبع رسمی سازمان سنجش اینجا می‌آیند.</p>
          )}
        </div>
      </header>

      <div className="af-wrap af-body">
        {rows.length === 0 ? (
          <ComingSoon
            icon="building"
            title="کدهای رشته‌محل به‌زودی"
            text="هر رشته‌محل فقط با منبع رسمی سازمان سنجش اینجا می‌آید."
            alternatives={[
              { href: "/articles/master-computer-engineering-capacity-1405", label: "ظرفیت ارشد مهندسی کامپیوتر ۱۴۰۵" },
              { href: "/articles/admitted-ranks-by-university", label: "رتبهٔ قبولی هر دانشگاه" },
            ]}
          />
        ) : (
          <>
            <aside className="af-caution">
              <strong>کدهای {toPersianDigits(year)}</strong>
              <p>
                کد رشته‌محل‌ها و ظرفیت‌ها از دفترچهٔ انتخاب رشتهٔ {toPersianDigits(year)} است. سازمان سنجش هر سال کدها را از نو شماره‌گذاری می‌کند؛
                فهرستت را برای برنامه‌ریزی بساز و وقتی دفترچهٔ سال بعد آمد، کدهای تازه همین‌جا جایگزین می‌شوند. ملاک نهایی، دفترچه و اصلاحیه‌های سازمان سنجش است.
              </p>
            </aside>
            <ChoiceFinder rows={rows} year={year} initial={filtersFrom(searchParams)} />
            {catalog.source && (
              <p className="af-source">
                منبع: <a href={catalog.source.canonicalUrl} target="_blank" rel="noreferrer">{catalog.source.title}</a>، {catalog.source.publisher}.
                {" "}برای رقابت هر رشته‌محل، <Link href="/articles/admitted-ranks-by-university">رتبه‌های قبولی سال‌های قبل</Link> را هم ببین.
              </p>
            )}
          </>
        )}
        <AdmissionsJourney current="programs" />
      </div>
    </main>
  );
}
