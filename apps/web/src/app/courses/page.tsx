import type { Metadata } from "next";
import Link from "next/link";
import { apiGetPublic } from "../../lib/api";
import { ComingSoon } from "../../components/ComingSoon";
import { CourseCard } from "../../components/CourseCard";
import { Glyph, type GlyphName } from "../../components/SubjectIcon";
import { EmptyState } from "../../components/ui";
import { toPersianDigits } from "../../lib/format";
import { pageMetadata } from "../../lib/seo";
import "./course.css";
import {
  buildCourseCatalog,
  courseFormat,
  type CatalogCourse,
  type CatalogProduct,
  type CourseCatalogItem,
} from "./catalog";
import { courseSubject, courseSubjectTitle } from "./course-visual";

async function loadCatalog() {
  let courses: CatalogCourse[] | null;
  try {
    courses = await apiGetPublic<CatalogCourse[]>("/courses");
  } catch {
    return { courses: null, products: [], unavailable: true, productCatalogUnavailable: true };
  }

  if (!courses) {
    return { courses: null, products: [], unavailable: true, productCatalogUnavailable: true };
  }

  try {
    const products = await apiGetPublic<CatalogProduct[]>("/products");
    return {
      courses,
      products: products ?? [],
      unavailable: false,
      productCatalogUnavailable: products === null,
    };
  } catch {
    return { courses, products: [], unavailable: false, productCatalogUnavailable: true };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const result = await loadCatalog();
  return pageMetadata({
    title: "دوره‌های کنکور ارشد و دکتری کامپیوتر",
    description: "دوره‌های منتشرشدهٔ کنکور کامپیوتر با مسیر یادگیری و دسترسی روشن برای داوطلبان کنکور کامپیوتر.",
    path: "/courses",
    // A catalog with nothing in it yet is a "coming soon" page, not one to rank.
    noIndex: result.unavailable || result.courses?.length === 0,
  });
}

/** How one subject is learnt here, from first lesson to a ranked exam. */
const FLOW: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "book", title: "درس‌نامه", text: "مفهوم را از پایه بساز" },
  { icon: "target", title: "حل تست", text: "روی سؤال‌های کنکور محکش بزن" },
  { icon: "list", title: "بانک سؤال", text: "با تمرین بیشتر جا بینداز" },
  { icon: "trophy", title: "آزمون و کارنامه", text: "بسنج و رتبه‌ات را تخمین بزن" },
];

/** What every paid course comes with, as the course page lists it. */
const INCLUDED: { icon: GlyphName; title: string; text: string }[] = [
  { icon: "play", title: "درس‌به‌درس، با ویدیو", text: "از مفهوم پایه تا تست کنکور، به ترتیب فصل." },
  { icon: "spark", title: "نمونهٔ رایگان", text: "چند درس هر دوره پیش از خرید برای همه آزاد است." },
  { icon: "book", title: "جزوه به نام خودت", text: "جزوه‌های دوره در پنلت، نسخه‌ای با نام و شمارهٔ خودت." },
  { icon: "flag", title: "ادامه از همان‌جا", text: "پیشرفتت ذخیره می‌شود و از آخرین درس ادامه می‌دهی." },
];

interface Shelf {
  key: string;
  title: string | null;
  items: CourseCatalogItem[];
}

/** Courses of one subject side by side: the lesson course first, then its test course. */
function shelvesOf(items: CourseCatalogItem[]): Shelf[] {
  const shelves = new Map<string, Shelf>();
  for (const item of items) {
    const key = courseSubject(item.course) ?? item.course.slug;
    const shelf = shelves.get(key) ?? { key, title: courseSubjectTitle(item.course), items: [] };
    shelf.items.push(item);
    shelves.set(key, shelf);
  }
  for (const shelf of shelves.values()) {
    shelf.items.sort((a, b) => Number(courseFormat(a.course) === "حل تست") - Number(courseFormat(b.course) === "حل تست"));
  }
  return [...shelves.values()];
}

export default async function CoursesPage() {
  const result = await loadCatalog();
  const catalog = result.courses
    ? buildCourseCatalog(result.courses, result.products, result.productCatalogUnavailable)
    : null;
  const shelves = catalog ? shelvesOf(catalog) : [];

  return (
    <main className="cl">
      <header className="cl-hero">
        <div className="cl-wrap cl-hero-inner">
          <div>
          <p className="cl-kicker">دوره‌های کنکور کامپیوتر</p>
          <h1>دوره‌های کامل، از پایه تا تست کنکور</h1>
          <p className="cl-lede">
            دوره‌ها دو نوع‌اند: <b>درس‌نامه</b> که مفهوم را از پایه می‌سازد، و <b>حل تست</b> که همان مفهوم را روی سؤال‌های کنکور
            محک می‌زند.
          </p>
          {catalog && catalog.length > 0 && (
            <p className="cl-count">
              <span>{toPersianDigits(catalog.length)} دوره</span>
              <span>{toPersianDigits(shelves.length)} درس</span>
            </p>
          )}
          </div>
          <ol className="cl-flow" aria-label="مسیر یادگیری هر درس">
            {FLOW.map((step) => (
              <li key={step.title}>
                <span className="cl-flow-icon"><Glyph name={step.icon} /></span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.text}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <section className="cl-wrap cl-sec" aria-label="فهرست دوره‌ها">
        {!catalog ? (
          <EmptyState
            title="فهرست دوره‌ها در دسترس نیست"
            description="اتصال به سرویس محتوا برقرار نشد؛ بعداً دوباره امتحان کن."
          />
        ) : catalog.length === 0 ? (
          <ComingSoon
            icon="play"
            title="دوره‌های کامل به‌زودی منتشر می‌شوند"
            text="کلاس‌های درس‌به‌درس کنکور کامپیوتر، از مفهوم تا تست کنکور، در حال آماده‌سازی برای سایت‌اند. تا آن موقع، نقشهٔ درس‌ها و راهنمای ۱۴۰۶ در دسترس است."
            alternatives={[
              { href: "/subjects", label: "نقشهٔ درس‌ها" },
              { href: "/articles/study-plan-from-zero", label: "شروع از صفر" },
              { href: "/evidence", label: "مستندات تدریس" },
            ]}
          />
        ) : (
          <div className="cl-shelves">
            {shelves.map((shelf) => (
              <section className="cl-shelf" key={shelf.key} aria-label={shelf.title ?? undefined}>
                {shelf.title && shelves.length > 1 && (
                  <h2 className="cl-shelf-title">
                    {shelf.title}
                    <small>{toPersianDigits(shelf.items.length)} دوره</small>
                  </h2>
                )}
                <div className="cl-grid">
                  {shelf.items.map((item) => (
                    <CourseCard item={item} key={item.course.slug} headingLevel={shelf.title && shelves.length > 1 ? 3 : 2} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {catalog && catalog.length > 0 && (
        <section className="cl-included" aria-labelledby="cl-included-title">
          <div className="cl-wrap">
            <h2 id="cl-included-title">هر دوره با خودش چه می‌آورد</h2>
            <ul>
              {INCLUDED.map((row) => (
                <li key={row.title}>
                  <span className="cl-included-icon"><Glyph name={row.icon} /></span>
                  <strong>{row.title}</strong>
                  <p>{row.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="cl-wrap cl-help" aria-labelledby="cl-help-title">
        <div>
          <h2 id="cl-help-title">نمی‌دانی از کدام دوره شروع کنی؟</h2>
          <p>اگر پایه‌ات ضعیف است از درس‌نامه شروع کن؛ اگر مفهوم را بلدی و سرعت تست کم داری، حل تست. برنامهٔ کامل را در راهنمای شروع از صفر نوشته‌ایم.</p>
        </div>
        <div className="cl-help-actions">
          <Link className="ds-btn ds-btn-primary" href="/articles/study-plan-from-zero">شروع از صفر</Link>
          <Link className="ds-btn ds-btn-secondary" href="/consultations">مشاوره</Link>
        </div>
      </section>
    </main>
  );
}
