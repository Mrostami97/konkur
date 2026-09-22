import { sitemapResponse } from "../../../lib/public-sitemaps";
import { absoluteUrl } from "../../../lib/seo";

const publicPages = [
  "/",
  "/about",
  "/admissions",
  "/consultations",
  "/corrections",
  "/courses",
  "/editorial-policy",
  "/evidence",
  "/exams",
  "/instructors",
  "/source-policy",
] as const;

export function GET() {
  return sitemapResponse(publicPages.map((path) => ({ loc: absoluteUrl(path) })));
}
