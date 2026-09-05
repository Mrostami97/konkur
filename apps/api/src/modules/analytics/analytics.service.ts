import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Degree } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EstimateRankDto } from "./dto/estimate-rank.dto";

export const ESTIMATOR_VERSION = "rank-estimator.v1";
const K_NEIGHBORS = 15;
const MIN_COMPARABLES = 5;
const SENSITIVITY_DELTA = 10;
const BACKTEST_SAMPLE_LIMIT = 200;

interface Candidate {
  subjectScores: Record<string, number>;
  rank: number;
  examYear: number;
}

interface EstimateResult {
  median: number;
  p50Low: number;
  p50High: number;
  p80Low: number;
  p80High: number;
  comparableCount: number;
  comparableYears: number[];
}

function toScoreMap(scores: { subject_code: string; percent: number }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of scores) map[s.subject_code] = s.percent;
  return map;
}

/** Mean absolute difference over subjects both sides have -- lower = more similar. */
function distance(a: Record<string, number>, b: Record<string, number>): number | null {
  const commonKeys = Object.keys(a).filter((k) => k in b);
  if (commonKeys.length < 2) return null;
  const sum = commonKeys.reduce((acc, k) => acc + Math.abs(a[k] - b[k]), 0);
  return sum / commonKeys.length;
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * k-NN over real, ingested ReportCard comparables (doc §7: "صدک‌ها، cohort
 * مشابه، ضرایب مصوب و بازه‌های تجربی"). No ML/black-box model -- just
 * similarity by mean absolute score difference, then percentiles of the
 * neighbors' actual historical ranks. Throws if there simply isn't enough
 * data for an honest estimate, rather than fabricating one.
 */
function estimateFromPool(scores: Record<string, number>, pool: Candidate[]): EstimateResult {
  const withDistance = pool
    .map((c) => ({ c, d: distance(scores, c.subjectScores) }))
    .filter((x): x is { c: Candidate; d: number } => x.d !== null)
    .sort((a, b) => a.d - b.d)
    .slice(0, K_NEIGHBORS);

  if (withDistance.length < MIN_COMPARABLES) {
    throw new BadRequestException(
      `not enough comparable report cards (${withDistance.length}, need >= ${MIN_COMPARABLES}) for a reliable estimate`,
    );
  }

  const ranks = withDistance.map((x) => x.c.rank).sort((a, b) => a - b);
  return {
    median: Math.round(percentile(ranks, 50)),
    p50Low: Math.round(percentile(ranks, 25)),
    p50High: Math.round(percentile(ranks, 75)),
    p80Low: Math.round(percentile(ranks, 10)),
    p80High: Math.round(percentile(ranks, 90)),
    comparableCount: withDistance.length,
    comparableYears: [...new Set(withDistance.map((x) => x.c.examYear))].sort(),
  };
}

function confidenceFor(comparableCount: number): string {
  if (comparableCount < 8) return "LOW";
  if (comparableCount < 15) return "MEDIUM";
  return "HIGH";
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchPool(degree: Degree, field: string, quota: string): Promise<Candidate[]> {
    const reportCards = await this.prisma.reportCard.findMany({ where: { degree, field, quota } });
    return reportCards.map((rc) => ({
      subjectScores: toScoreMap(rc.subjectScores as { subject_code: string; percent: number }[]),
      rank: (rc.rank as { value: number }).value,
      examYear: rc.examYear,
    }));
  }

  async estimateRank(userId: string, dto: EstimateRankDto) {
    const degree = dto.degree.toUpperCase() as Degree;
    const scores = toScoreMap(dto.subjectScores.map((s) => ({ subject_code: s.subjectCode, percent: s.percent })));
    const pool = await this.fetchPool(degree, dto.field, dto.quota);

    const result = estimateFromPool(scores, pool);

    const sensitivity: Record<string, number> = {};
    for (const subjectCode of Object.keys(scores)) {
      const improved = { ...scores, [subjectCode]: Math.min(100, scores[subjectCode] + SENSITIVITY_DELTA) };
      try {
        const improvedResult = estimateFromPool(improved, pool);
        sensitivity[subjectCode] = improvedResult.median - result.median;
      } catch {
        sensitivity[subjectCode] = 0; // pool too small to re-evaluate; no claim made
      }
    }

    const estimate = await this.prisma.rankEstimate.create({
      data: {
        userId,
        estimatorVersion: ESTIMATOR_VERSION,
        degree,
        field: dto.field,
        quota: dto.quota,
        subjectScores: scores,
        rankMedian: result.median,
        rankP50Low: result.p50Low,
        rankP50High: result.p50High,
        rankP80Low: result.p80Low,
        rankP80High: result.p80High,
        confidence: confidenceFor(result.comparableCount),
        comparableCount: result.comparableCount,
        comparableYears: result.comparableYears,
        sensitivity,
        methodology: `${ESTIMATOR_VERSION}: k-NN (k<=${K_NEIGHBORS}) over ${result.comparableCount} approved report cards from ${result.comparableYears.join(", ")}, ranked by mean absolute percent-score difference.`,
      },
    });
    return estimate;
  }

  async getLatestEstimate(userId: string) {
    const estimate = await this.prisma.rankEstimate.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
    });
    if (!estimate) throw new NotFoundException("no rank estimate yet");
    return estimate;
  }

  async listMyEstimates(userId: string) {
    return this.prisma.rankEstimate.findMany({ where: { userId }, orderBy: { generatedAt: "desc" } });
  }

  /**
   * Empirical acceptance chance: among comparable report cards (same
   * degree/field/quota, rank within the student's predicted 80% interval)
   * that applied to this program, what fraction were actually accepted?
   * Never a fabricated probability -- returns null with the sample size if
   * there isn't enough data.
   */
  async getAcceptanceChance(userId: string, programId: string) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException("program not found");

    const estimate = await this.getLatestEstimate(userId);
    if (estimate.degree !== program.degree || estimate.field !== program.field) {
      throw new BadRequestException("this program does not match your latest rank estimate's degree/field");
    }

    const candidates = await this.prisma.reportCard.findMany({
      where: { degree: program.degree, field: program.field, quota: estimate.quota },
    });

    const applicants = candidates.filter((c) => {
      const rankValue = (c.rank as { value: number }).value;
      if (rankValue < estimate.rankP80Low || rankValue > estimate.rankP80High) return false;
      return (c.admissions as { program_code: string; status: string }[]).some(
        (a) => a.program_code === program.code,
      );
    });
    if (applicants.length === 0) {
      return { programId, chance: null, sampleSize: 0 };
    }
    const accepted = applicants.filter((c) =>
      (c.admissions as { program_code: string; status: string }[]).some(
        (a) => a.program_code === program.code && a.status === "accepted",
      ),
    ).length;

    return { programId, chance: accepted / applicants.length, sampleSize: applicants.length };
  }

  /**
   * doc §10.2 Phase 6 DoD: "Backtest، گزارش خطا" -- re-run the estimator
   * against known historical report cards (leave-one-out against the rest
   * of their own cohort) and measure how often the actual rank actually
   * fell inside the predicted interval (doc §11's "Prediction Calibration").
   */
  async runBacktest() {
    const sample = await this.prisma.reportCard.findMany({ take: BACKTEST_SAMPLE_LIMIT });
    const poolCache = new Map<string, Candidate[]>();

    let evaluated = 0;
    let withinP50 = 0;
    let withinP80 = 0;
    let percentErrorSum = 0;

    for (const card of sample) {
      const key = `${card.degree}:${card.field}:${card.quota}`;
      if (!poolCache.has(key)) {
        poolCache.set(key, await this.fetchPool(card.degree, card.field, card.quota));
      }
      const fullPool = poolCache.get(key)!;
      const pool = fullPool.filter((c) => c.examYear !== card.examYear || c.rank !== (card.rank as { value: number }).value);

      const scores = toScoreMap(card.subjectScores as { subject_code: string; percent: number }[]);
      let result: EstimateResult;
      try {
        result = estimateFromPool(scores, pool);
      } catch {
        continue; // not enough comparables for this card -- excluded from the sample, not counted as a failure
      }

      const actual = (card.rank as { value: number }).value;
      evaluated += 1;
      if (actual >= result.p50Low && actual <= result.p50High) withinP50 += 1;
      if (actual >= result.p80Low && actual <= result.p80High) withinP80 += 1;
      percentErrorSum += Math.abs(result.median - actual) / actual;
    }

    if (evaluated === 0) {
      throw new BadRequestException("no report cards had enough comparables to backtest");
    }

    return this.prisma.backtestReport.create({
      data: {
        estimatorVersion: ESTIMATOR_VERSION,
        sampleSize: evaluated,
        coverageP50: withinP50 / evaluated,
        coverageP80: withinP80 / evaluated,
        meanAbsPercentError: percentErrorSum / evaluated,
      },
    });
  }

  async listBacktests() {
    return this.prisma.backtestReport.findMany({ orderBy: { computedAt: "desc" } });
  }
}
