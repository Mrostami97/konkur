import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree, ReviewStatus } from "@prisma/client";
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

const MIN_PUBLIC_COHORT_SIZE = 5;
const ACTIVE_OFFICIAL_SOURCE = {
  sourceTier: "PRIMARY_OFFICIAL",
  sourceStatus: "ACTIVE",
  archivedAt: null,
  mayLink: true,
} as const;

export interface PublicSubjectScore {
  subject_code: string;
  percent: number;
}

export interface PublicAdmission {
  program_code: string;
  status: "accepted" | "rejected" | "waitlisted";
  program?: {
    code: string;
    title: string;
    university: { code: string; title: string };
  };
}

export interface SanitizedReportCard {
  examYear: number;
  degree: Degree;
  field: string;
  quota: string;
  subjectScores: PublicSubjectScore[];
  rank: { value: number; scope: "national" | "quota" | "field" };
  admissions: PublicAdmission[];
}

function percentile(sorted: number[], value: number) {
  const index = (value / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

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
    if (query.rankMin && query.rankMax && query.rankMin > query.rankMax) {
      throw new BadRequestException("rankMin must not be greater than rankMax");
    }
    const admissionProgramCodes = await this.publicAdmissionProgramCodes(query);
    const requiresAdmissionFilter = Boolean(query.specialization || query.university);
    const records = await this.prisma.reportCard.findMany({
      where: {
        publicConsent: true,
        examYear: query.examYear,
        degree: query.degree,
        field: query.field,
        quota: query.quota,
      },
      orderBy: [{ examYear: "desc" }, { createdAt: "desc" }],
      select: {
        examYear: true,
        degree: true,
        field: true,
        quota: true,
        subjectScores: true,
        rank: true,
        admissions: true,
      },
    });
    const filtered = records
      .map((record) => this.sanitizePublicReportCard(record))
      .filter((record): record is SanitizedReportCard => Boolean(record))
      .filter((record) => query.rankMin === undefined || record.rank.value >= query.rankMin)
      .filter((record) => query.rankMax === undefined || record.rank.value <= query.rankMax)
      .filter((record) => !requiresAdmissionFilter || record.admissions.some((item) => admissionProgramCodes.has(item.program_code)));

    const referencedCodes = [...new Set(filtered.flatMap((record) => record.admissions.map((item) => item.program_code)))];
    const publicPrograms = referencedCodes.length === 0 ? [] : await this.prisma.program.findMany({
      where: {
        code: { in: referencedCodes },
        source: { is: ACTIVE_OFFICIAL_SOURCE },
        university: { source: { is: ACTIVE_OFFICIAL_SOURCE } },
      },
      select: { code: true, title: true, university: { select: { code: true, title: true } } },
    });
    const programByCode = new Map(publicPrograms.map((program) => [program.code, program]));
    const enriched = filtered.map((record) => ({
      ...record,
      // A free-form program_code from an imported card is not public catalog
      // data by itself. Publish an admission only after that code resolves to
      // an independently sourced, active official program and university.
      admissions: record.admissions.flatMap((admission) => {
        const program = programByCode.get(admission.program_code);
        return program ? [{ ...admission, program }] : [];
      }),
    }));
    const total = enriched.length;
    const items = enriched.slice((query.page - 1) * query.limit, query.page * query.limit);
    const ranks = filtered.map((record) => record.rank.value).sort((left, right) => left - right);
    const dataYears = [...new Set(filtered.map((record) => record.examYear))].sort((left, right) => left - right);
    const aggregate = total >= MIN_PUBLIC_COHORT_SIZE
      ? {
          rankMedian: Math.round(percentile(ranks, 50)),
          rankP25: Math.round(percentile(ranks, 25)),
          rankP75: Math.round(percentile(ranks, 75)),
          rankCentral80Low: Math.round(percentile(ranks, 10)),
          rankCentral80High: Math.round(percentile(ranks, 90)),
          intervalKind: "EMPIRICAL_CENTRAL_80",
          intervalNote: "این بازهٔ تجربی مرکزی ۸۰٪ است و فاصلهٔ اطمینان آماری یا تضمین رتبه نیست.",
        }
      : null;
    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      cohort: {
        sampleSize: total,
        minimumSampleSize: MIN_PUBLIC_COHORT_SIZE,
        dataYears,
        aggregate,
        limitations: [
          "کارنامه‌ها فقط نمونه‌های دارای رضایت انتشارند و نمایندهٔ همهٔ داوطلبان نیستند.",
          "تغییر سال، سهمیه، مجموعه و ظرفیت دانشگاه می‌تواند مقایسه را جابه‌جا کند.",
          "رکورد کمتر از پنج نمونه عمداً به آمار تجمیعی تبدیل نمی‌شود.",
        ],
      },
    };
  }

  private async publicAdmissionProgramCodes(query: PublicReportCardsQueryDto) {
    if (!query.specialization && !query.university) return new Set<string>();
    const programs = await this.prisma.program.findMany({
      where: {
        ...(query.specialization ? { code: query.specialization } : {}),
        source: { is: ACTIVE_OFFICIAL_SOURCE },
        university: {
          ...(query.university ? { code: query.university } : {}),
          source: { is: ACTIVE_OFFICIAL_SOURCE },
        },
      },
      select: { code: true },
    });
    return new Set(programs.map((program) => program.code));
  }

  private sanitizePublicReportCard(record: {
    examYear: number;
    degree: Degree;
    field: string;
    quota: string;
    subjectScores: unknown;
    rank: unknown;
    admissions: unknown;
  }): SanitizedReportCard | null {
    if (!Number.isInteger(record.examYear) || !record.field || !record.quota) return null;
    const rank = record.rank;
    if (!Array.isArray(record.subjectScores) || !this.isRecord(rank) || !Array.isArray(record.admissions)) return null;
    const rankValue = rank.value;
    const rankScope = rank.scope;
    if (typeof rankValue !== "number" || !Number.isInteger(rankValue) || rankValue < 1) return null;
    if (typeof rankScope !== "string" || !["national", "quota", "field"].includes(rankScope)) return null;
    const subjectScores = record.subjectScores.flatMap((value): PublicSubjectScore[] => {
      if (!this.isRecord(value) || typeof value.subject_code !== "string" || typeof value.percent !== "number") return [];
      if (!Number.isFinite(value.percent) || value.percent < -100 || value.percent > 100) return [];
      return [{ subject_code: value.subject_code, percent: value.percent }];
    });
    if (subjectScores.length === 0) return null;
    const admissions = record.admissions.flatMap((value): PublicAdmission[] => {
      if (!this.isRecord(value) || typeof value.program_code !== "string") return [];
      if (!["accepted", "rejected", "waitlisted"].includes(String(value.status))) return [];
      return [{
        program_code: value.program_code,
        status: value.status as PublicAdmission["status"],
      }];
    });
    return {
      examYear: record.examYear,
      degree: record.degree,
      field: record.field,
      quota: record.quota,
      subjectScores,
      rank: { value: rankValue, scope: rankScope as SanitizedReportCard["rank"]["scope"] },
      admissions,
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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}
