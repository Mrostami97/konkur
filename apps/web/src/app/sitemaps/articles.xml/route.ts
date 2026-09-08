import { articleSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await articleSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
