/**
 * Rank estimate for the computer-engineering master's (set 1277, 1400–1405).
 *
 * The model file holds aggregates only (built outside the repository from the
 * public result banks and the owner's report cards; see
 * docs/data/EXAM_INTELLIGENCE_EXISTING_ASSETS.md): for each year, quota and
 * coefficient code, ln(rank) as a decreasing curve of the GPA-shifted weighted
 * average on a fixed grid, plus out-of-fold residual quantiles for the bands.
 * No single report card is in it.
 */

export type Quota = "free" | "5_percent";
export type CodeKey = "1" | "2" | "3" | "4";

export interface ResidualBand { below: number | null; n: number; q10: number; q25: number; q75: number; q90: number }
export interface YearModel {
  year: number;
  quota: Quota;
  /** Weighted-average points one GPA point is worth that year. */
  gpaShift: number;
  cards: number;
  codes: Partial<Record<CodeKey, { start: number; lnRank: number[] }>>;
}
export interface AdmissionPair {
  program: string;
  university: string;
  code: number;
  cards: number;
  median: number;
  p25: number;
  p75: number;
  highestRecent: number | null;
  /** روزانه, شبانه, پردیس و خودگردان, ...; absent in models built before periods were kept. */
  period?: string;
}
export interface RankModel {
  set: number;
  generated: string;
  gpaRef: number;
  step: number;
  weights: Record<CodeKey, number[]>;
  accuracy: { sameYearMedianErrorPct: number; sameYearChecks: number; nextYearMedianErrorPct: number; nextYearChecks: number };
  bands: Record<Quota, ResidualBand[]>;
  years: YearModel[];
  admissions: AdmissionPair[];
  cards: number;
}

export const CODES: CodeKey[] = ["1", "2", "3", "4"];

/** The six boxes of the report card, in the model's order. */
export const BOXES = [
  { key: "language", title: "زبان عمومی و تخصصی", short: "زبان" },
  { key: "math", title: "ریاضیات", short: "ریاضی" },
  { key: "theory", title: "نظریهٔ زبان‌ها و سیگنال", short: "نظریه و سیگنال" },
  { key: "ds", title: "ساختمان داده، الگوریتم و هوش مصنوعی", short: "داده، الگوریتم و هوش" },
  { key: "arch", title: "مدار منطقی و معماری", short: "منطقی و معماری" },
  { key: "os", title: "سیستم عامل، شبکه و پایگاه داده", short: "سیستم عامل، شبکه و پایگاه داده" },
] as const;

/** Question counts of 1405, the latest exam; used for the right/wrong input. */
export const QUESTIONS_1405 = [25, 19, 10, 19, 19, 18];

/** Owner-confirmed orientation of each coefficient code. */
export const CODE_LABELS: Record<CodeKey, { title: string; programs: string }> = {
  "1": { title: "شبکه و امنیت", programs: "شبکه، رایانش امن، علوم و فناوری شبکه" },
  "2": { title: "هوش مصنوعی", programs: "هوش مصنوعی و قرآن‌کاوی رایانشی" },
  "3": { title: "معماری کامپیوتر", programs: "معماری سیستم‌های کامپیوتری" },
  "4": { title: "نرم‌افزار", programs: "نرم‌افزار، بیوانفورماتیک، علوم داده، الگوریتم و محاسبات" },
};

export const PERCENT_MIN = -100 / 3;

/** Konkur percent: a wrong answer takes back a third of a right one. */
export function percentFromAnswers(correct: number, wrong: number, questions: number): number {
  return questions > 0 ? ((3 * correct - wrong) / (3 * questions)) * 100 : 0;
}

export function weightedAverage(model: RankModel, code: CodeKey, percents: readonly number[]): number {
  const weights = model.weights[code];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.reduce((sum, weight, index) => sum + weight * percents[index], 0) / total;
}

export interface CodeEstimate {
  code: CodeKey;
  average: number;
  /** Median rank of comparable cards; at an edge, the edge's rank. */
  rank: number;
  low80: number;
  high80: number;
  low50: number;
  high50: number;
  /** "better": above every card of that year; "worse": below every card. */
  edge: "inside" | "better" | "worse";
}

function bandFor(model: RankModel, quota: Quota, rank: number): ResidualBand {
  const bands = model.bands[quota];
  return bands.find((band) => band.below === null || rank < band.below) ?? bands[bands.length - 1];
}

export function estimateCode(model: RankModel, year: YearModel, code: CodeKey, percents: readonly number[], gpa: number): CodeEstimate | null {
  const curve = year.codes[code];
  if (!curve) return null;
  const average = weightedAverage(model, code, percents);
  const score = average + year.gpaShift * (gpa - model.gpaRef);
  const last = curve.lnRank.length - 1;
  const position = (score - curve.start) / model.step;
  let ln: number;
  let edge: CodeEstimate["edge"] = "inside";
  if (position <= 0) {
    ln = curve.lnRank[0];
    edge = position < 0 ? "worse" : "inside";
  } else if (position >= last) {
    ln = curve.lnRank[last];
    edge = position > last ? "better" : "inside";
  } else {
    const index = Math.floor(position);
    const t = position - index;
    ln = curve.lnRank[index] * (1 - t) + curve.lnRank[index + 1] * t;
  }
  const rank = Math.exp(ln);
  const band = bandFor(model, year.quota, rank);
  const at = (offset: number) => Math.max(1, Math.exp(ln + offset));
  return { code, average, rank: Math.max(1, rank), low80: at(band.q10), high80: at(band.q90), low50: at(band.q25), high50: at(band.q75), edge };
}

export function yearsFor(model: RankModel, quota: Quota): YearModel[] {
  return model.years.filter((year) => year.quota === quota).sort((a, b) => a.year - b.year);
}

/** Rank after adding `points` percent in one box, clamped to 100. */
export function rankWithMore(model: RankModel, year: YearModel, code: CodeKey, percents: readonly number[], gpa: number, box: number, points: number): number | null {
  const next = percents.map((value, index) => (index === box ? Math.min(100, value + points) : value));
  return estimateCode(model, year, code, next, gpa)?.rank ?? null;
}

export type AdmissionFit = "strong" | "within" | "edge" | "far";

/** Where a rank sits among a program's admitted ranks. */
export function admissionFit(pair: AdmissionPair, rank: number): AdmissionFit {
  if (rank <= pair.p25) return "strong";
  if (rank <= pair.p75) return "within";
  if (rank <= Math.max(pair.p75, pair.highestRecent ?? 0)) return "edge";
  return "far";
}

export interface AdmissionMatch {
  pair: AdmissionPair;
  /** The estimated rank in this program's coefficient code. */
  rank: number;
  fit: AdmissionFit;
}

const FIT_ORDER: Record<AdmissionFit, number> = { strong: 0, within: 1, edge: 2, far: 3 };

/**
 * The programs whose admitted ranks a set of code estimates reaches: best fit
 * first, then the more competitive program first. Programs out of reach are
 * left out.
 */
export function admissionMatches(model: RankModel, estimates: readonly CodeEstimate[]): AdmissionMatch[] {
  const byCode = new Map(estimates.map((estimate) => [estimate.code, estimate]));
  return model.admissions
    .map((pair) => {
      const estimate = byCode.get(String(pair.code) as CodeKey);
      return estimate ? { pair, rank: estimate.rank, fit: admissionFit(pair, estimate.rank) } : null;
    })
    .filter((match): match is AdmissionMatch => match !== null && match.fit !== "far")
    .sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || a.pair.median - b.pair.median);
}

/** Readable rounding: exact under 100, then to 5 and 10. */
export function roundRank(rank: number): number {
  if (rank < 100) return Math.max(1, Math.round(rank));
  if (rank < 1000) return Math.round(rank / 5) * 5;
  return Math.round(rank / 10) * 10;
}
