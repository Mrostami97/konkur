import { reportCardSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export async function GET() {
  return sitemapResponse(await reportCardSitemapEntries());
}
