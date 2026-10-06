export type CourseAccessMode = "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";

export interface CourseInstructor {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  roleTitle?: string | null;
}

export interface CatalogCourse {
  slug: string;
  title: string;
  description: string;
  accessMode?: CourseAccessMode;
  subject?: { code: string; title: string } | null;
  instructors?: CourseInstructor[];
  moduleCount?: number;
  lessonCount?: number;
  previewCount?: number;
  /** Total length in minutes, set by the admin. */
  durationMinutes?: number | null;
  hasVideo?: boolean;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: "COURSE" | "RESOURCE" | "BUNDLE";
  prices?: { amountRial: number }[];
  courseGrants?: { course: { slug: string } }[];
  resourceGrants?: { resource: { slug: string } }[];
}

export interface CourseCatalogItem {
  course: CatalogCourse;
  product: CatalogProduct | null;
  href: string;
  accessLabel: string;
  priceLabel: string;
  /** Whether priceLabel is an amount, rather than a state such as «به‌زودی». */
  hasPrice: boolean;
  ctaLabel: string;
}

export function formatRial(amountRial: number) {
  return `${amountRial.toLocaleString("fa-IR")} ریال`;
}

export function findDirectCourseProduct(products: CatalogProduct[], courseSlug: string) {
  return products.find((product) => (
    product.kind === "COURSE" &&
    product.courseGrants?.some((grant) => grant.course.slug === courseSlug)
  )) ?? null;
}

/** A lesson-by-lesson course, or a course that works through past exam questions. */
export function courseFormat(course: Pick<CatalogCourse, "slug" | "title">): "درس‌نامه" | "حل تست" {
  return /-tests?$/.test(course.slug) || course.title.startsWith("حل تست") ? "حل تست" : "درس‌نامه";
}

/** «ساختمان داده و الگوریتم: درس‌نامهٔ کنکور…» → the part before the colon. */
export function courseShortTitle(title: string) {
  return title.split(/[:：]/)[0].trim();
}

export function buildCourseCatalog(
  courses: CatalogCourse[],
  products: CatalogProduct[],
  productCatalogUnavailable = false,
): CourseCatalogItem[] {
  return courses.map((course) => {
    const accessMode = course.accessMode ?? "ENTITLEMENT";
    const product = accessMode === "ENTITLEMENT" ? findDirectCourseProduct(products, course.slug) : null;
    const amountRial = product?.prices?.[0]?.amountRial;

    if (accessMode === "PUBLIC") {
      return {
        course,
        product,
        href: `/courses/${course.slug}`,
        accessLabel: "دورهٔ رایگان",
        priceLabel: "رایگان",
        hasPrice: true,
        ctaLabel: "شروع دورهٔ رایگان",
      };
    }

    if (accessMode === "ACCOUNT") {
      return {
        course,
        product,
        href: `/courses/${course.slug}`,
        accessLabel: "ویژهٔ اعضا",
        priceLabel: "رایگان با حساب کاربری",
        hasPrice: true,
        ctaLabel: "مشاهده و شروع دوره",
      };
    }

    return {
      course,
      product,
      href: `/courses/${course.slug}`,
      accessLabel: "دورهٔ تخصصی",
      priceLabel: typeof amountRial === "number"
        ? formatRial(amountRial)
        : productCatalogUnavailable
          ? "قیمت موقتاً در دسترس نیست"
          : "فروش به‌زودی",
      hasPrice: typeof amountRial === "number",
      ctaLabel: product ? "مشاهده و تهیهٔ دوره" : "مشاهدهٔ سرفصل‌ها",
    };
  });
}
