/**
 * The report card's arithmetic, kept free of the database so it can be tested
 * on its own: konkur percentages per section, standard scores against the
 * other participants, and which konkur section ("box") a subject belongs to.
 */

/** The konkur percentage: every wrong answer cancels a third of a right one. */
export function konkurPercentOf(correct: number, wrong: number, questions: number) {
  return questions > 0 ? ((3 * correct - wrong) / (3 * questions)) * 100 : 0;
}

/**
 * The six boxes of the 1277 (computer engineering) booklet before 1406, as
 * the rank model built from real report cards knows them. A subject the 1406
 * exam dropped (general maths, signals, digital electronics) is not in the
 * bank, so a simulator's box percentage comes from the subjects still taught.
 */
export const RANK_BOXES = [
  { key: "language", title: "زبان عمومی و تخصصی", subjects: ["english"] },
  { key: "math", title: "ریاضیات", subjects: ["discrete-math", "statistics", "linear-algebra"] },
  { key: "theory", title: "نظریهٔ زبان‌ها و ماشین‌ها", subjects: ["automata"] },
  {
    key: "ds",
    title: "ساختمان داده، الگوریتم و هوش مصنوعی",
    subjects: ["data-structures-algorithms", "data-structures", "algorithms", "artificial-intelligence"],
  },
  { key: "arch", title: "مدار منطقی و معماری کامپیوتر", subjects: ["digital-logic", "computer-architecture"] },
  { key: "os", title: "سیستم عامل، شبکه و پایگاه داده", subjects: ["operating-systems", "computer-networks", "databases"] },
] as const;

export type RankBoxKey = (typeof RANK_BOXES)[number]["key"];

export function rankBoxOf(subjectCode: string): RankBoxKey | null {
  return RANK_BOXES.find((box) => (box.subjects as readonly string[]).includes(subjectCode))?.key ?? null;
}

export interface GradedItem {
  questionId: string;
  sectionId: string | null;
  subjectCode: string;
  /** "void": the final key deleted the question; it counts for nothing and is left out of every total. */
  outcome: "correct" | "wrong" | "blank" | "void";
  /** False for a question the key scores with positive effect only: a wrong answer costs nothing. */
  penalized?: boolean;
  timeSpentMs: number;
}

export interface SectionInfo {
  id: string;
  title: string;
  order: number;
  rankBox: string | null;
  coefficient: number;
}

export interface SectionResult {
  sectionId: string | null;
  title: string;
  rankBox: string | null;
  coefficient: number;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
  timeSpentMs: number;
}

export interface SubjectResult {
  subjectCode: string;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  percent: number;
}

export interface Breakdown {
  version: 1;
  sections: SectionResult[];
  subjects: SubjectResult[];
  timeSpentMs: number;
}

function tally<T extends { outcome: GradedItem["outcome"]; penalized?: boolean; timeSpentMs: number }>(all: T[]) {
  // A deleted question is out of the exam, as the board scores it.
  const items = all.filter((item) => item.outcome !== "void");
  const correct = items.filter((item) => item.outcome === "correct").length;
  const wrong = items.filter((item) => item.outcome === "wrong").length;
  const penalizedWrong = items.filter((item) => item.outcome === "wrong" && item.penalized !== false).length;
  const blank = items.length - correct - wrong;
  return {
    questions: items.length,
    correct,
    wrong,
    blank,
    percent: konkurPercentOf(correct, penalizedWrong, items.length),
    timeSpentMs: items.reduce((sum, item) => sum + item.timeSpentMs, 0),
  };
}

/**
 * Per-section and per-subject results of one graded attempt. An exam without
 * sections is one section, the whole exam, so every report card has the same
 * shape.
 */
export function breakdownOf(items: GradedItem[], sections: SectionInfo[]): Breakdown {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const sectionResults: SectionResult[] = ordered.length
    ? ordered
        .map((section) => ({ section, items: items.filter((item) => item.sectionId === section.id) }))
        .filter((group) => group.items.length > 0)
        .map(({ section, items: group }) => ({
          sectionId: section.id,
          title: section.title,
          rankBox: section.rankBox,
          coefficient: section.coefficient,
          ...tally(group),
        }))
    : [{ sectionId: null, title: "کل آزمون", rankBox: null, coefficient: 1, ...tally(items) }];

  const subjects = [...new Set(items.map((item) => item.subjectCode))].map((subjectCode) => {
    const { timeSpentMs, ...rest } = tally(items.filter((item) => item.subjectCode === subjectCode));
    void timeSpentMs;
    return { subjectCode, ...rest };
  });

  return { version: 1, sections: sectionResults, subjects, timeSpentMs: items.reduce((sum, item) => sum + item.timeSpentMs, 0) };
}

/** The participants' minimum before a rank or standard score is shown. */
export function rankMinimum() {
  const configured = Number(process.env.EXAM_RANK_MIN_PARTICIPANTS);
  return Number.isInteger(configured) && configured > 0 ? configured : 30;
}

/** Answers a question needs before "how many got it right" is shown. */
export function questionStatMinimum() {
  const configured = Number(process.env.EXAM_QUESTION_STAT_MIN_ANSWERS);
  return Number.isInteger(configured) && configured > 0 ? configured : 20;
}

/**
 * A konkur-style standard score (تراز): 5000 at the participants' mean, 1000
 * per standard deviation. Null until there are enough participants, or when
 * everyone scored the same.
 */
export function tarazOf(percent: number, population: number[], minimum = rankMinimum()) {
  if (population.length < minimum) return null;
  const mean = population.reduce((sum, value) => sum + value, 0) / population.length;
  const sd = Math.sqrt(population.reduce((sum, value) => sum + (value - mean) ** 2, 0) / population.length);
  return sd > 0 ? Math.round(5000 + (1000 * (percent - mean)) / sd) : null;
}

/** The overall standard score: section scores weighted by their coefficients. */
export function weightedTaraz(sections: { taraz: number | null; coefficient: number }[]) {
  const scored = sections.filter((section): section is { taraz: number; coefficient: number } => section.taraz !== null);
  if (scored.length === 0 || scored.length !== sections.length) return null;
  const weight = scored.reduce((sum, section) => sum + section.coefficient, 0);
  return weight > 0 ? Math.round(scored.reduce((sum, section) => sum + section.taraz * section.coefficient, 0) / weight) : null;
}
