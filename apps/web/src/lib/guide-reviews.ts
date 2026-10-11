import type { EditorialPage } from "../content/editorial";
import { apiGetPublic } from "./api";

export interface GuideReview {
  slug: string;
  reviewerName: string;
  reviewedAt: string;
}

/** The owner's sign-offs on static guides; none when the API cannot be reached. */
export async function loadGuideReviews(): Promise<Map<string, GuideReview>> {
  try {
    const reviews = await apiGetPublic<GuideReview[]>("/guide-reviews");
    return new Map((reviews ?? []).map((review) => [review.slug, review]));
  } catch {
    return new Map();
  }
}

/** A Jalali date in the guides' own "۱۴۰۵-۰۷-۱۹" form. */
export function jalaliDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** A static guide as its sign-off leaves it: the reviewer and the date they read it. */
export function withReview<T extends EditorialPage>(page: T, review: GuideReview | undefined): T {
  if (!review) return page;
  return { ...page, reviewer: review.reviewerName, reviewedAt: jalaliDate(review.reviewedAt), reviewedAtIso: review.reviewedAt };
}
