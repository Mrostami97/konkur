import merged from "../content/merged-pages.json";

// Owner-approved merges of duplicate public pages. The redirect itself is
// served by next.config.mjs from the same JSON; everything here keeps the old
// URLs out of links, sitemaps and discovery lists so nothing points at a
// redirect.

const targets = new Map(merged.redirects.map((entry) => [entry.from, entry.to]));

/** The page an internal href should point at: its merge target, or itself. */
export function canonicalHref(href: string): string {
  return targets.get(href) ?? href;
}

export function isMergedGuide(slug: string): boolean {
  return targets.has(`/guides/${slug}`);
}

/** Drops guides that were merged into another page. */
export function withoutMergedGuides<T extends { slug: string }>(items: readonly T[]): T[] {
  return items.filter((item) => !isMergedGuide(item.slug));
}
