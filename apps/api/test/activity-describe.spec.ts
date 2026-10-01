import { ProductKind, ResourceKind, ReviewStatus } from "@prisma/client";
import { describeSale, productHref } from "../src/modules/site/activity.service";

const resource = (title: string, kind: ResourceKind = ResourceKind.NOTE, reviewStatus: ReviewStatus = ReviewStatus.PUBLISHED) => ({
  resource: { slug: `r-${title}`, title, kind, reviewStatus },
});
const course = (title: string, isPublished = true) => ({ slug: `c-${title}`, title, isPublished });
const base = { title: "Course", kind: ProductKind.RESOURCE, course: null, courseGrants: [], resourceGrants: [] };

describe("activity notices name what was actually bought", () => {
  it("names a handout by the handout, not by the product's own title", () => {
    const product = { ...base, resourceGrants: [resource("سیستم عامل")] };
    expect(describeSale(product)).toEqual({ noun: "جزوهٔ", name: "سیستم عامل" });
    expect(productHref(product)).toBe("/resources/r-سیستم عامل");
  });

  it("names a video as a video and an answer key as a resource", () => {
    expect(describeSale({ ...base, resourceGrants: [resource("جلسهٔ ۱", ResourceKind.VIDEO)] }).noun).toBe("ویدیوی");
    expect(describeSale({ ...base, resourceGrants: [resource("پاسخنامه", ResourceKind.ANSWER_KEY)] }).noun).toBe("منبع");
  });

  it("names a course by the course, whether it is attached directly or by grant", () => {
    const direct = { ...base, kind: ProductKind.COURSE, course: course("الگوریتم") };
    expect(describeSale(direct)).toEqual({ noun: "دورهٔ", name: "الگوریتم" });
    expect(productHref(direct)).toBe("/courses/c-الگوریتم");
    const granted = { ...base, kind: ProductKind.COURSE, courseGrants: [{ course: course("ساختمان داده") }] };
    expect(describeSale(granted)).toEqual({ noun: "دورهٔ", name: "ساختمان داده" });
    const both = { ...base, kind: ProductKind.COURSE, course: course("الگوریتم"), courseGrants: [{ course: course("الگوریتم") }] };
    expect(describeSale(both)).toEqual({ noun: "دورهٔ", name: "الگوریتم" });
  });

  it("calls a product that opens several things a package, under its own title", () => {
    const product = { ...base, title: "بستهٔ ارشد", kind: ProductKind.BUNDLE, course: course("الگوریتم"), resourceGrants: [resource("سیستم عامل")] };
    expect(describeSale(product)).toEqual({ noun: "بستهٔ", name: "بستهٔ ارشد" });
  });

  it("ignores a resource that is not published, falling back to the product title", () => {
    const product = { ...base, title: "جزوه", resourceGrants: [resource("پیش‌نویس", ResourceKind.NOTE, ReviewStatus.DRAFT)] };
    expect(describeSale(product)).toEqual({ noun: null, name: "جزوه" });
    expect(productHref(product)).toBe("/courses");
  });

  it("keeps consultations and question banks under their own titles", () => {
    expect(describeSale({ ...base, title: "مشاورهٔ سالانه", kind: ProductKind.CONSULTATION })).toEqual({ noun: null, name: "مشاورهٔ سالانه" });
    expect(describeSale({ ...base, title: "بانک سؤال الگوریتم", kind: ProductKind.QUESTION_BANK })).toEqual({ noun: null, name: "بانک سؤال الگوریتم" });
  });
});
