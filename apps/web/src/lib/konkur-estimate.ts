import {
  admissionMatches,
  BOXES,
  CODES,
  estimateCode,
  percentFromAnswers,
  yearsFor,
  type AdmissionMatch,
  type CodeEstimate,
  type RankModel,
  type YearModel,
} from "./rank-model";

/**
 * A rank estimate from everything a student has sat on the site, not only
 * from one full simulator: the latest result in each subject, wherever it
 * was measured, is put back into the six boxes of the computer-engineering
 * report card the rank model was fitted on.
 *
 * The 1406 exam regrouped the subjects; mapping them onto the older boxes
 * is what lets the model built on 1400-1405 report cards read a 1406-style
 * result. Subjects with no old box (programming basics) are left out, and a
 * box nothing has measured yet keeps the estimate from being made at all --
 * a guess at a missing subject would be worse than no rank.
 */

export type BoxKey = (typeof BOXES)[number]["key"];

/** Where each site subject sits on the six-box report card. */
export const SUBJECT_BOX: Record<string, BoxKey> = {
  english: "language",
  "discrete-math": "math",
  statistics: "math",
  "linear-algebra": "math",
  automata: "theory",
  "data-structures-algorithms": "ds",
  "data-structures": "ds",
  algorithms: "ds",
  "artificial-intelligence": "ds",
  "digital-logic": "arch",
  "computer-architecture": "arch",
  "operating-systems": "os",
  "computer-networks": "os",
  databases: "os",
};

export interface SubjectResult {
  subjectCode: string;
  questions: number;
  correct: number;
  wrong: number;
}

export interface DatedResults {
  attemptId: string;
  at: string;
  examTitle: string;
  subjects: SubjectResult[];
}

export interface BoxReading {
  key: BoxKey;
  title: string;
  /** Konkur percent of the latest results in the box's subjects, or null when none is measured. */
  percent: number | null;
  questions: number;
  subjects: string[];
  /** When the newest of those results was taken. */
  at: string | null;
}

/** The six boxes as of the newest results in each subject. `attempts` may be in any order. */
export function boxesFrom(attempts: readonly DatedResults[]): BoxReading[] {
  const latest = new Map<string, { result: SubjectResult; at: string }>();
  for (const attempt of [...attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    for (const result of attempt.subjects) {
      if (result.questions > 0 && SUBJECT_BOX[result.subjectCode]) latest.set(result.subjectCode, { result, at: attempt.at });
    }
  }
  return BOXES.map((box) => {
    const rows = [...latest.entries()].filter(([code]) => SUBJECT_BOX[code] === box.key);
    const questions = rows.reduce((sum, [, row]) => sum + row.result.questions, 0);
    const correct = rows.reduce((sum, [, row]) => sum + row.result.correct, 0);
    const wrong = rows.reduce((sum, [, row]) => sum + row.result.wrong, 0);
    const at = rows.reduce<string | null>((newest, [, row]) => (!newest || Date.parse(row.at) > Date.parse(newest) ? row.at : newest), null);
    return {
      key: box.key,
      title: box.title,
      percent: questions > 0 ? percentFromAnswers(correct, wrong, questions) : null,
      questions,
      subjects: rows.map(([code]) => code),
      at,
    };
  });
}

export interface KonkurEstimate {
  year: YearModel;
  percents: number[];
  codes: CodeEstimate[];
  best: CodeEstimate;
  matches: AdmissionMatch[];
}

/** The estimate for complete boxes, in the latest free-quota year the model has. */
export function estimateFrom(model: RankModel, boxes: readonly BoxReading[], gpa: number | null): KonkurEstimate | null {
  if (boxes.some((box) => box.percent === null)) return null;
  const years = yearsFor(model, "free");
  const year = years[years.length - 1];
  if (!year) return null;
  const percents = boxes.map((box) => box.percent as number);
  const codes = CODES.map((code) => estimateCode(model, year, code, percents, gpa ?? model.gpaRef)).filter(
    (estimate): estimate is CodeEstimate => estimate !== null,
  );
  if (codes.length === 0) return null;
  const best = codes.reduce((a, b) => (b.rank < a.rank ? b : a));
  return { year, percents, codes, best, matches: admissionMatches(model, codes) };
}

/** The best-code rank after each attempt, from the results known by then. */
export function rankHistory(model: RankModel, attempts: readonly DatedResults[], gpa: number | null) {
  const ordered = [...attempts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const points: { at: string; examTitle: string; rank: number }[] = [];
  ordered.forEach((attempt, index) => {
    const estimate = estimateFrom(model, boxesFrom(ordered.slice(0, index + 1)), gpa);
    if (estimate) points.push({ at: attempt.at, examTitle: attempt.examTitle, rank: estimate.best.rank });
  });
  return points;
}
