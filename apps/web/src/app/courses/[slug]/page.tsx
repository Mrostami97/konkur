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
import { Glyph, SubjectGlyph } from "../../../components/SubjectIcon";
import { courseFormat, courseShortTitle, findDirectCourseProduct, formatRial, type CatalogProduct, type CourseInstructor } from "../catalog";
import { courseSubject, courseSubjectTitle, courseTone } from "../course-visual";
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
  subject?: { code: string; title: string } | null;
  instructors?: CourseInstructor[];
  modules: CourseModule[];
  /** Handouts that come with the course; read in the student panel. */
  materials?: { slug: string; title: string; summary: string }[];
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

export async function generateMetadata({ params: pendingParams }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await pendingParams;
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

export default async function CoursePage({ params: pendingParams }: { params: Promise<{ slug: string }> }) {
  const params = await pendingParams;
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
  const materials = course.materials ?? [];
  const instructors = course.instructors ?? [];
  const subject = courseSubject(course);
  const subjectTitle = courseSubjectTitle(course);
  const firstLessonId = lessons[0]?.id;
  const previewCount = lessons.filter((lesson) => lesson.isPreview).length;
  const firstPreviewId = lessons.find((lesson) => lesson.isPreview)?.id;
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
    <main className="cr" data-tone={courseTone(course)}>
      <StructuredData data={schemas} />

      <header className="cr-top cr-hero" data-tone={courseTone(course)}>
        <div className="cr-wrap cr-hero-inner">
          <div className="cr-hero-text">
            <nav className="cr-crumbs" aria-label="مسیر صفحه">
              <Link href="/courses">دوره‌ها</Link>
              <span aria-hidden="true">/</span>
              <span>{courseShortTitle(course.title)}</span>
            </nav>
            <p className="cr-kicker">
              {courseFormat(course)}
              {subjectTitle ? ` · ${subjectTitle}` : ""}
              {accessMode !== "ENTITLEMENT" ? ` · ${ACCESS_LABEL[accessMode]}` : ""}
            </p>
            <h1>{course.title}</h1>
            <p className="cr-lede">{course.description}</p>
            <ul className="cr-facts">
              <li><Glyph name="list" />{toPersianDigits(course.modules.length)} فصل</li>
              <li><Glyph name="play" />{toPersianDigits(lessons.length)} درس</li>
              {previewCount > 0 && <li className="cr-fact-free"><Glyph name="spark" />{toPersianDigits(previewCount)} درس نمونهٔ رایگان</li>}
              {materials.length > 0 && <li><Glyph name="book" />{toPersianDigits(materials.length)} جزوه</li>}
            </ul>
            {instructors.length > 0 && (
              <div className="cr-teachers">
                {instructors.map((person) => (
                  <Link key={person.slug} href={`/authors/${person.slug}`} className="cr-teacher">
                    {person.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={person.avatarUrl} alt="" width={44} height={44} />
                    ) : (
                      <span className="cr-teacher-initial" aria-hidden="true">{person.displayName.slice(0, 1)}</span>
                    )}
                    <span>
                      <small>مدرس</small>
                      <strong>{person.displayName}</strong>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="cr-hero-art" aria-hidden="true">
            <span className="cr-hero-ring" />
            {subject ? <SubjectGlyph slug={subject} className="cr-hero-glyph" /> : <Glyph name="book" className="cr-hero-glyph" />}
          </div>
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

          {materials.length > 0 && (
            <section className="cr-handouts" aria-labelledby="cr-handouts-title">
              <h2 id="cr-handouts-title">جزوه‌های دوره</h2>
              <p className="cr-handouts-note">با تهیهٔ دوره، این جزوه‌ها هم در پنلت باز می‌شوند؛ نسخه‌ای به نام خودت، بدون هزینهٔ اضافه.</p>
              <ul>
                {materials.map((material) => (
                  <li key={material.slug}>
                    <Link href={`/resources/${material.slug}`} className="cr-handout">
                      <span className="cr-handout-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
                      </span>
                      <span className="cr-handout-text">
                        <strong>{material.title}</strong>
                        <small>{material.summary}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
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
                {/* The free sample lessons, open without buying or signing in. */}
                {firstPreviewId && (
                  <Link className="ds-btn ds-btn-secondary cr-cta" href={`/lessons/${firstPreviewId}`}>
                    تماشای نمونهٔ رایگان
                  </Link>
                )}
                <ul className="cr-includes">
                  <li>همهٔ درس‌های دوره، به ترتیب فصل</li>
                  <li>بانک سؤال همین درس، بدون هزینهٔ اضافه</li>
                  {materials.length > 0 && <li>{toPersianDigits(materials.length)} جزوهٔ دوره، برای مطالعه در پنل</li>}
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
