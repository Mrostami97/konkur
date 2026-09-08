import { reportCardSitemapEntries, sitemapResponse } from "../../../lib/public-sitemaps";

export function GET() {
  return sitemapResponse(reportCardSitemapEntries());
}
