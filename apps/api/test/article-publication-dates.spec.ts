import { ReviewStatus, VersionedEntityType } from "@prisma/client";
import { firstArticlePublishedAt, newestPublicationFirst, publishedArticleHistoryDates } from "../src/modules/content/article-publication-dates";

describe("article first-publication dates", () => {
  const old = new Date("2025-01-01T00:00:00.000Z");
  const next = new Date("2026-01-01T00:00:00.000Z");

  it("uses the earliest published evidence and never substitutes draft creation time", () => {
    expect(firstArticlePublishedAt(old, next)).toEqual(old);
    expect(firstArticlePublishedAt(next, old)).toEqual(old);
    expect(firstArticlePublishedAt(null, old)).toEqual(old);
    expect(firstArticlePublishedAt(next, undefined)).toEqual(next);
    expect(firstArticlePublishedAt(null, undefined)).toBeNull();
  });

  it("loads the earliest published history for all IDs in one filtered aggregate", async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { entityId: "article-1", _min: { publishedAt: old } },
      { entityId: "article-2", _min: { publishedAt: null } },
    ]);
    const client = { contentVersion: { groupBy } } as unknown as Parameters<typeof publishedArticleHistoryDates>[0];
    const result = await publishedArticleHistoryDates(client, ["article-1", "article-1", "article-2"]);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ["entityId"],
      where: {
        entityType: VersionedEntityType.ARTICLE,
        entityId: { in: ["article-1", "article-2"] },
        reviewStatus: ReviewStatus.PUBLISHED,
        publishedAt: { not: null },
      },
      _min: { publishedAt: true },
    });
    expect(result.get("article-1")).toEqual(old);
    expect(result.has("article-2")).toBe(false);
    await publishedArticleHistoryDates(client, []);
    expect(groupBy).toHaveBeenCalledTimes(1);
  });

  it("orders projected articles by recovered first-publication date", () => {
    const items = [
      { title: "Older", publishedAt: old },
      { title: "Undated", publishedAt: null },
      { title: "Newer", publishedAt: next },
    ];
    expect(newestPublicationFirst(items).map((item) => item.title)).toEqual(["Newer", "Older", "Undated"]);
  });
});
