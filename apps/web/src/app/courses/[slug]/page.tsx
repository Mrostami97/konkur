import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetPublic } from "../../../lib/api";
import { toPersianDigits } from "../../../lib/format";
import { BuyButton } from "../../../components/BuyButton";
import { VideoLicensePanel } from "../../../components/VideoLicensePanel";
import { CourseProgressPanel } from "../../../components/CourseProgressPanel";
import { StructuredData } from "../../../components/StructuredData";
import { absoluteUrl, pageMetadata } from "../../../lib/seo";
import { findDirectCourseProduct, formatRial, type CatalogProduct } from "../catalog";
import "../course.css";

interface Lesson {
  id: string;
  title: string;
  order: number;
  isPreview?: boolean;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  accessMode?: "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";
  modules: CourseModule[];
}

async function loadCourse(slug: string) {
  try {
    return {
      course: await apiGetPublic<Course>(`/courses/${encodeURIComponent(slug)}`),
      unavailable: false,
    };
  } catch {
    return { course: null, unavailable: true };
  }
}

async function loadCourseProduct(courseSlug: string) {
  try {
    const products = await apiGetPublic<CatalogProduct[]>("/products");
    return {
      product: findDirectCourseProduct(products ?? [], courseSlug),
      unavailable: products === null,
    };
  } catch {
    return { product: null, unavailable: true };
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const result = await loadCourse(params.slug);
  if (!result.course) {
    return pageMetadata({
      title: result.unavailable ? "سرویس دوره‌ها موقتاً در دسترس نیست" : "دوره پیدا نشد",
      description: result.unavailable
        ? "دریافت اطلاعات دوره اکنون ممکن نیست؛ لطفاً کمی بعد دوباره تلاش کنید."
        : "دورهٔ درخواستی پیدا نشد.",
      path: `/courses/${params.slug}`,
      noIndex: true,
    });
  }
  return pageMetadata({ title: result.course.title, description: result.course.description, path: `/courses/${result.course.slug}` });
}

const ACCESS_LABEL = { PUBLIC: "دورهٔ رایگان", ACCOUNT: "ویژهٔ اعضا", ENTITLEMENT: "دورهٔ تخصصی" } as const;

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const courseResult = await loadCourse(params.slug);
  if (!courseResult.course) {
    if (courseResult.unavailable) throw new Error("Public learning service is unavailable");
    notFound();
  }
  const course = courseResult.course;
  const accessMode = course.accessMode ?? "ENTITLEMENT";
  const productResult = accessMode === "ENTITLEMENT"
    ? await loadCourseProduct(course.slug)
    : { product: null, unavailable: false };
  const product = productResult.product;
  const path = `/courses/${course.slug}`;
  const lessons = course.modules.flatMap((module) => module.lessons);
  const firstLessonId = lessons[0]?.id;
  const previewCount = lessons.filter((lesson) => lesson.isPreview).length;
  const purchasableProduct = accessMode === "ENTITLEMENT" ? product : null;
  const schemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: course.title,
      description: course.description,
      url: absoluteUrl(path),
      provider: { "@id": absoluteUrl("/#organization") },
      inLanguage: "fa-IR",
      ...(purchasableProduct?.prices?.[0] ? { offers: { "@type": "Offer", price: purchasableProduct.prices[0].amountRial, priceCurrency: "IRR", url: absoluteUrl(path) } } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "خانه", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "دوره‌ها", item: absoluteUrl("/courses") },
        { "@type": "ListItem", position: 3, name: course.title, item: absoluteUrl(path) },
      ],
    },
  ];

  let lessonNumber = 0;

  return (
    <main className="cr">
      <StructuredData data={schemas} />

      <header className="cr-top">
        <div className="cr-wrap">
          <nav className="cr-crumbs" aria-label="مسیر صفحه">
            <Link href="/courses">دوره‌ها</Link>
            <span aria-hidden="true">/</span>
            <span>{course.title}</span>
          </nav>
          <p className="cr-kicker">{ACCESS_LABEL[accessMode]}</p>
          <h1>{course.title}</h1>
          <p className="cr-lede">{course.description}</p>
          <p className="cr-facts">
            <span>{toPersianDigits(course.modules.length)} فصل</span>
            <span>{toPersianDigits(lessons.length)} درس</span>
            {previewCount > 0 && <span>{toPersianDigits(previewCount)} درس نمونهٔ آزاد</span>}
          </p>
        </div>
      </header>

      <div className="cr-wrap cr-layout">
        {/* ----------------------------------------------------- curriculum */}
        <section className="cr-main" aria-labelledby="cr-outline-title">
          <h2 id="cr-outline-title">سرفصل‌ها</h2>
          {course.modules.length === 0 ? (
            <p className="cr-empty">سرفصل‌ها بعد از انتشار درس‌ها همین‌جا می‌آیند.</p>
          ) : (
            <ol className="cr-outline">
              {course.modules.map((module, moduleIndex) => (
                <li className="cr-module" key={module.id}>
                  <div className="cr-module-head">
                    <span className="cr-module-n" aria-hidden="true">{toPersianDigits(moduleIndex + 1)}</span>
                    <div>
                      <h3>{module.title}</h3>
                      <small>{toPersianDigits(module.lessons.length)} درس</small>
                    </div>
                  </div>
                  {module.lessons.length === 0 ? (
                    <p className="cr-empty">درسی در این فصل منتشر نشده است.</p>
                  ) : (
                    <ul className="cr-lessons">
                      {module.lessons.map((lesson) => {
                        lessonNumber += 1;
                        return (
                          <li key={lesson.id}>
                            <Link href={`/lessons/${lesson.id}`} className="cr-lesson">
                              <span className="cr-lesson-n tnum" aria-hidden="true">{toPersianDigits(lessonNumber)}</span>
                              <span className="cr-lesson-title">{lesson.title}</span>
                              {lesson.isPreview && <span className="cr-free">نمونهٔ آزاد</span>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* -------------------------------------------------------- access */}
        <aside className="cr-aside" aria-label="دسترسی و پیشرفت">
          <div className="cr-buy">
            {accessMode === "ENTITLEMENT" ? (
              <>
                {purchasableProduct?.prices?.[0] && (
                  <p className="cr-price tnum">{formatRial(purchasableProduct.prices[0].amountRial)}</p>
                )}
                {productResult.unavailable ? (
                  <p className="cr-note">اطلاعات خرید موقتاً در دسترس نیست؛ کمی بعد دوباره سر بزن.</p>
                ) : purchasableProduct ? (
                  <BuyButton productId={purchasableProduct.id} />
                ) : (
                  <p className="cr-note">فروش این دوره هنوز باز نشده است.</p>
                )}
                <ul className="cr-includes">
                  <li>همهٔ درس‌های دوره، به ترتیب فصل</li>
                  <li>بانک سؤال همین درس، بدون هزینهٔ اضافه</li>
                  <li>ثبت پیشرفت و ادامه از آخرین درس</li>
                </ul>
              </>
            ) : firstLessonId ? (
              <>
                <p className="cr-price">{accessMode === "PUBLIC" ? "رایگان" : "با حساب کاربری"}</p>
                <Link className="ds-btn ds-btn-primary cr-cta" href={`/lessons/${firstLessonId}`}>
                  {accessMode === "ACCOUNT" ? "ورود و شروع دوره" : "شروع از درس اول"}
                </Link>
              </>
            ) : (
              <p className="cr-note">هنوز درسی برای این دوره منتشر نشده است.</p>
            )}
          </div>
          <CourseProgressPanel courseSlug={course.slug} firstLessonId={firstLessonId} />
          <VideoLicensePanel courseId={course.id} />
        </aside>
      </div>
    </main>
  );
}
