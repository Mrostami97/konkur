import { subjects as editorialSubjects } from "../content/editorial";
import type { RelatedPublicItem } from "../components/PublicContent";

type Entry = { code: string; slug: string; title: string };

/** The subject routes also serve editorial entries before API taxonomy exists. */
export function relatedTaxonomyItems(
  article: { subjectCodes: string[]; topicCodes: string[] },
  subjects: Entry[] = [],
  topics: Entry[] = [],
): RelatedPublicItem[] {
  const subjectCodes = new Set(article.subjectCodes);
  const topicCodes = new Set(article.topicCodes);
  const items: RelatedPublicItem[] = [
    ...subjects.filter((item) => subjectCodes.has(item.code) || subjectCodes.has(item.slug))
      .map((item) => ({ href: `/subjects/${item.slug}`, title: item.title, label: "درس" })),
    ...editorialSubjects.filter((item) => subjectCodes.has(item.slug))
      .map((item) => ({ href: `/subjects/${item.slug}`, title: item.title, label: "درس" })),
    ...topics.filter((item) => topicCodes.has(item.code) || topicCodes.has(item.slug))
      .map((item) => ({ href: `/topics/${item.slug}`, title: item.title, label: "مبحث" })),
  ];
  return [...new Map(items.map((item) => [item.href, item])).values()].slice(0, 6);
}
