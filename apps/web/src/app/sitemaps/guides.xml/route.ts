import { guideSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await guideSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
