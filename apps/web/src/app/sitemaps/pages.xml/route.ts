import { resultsSitemapEntries, sitemapResponse, withoutEmptyListings } from "../../../lib/public-sitemaps";
import { absoluteUrl } from "../../../lib/seo";

const publicPages = [
  "/",
  "/about",
  "/admissions",
  "/budget",
  "/consultations",
  "/corrections",
  "/courses",
  "/editorial-policy",
  "/evidence",
  "/exams",
  "/instructors",
  "/rank-calculator/master-computer-engineering",
  "/source-policy",
] as const;

export async function GET() {
  const [pages, results] = await Promise.all([withoutEmptyListings(publicPages), resultsSitemapEntries()]);
  return sitemapResponse([...pages.map((path) => ({ loc: absoluteUrl(path) })), ...results]);
}
