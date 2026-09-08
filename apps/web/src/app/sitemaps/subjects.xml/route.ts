import { sitemapResponse, subjectSitemapEntries } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await subjectSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
