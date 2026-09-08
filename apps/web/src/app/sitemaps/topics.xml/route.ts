import { sitemapResponse, topicSitemapEntries } from "../../../lib/public-sitemaps";

export async function GET() {
  const result = await topicSitemapEntries();
  return sitemapResponse(result.entries, result.complete);
}
