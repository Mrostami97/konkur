import { Prisma, ReviewStatus, VersionedEntityType } from "@prisma/client";

type VersionReader = Pick<Prisma.TransactionClient, "contentVersion">;

/** Published version history is retained when an article is revised or rolled back. */
export async function publishedArticleHistoryDates(client: VersionReader, articleIds: string[]): Promise<Map<string, Date>> {
  if (articleIds.length === 0) return new Map();
  const dates = await client.contentVersion.groupBy({
    by: ["entityId"],
    where: {
      entityType: VersionedEntityType.ARTICLE,
      entityId: { in: [...new Set(articleIds)] },
      reviewStatus: ReviewStatus.PUBLISHED,
      publishedAt: { not: null },
    },
    _min: { publishedAt: true },
  });
  return new Map(dates.flatMap(({ entityId, _min }) => _min.publishedAt ? [[entityId, _min.publishedAt] as const] : []));
}

/** Canonical legacy dates can predate the available version history. */
export function firstArticlePublishedAt(canonical: Date | null, historical: Date | undefined): Date | null {
  if (!canonical) return historical ?? null;
  if (!historical) return canonical;
  return canonical <= historical ? canonical : historical;
}

export function newestPublicationFirst<T extends { publishedAt: Date | null; title: string }>(items: T[]): T[] {
  return items.sort((left, right) =>
    (right.publishedAt?.getTime() ?? -Infinity) - (left.publishedAt?.getTime() ?? -Infinity)
    || left.title.localeCompare(right.title, "fa"),
  );
}
