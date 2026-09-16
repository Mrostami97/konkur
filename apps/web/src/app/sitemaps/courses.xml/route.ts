import { courseSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await courseSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
