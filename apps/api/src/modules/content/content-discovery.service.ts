import { Injectable, NotFoundException } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ContentSearchQueryDto, PublicReportCardsQueryDto } from "./dto/content-discovery.dto";

type SearchResultType = "ARTICLE" | "RESOURCE" | "SUBJECT" | "TOPIC" | "CONTRIBUTOR";

interface SearchCandidate {
  type: SearchResultType;
  slug: string;
  title: string;
  summary: string | null;
  href: string;
  titleSearch: string;
  summarySearch: string;
  bodySearch: string;
  metadata?: Record<string, unknown>;
}

interface RankedSearchCandidate extends SearchCandidate {
  score: number;
}

const SEARCH_TYPE_ORDER: Record<SearchResultType, number> = {
  ARTICLE: 0,
  RESOURCE: 1,
  SUBJECT: 2,
  TOPIC: 3,
  CONTRIBUTOR: 4,
};

/**
 * Makes Persian search insensitive to Arabic ی/ک variants, joiners,
 * non-breaking spaces and repeated whitespace. This is deliberately kept in
 * one exported pure function so the normalization contract is easy to test.
 */
export function normalizePersianSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[إأٱ]/g, "ا")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

@Injectable()
export class ContentDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: ContentSearchQueryDto) {
    const normalizedQuery = normalizePersianSearchText(query.q);
    const [articles, resources, subjects, topics, contributors] = await Promise.all([
      this.prisma.article.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED },
        select: {
          slug: true,
          title: true,
          summary: true,
          quickAnswer: true,
          contentBlocks: true,
          contentType: true,
          publishedAt: true,
        },
      }),
      this.prisma.resource.findMany({
        where: { reviewStatus: ReviewStatus.PUBLISHED },
        select: {
          slug: true,
          title: true,
          summary: true,
          description: true,
          kind: true,
          accessMode: true,
          publishedAt: true,
        },
      }),
      this.prisma.subject.findMany({
        select: { code: true, slug: true, title: true, description: true },
      }),
      this.prisma.topic.findMany({
        select: {
          code: true,
          slug: true,
          title: true,
          description: true,
          subject: { select: { code: true, slug: true, title: true } },
        },
      }),
      this.prisma.contributorProfile.findMany({
        where: { isPublished: true },
        select: { slug: true, displayName: true, roleTitle: true, shortBio: true, bioBlocks: true },
      }),
    ]);

    const candidates: SearchCandidate[] = [
      ...articles.map((article) => ({
        type: "ARTICLE" as const,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        href: article.contentType === "GUIDE" ? `/guides/${article.slug}` : `/articles/${article.slug}`,
        titleSearch: article.title,
        summarySearch: [article.summary, article.quickAnswer].filter(Boolean).join(" "),
        bodySearch: this.jsonText(article.contentBlocks),
        metadata: { contentType: article.contentType, publishedAt: article.publishedAt },
      })),
      ...resources.map((resource) => ({
        type: "RESOURCE" as const,
        slug: resource.slug,
        title: resource.title,
        summary: resource.summary,
        href: `/resources/${resource.slug}`,
        titleSearch: resource.title,
        summarySearch: [resource.summary, resource.description].filter(Boolean).join(" "),
        // Resource content can be account- or entitlement-gated. Search only
        // its public teaser fields, even though the canonical row is published.
        bodySearch: "",
        metadata: {
          kind: resource.kind,
          accessMode: resource.accessMode,
          publishedAt: resource.publishedAt,
        },
      })),
      ...subjects.map((subject) => ({
        type: "SUBJECT" as const,
        slug: subject.slug,
        title: subject.title,
        summary: subject.description,
        href: `/subjects/${subject.slug}`,
        titleSearch: [subject.title, subject.code].join(" "),
        summarySearch: subject.description ?? "",
        bodySearch: "",
        metadata: { code: subject.code },
      })),
      ...topics.map((topic) => ({
        type: "TOPIC" as const,
        slug: topic.slug,
        title: topic.title,
        summary: topic.description,
        href: `/topics/${topic.slug}`,
        titleSearch: [topic.title, topic.code].join(" "),
        summarySearch: [topic.description, topic.subject.title].filter(Boolean).join(" "),
        bodySearch: "",
        metadata: { code: topic.code, subject: topic.subject },
      })),
      ...contributors.map((contributor) => ({
        type: "CONTRIBUTOR" as const,
        slug: contributor.slug,
        title: contributor.displayName,
        summary: contributor.shortBio ?? contributor.roleTitle,
        href: `/authors/${contributor.slug}`,
        titleSearch: contributor.displayName,
        summarySearch: [contributor.roleTitle, contributor.shortBio].filter(Boolean).join(" "),
        bodySearch: this.jsonText(contributor.bioBlocks),
        metadata: { roleTitle: contributor.roleTitle },
      })),
    ];

    const ranked = candidates
      .map((candidate) => ({ ...candidate, score: this.searchScore(candidate, normalizedQuery) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => this.compareRanked(left, right));
    const total = ranked.length;
    const start = (query.page - 1) * query.limit;
    const items = ranked.slice(start, start + query.limit).map((candidate) => ({
      type: candidate.type,
      slug: candidate.slug,
      title: candidate.title,
      summary: candidate.summary,
      href: candidate.href,
      ...(candidate.metadata ? { metadata: candidate.metadata } : {}),
    }));

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  async getPublishedContributor(slug: string) {
    const contributor = await this.prisma.contributorProfile.findFirst({
      where: { slug, isPublished: true },
      select: {
        kind: true,
        slug: true,
        displayName: true,
        roleTitle: true,
        shortBio: true,
        bioBlocks: true,
        avatarUrl: true,
        thesisUrl: true,
        sameAs: true,
        updatedAt: true,
        authoredArticles: {
          where: { reviewStatus: ReviewStatus.PUBLISHED },
          orderBy: { publishedAt: "desc" },
          select: { slug: true, title: true, summary: true, contentType: true, publishedAt: true },
        },
        reviewedArticles: {
          where: { reviewStatus: ReviewStatus.PUBLISHED },
          orderBy: { publishedAt: "desc" },
          select: { slug: true, title: true, summary: true, contentType: true, publishedAt: true },
        },
        authoredResources: {
          where: { reviewStatus: ReviewStatus.PUBLISHED },
          orderBy: { publishedAt: "desc" },
          select: { slug: true, title: true, summary: true, kind: true, accessMode: true, publishedAt: true },
        },
        reviewedResources: {
          where: { reviewStatus: ReviewStatus.PUBLISHED },
          orderBy: { publishedAt: "desc" },
          select: { slug: true, title: true, summary: true, kind: true, accessMode: true, publishedAt: true },
        },
      },
    });
    if (!contributor) throw new NotFoundException("contributor not found");
    return {
      kind: contributor.kind,
      slug: contributor.slug,
      displayName: contributor.displayName,
      roleTitle: contributor.roleTitle,
      shortBio: contributor.shortBio,
      bioBlocks: contributor.bioBlocks,
      avatarUrl: contributor.avatarUrl,
      thesisUrl: contributor.thesisUrl,
      sameAs: contributor.sameAs,
      updatedAt: contributor.updatedAt,
      authoredArticles: contributor.authoredArticles.map((article) => ({
        ...article,
        href: article.contentType === "GUIDE" ? `/guides/${article.slug}` : `/articles/${article.slug}`,
      })),
      reviewedArticles: contributor.reviewedArticles.map((article) => ({
        ...article,
        href: article.contentType === "GUIDE" ? `/guides/${article.slug}` : `/articles/${article.slug}`,
      })),
      authoredResources: contributor.authoredResources.map((resource) => ({
        ...resource,
        href: `/resources/${resource.slug}`,
      })),
      reviewedResources: contributor.reviewedResources.map((resource) => ({
        ...resource,
        href: `/resources/${resource.slug}`,
      })),
    };
  }

  async listPublicReportCards(query: PublicReportCardsQueryDto) {
    const where = { publicConsent: true } as const;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.reportCard.findMany({
        where,
        orderBy: [{ examYear: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          examYear: true,
          degree: true,
          field: true,
          quota: true,
          subjectScores: true,
          rank: true,
          admissions: true,
        },
      }),
      this.prisma.reportCard.count({ where }),
    ]);
    return {
      items: records,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  private searchScore(candidate: SearchCandidate, normalizedQuery: string): number {
    const title = normalizePersianSearchText(candidate.titleSearch);
    const summary = normalizePersianSearchText(candidate.summarySearch);
    const body = normalizePersianSearchText(candidate.bodySearch);
    const queryTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
    const searchableText = `${title} ${summary} ${body}`;
    if (!queryTokens.every((token) => searchableText.includes(token))) return 0;
    let score = 0;

    if (title === normalizedQuery) score += 1_200;
    else if (title.startsWith(normalizedQuery)) score += 800;
    else if (title.includes(normalizedQuery)) score += 500;
    if (summary.includes(normalizedQuery)) score += 160;
    if (body.includes(normalizedQuery)) score += 80;

    for (const token of queryTokens) {
      if (title.split(" ").some((word) => word === token)) score += 140;
      else if (title.includes(token)) score += 90;
      if (summary.includes(token)) score += 30;
      if (body.includes(token)) score += 10;
    }
    return score;
  }

  private compareRanked(left: RankedSearchCandidate, right: RankedSearchCandidate): number {
    if (left.score !== right.score) return right.score - left.score;
    if (SEARCH_TYPE_ORDER[left.type] !== SEARCH_TYPE_ORDER[right.type]) {
      return SEARCH_TYPE_ORDER[left.type] - SEARCH_TYPE_ORDER[right.type];
    }
    const leftTitle = normalizePersianSearchText(left.title);
    const rightTitle = normalizePersianSearchText(right.title);
    if (leftTitle !== rightTitle) return leftTitle < rightTitle ? -1 : 1;
    return left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0;
  }

  private jsonText(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((item) => this.jsonText(item)).join(" ");
    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>).map((item) => this.jsonText(item)).join(" ");
    }
    return "";
  }
}
