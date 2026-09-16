export type CourseAccessMode = "PUBLIC" | "ACCOUNT" | "ENTITLEMENT";

export interface CatalogCourse {
  slug: string;
  title: string;
  description: string;
  accessMode?: CourseAccessMode;
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
        ctaLabel: "شروع دورهٔ رایگان ←",
      };
    }

    if (accessMode === "ACCOUNT") {
      return {
        course,
        product,
        href: `/courses/${course.slug}`,
        accessLabel: "ویژهٔ اعضا",
        priceLabel: "با حساب کاربری",
        ctaLabel: "مشاهده و شروع دوره ←",
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
          : "دسترسی در حال آماده‌سازی",
      ctaLabel: product ? "مشاهده و تهیهٔ دوره ←" : "مشاهدهٔ جزئیات دوره ←",
    };
  });
}
