import { admissionsSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await admissionsSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
