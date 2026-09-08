import { resourceSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await resourceSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
