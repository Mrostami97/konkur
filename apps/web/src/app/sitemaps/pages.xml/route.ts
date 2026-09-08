import { sitemapResponse } from "../../../lib/public-sitemaps";
import { absoluteUrl } from "../../../lib/seo";

const publicPages = [
  "/",
  "/about",
  "/admissions",
  "/corrections",
  "/courses",
  "/editorial-policy",
  "/evidence",
  "/exams",
] as const;

export function GET() {
  return sitemapResponse(publicPages.map((path) => ({ loc: absoluteUrl(path) })));
}
