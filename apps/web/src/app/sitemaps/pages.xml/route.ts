import { resultsSitemapEntries, sitemapResponse, withoutEmptyListings } from "../../../lib/public-sitemaps";
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

export async function GET() {
  const [pages, results] = await Promise.all([withoutEmptyListings(publicPages), resultsSitemapEntries()]);
  return sitemapResponse([...pages.map((path) => ({ loc: absoluteUrl(path) })), ...results]);
}
