/**
 * The 1406 master's exams as the bank can assemble them (owner's decisions,
 * 2026-10-09):
 *
 * - computer engineering (1277) and IT (1276): language 25 questions and
 *   mathematics 20 as in 1405, the 20 split evenly among the mathematics
 *   subjects the bank has; the specialised section the same number of
 *   questions -- ten -- from each of its subjects. Linear algebra joins
 *   1277's mathematics by itself once the bank has questions for it.
 * - computer science (1209): its subjects and counts as in the latest CS
 *   exam the bank holds.
 *
 * Coefficients are the 1406 table's: language 1, mathematics 2, specialised 4.
 */

export type MockTrack = "1277" | "1276" | "1209";

export interface MockSection {
  title: string;
  /** The report card's grouping key; "specialised" is 1406's single block. */
  rankBox: string;
  coefficient: number;
  /** Subjects in the order the section asks them, with how many questions each. */
  subjects: { code: string; count: number }[];
}

export const MOCK_TRACK_NAMES: Record<MockTrack, string> = {
  "1277": "مهندسی کامپیوتر",
  "1276": "فناوری اطلاعات (IT)",
  "1209": "علوم کامپیوتر",
};

const LANGUAGE = 25;
const MATHEMATICS = 20;
const PER_SPECIALISED_SUBJECT = 10;

const MATH_SUBJECTS: Record<"1277" | "1276", string[]> = {
  "1277": ["discrete-math", "statistics", "linear-algebra"],
  "1276": ["discrete-math", "statistics"],
};

const SPECIALISED: Record<"1277" | "1276", string[]> = {
  "1277": [
    "programming-fundamentals",
    "digital-logic",
    "computer-architecture",
    "data-structures-algorithms",
    "automata",
    "operating-systems",
    "artificial-intelligence",
  ],
  "1276": [
    "programming-fundamentals",
    "data-structures-algorithms",
    "operating-systems",
    "computer-networks",
    "databases",
    "artificial-intelligence",
  ],
};

/** `total` questions over `codes` as evenly as whole numbers allow, the first ones taking the remainder. */
export function splitEvenly(total: number, codes: string[]) {
  const base = Math.floor(total / codes.length);
  return codes.map((code, index) => ({ code, count: base + (index < total % codes.length ? 1 : 0) }));
}

/**
 * The sections of a 1277 or 1276 mock. `available` says which subjects the
 * bank can supply at all: a mathematics subject with none (linear algebra
 * today) leaves its share to the others rather than an empty slot.
 */
export function blueprint1406(track: "1277" | "1276", available: (code: string) => boolean): MockSection[] {
  const math = MATH_SUBJECTS[track].filter(available);
  return [
    { title: "زبان عمومی و تخصصی", rankBox: "language", coefficient: 1, subjects: [{ code: "english", count: LANGUAGE }] },
    ...(math.length ? [{ title: "ریاضیات", rankBox: "math", coefficient: 2, subjects: splitEvenly(MATHEMATICS, math) }] : []),
    {
      title: "دروس تخصصی",
      rankBox: "specialised",
      coefficient: 4,
      subjects: SPECIALISED[track].map((code) => ({ code, count: PER_SPECIALISED_SUBJECT })),
    },
  ];
}

/**
 * Topics a subject's 1406 syllabus dropped, found by keyword in a question's
 * stem and options. Questions are not tagged by topic yet, so this is the
 * floor, not the whole syllabus: data structures and algorithms lost greedy
 * algorithms (Huffman), dynamic programming, NP-completeness, minimum
 * spanning trees, all-pairs shortest paths, flows, backtracking and
 * branch-and-bound, string matching, AVL and B-trees, binomial and Fibonacci
 * heaps (editorial.ts syllabusBySubject, official 1406 post).
 */
export const OFF_SYLLABUS: Record<string, RegExp> = {
  "data-structures-algorithms":
    /برنامه[‌ ]?ریزی پویا|حریصانه|\bgreedy\b|dynamic programming|\bNP\b|درخت پوشای (کمینه|مینیمم)|\bMST\b|کراسکال|\bkruskal\b|پریم|\bprim\b|فلوید|\bfloyd\b|شار (بیشینه|ماکزیمم)|max[- ]?flow|عقب[‌ ]?گرد|backtrack|شاخه و کران|branch and bound|\bAVL\b|B-tree|درخت B\b|هرم (دوجمله|فیبوناچی)|binomial heap|fibonacci heap|تطابق رشته|\bKMP\b|کوله[‌ ]?پشتی|knapsack|ضرب زنجیره|matrix chain|زیردنبالهٔ? مشترک|\bLCS\b|هافمن|\bhuffman\b/i,
};

/** Minutes for a mock: the 1405 pace of about 1.2 minutes a question, to the next five. */
export function mockDuration(questions: number) {
  return Math.max(10, Math.ceil((questions * 1.2) / 5) * 5);
}

export interface Candidate {
  id: string;
  subjectCode: string;
  passageId: string | null;
  examYear: number;
}

/**
 * Picks `count` questions of one subject. A reading passage comes with all
 * its questions or not at all; questions no earlier mock of this track used
 * come first; the rest is random, so mocks differ from each other. Returns
 * fewer than `count` only when the bank has fewer.
 */
export function pick(candidates: Candidate[], count: number, used: Set<string>, random: () => number = Math.random): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = candidate.passageId ?? `q:${candidate.id}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const shuffled = [...groups.values()]
    .map((group) => ({ group, fresh: group.every((item) => !used.has(item.id)), sort: random() }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || a.sort - b.sort);
  const chosen: Candidate[] = [];
  for (const { group } of shuffled) {
    if (chosen.length + group.length > count) continue;
    chosen.push(...group);
    if (chosen.length === count) break;
  }
  // Booklet-like order: older exams first, a passage's questions together.
  return chosen.sort((a, b) => a.examYear - b.examYear || (a.passageId ?? a.id).localeCompare(b.passageId ?? b.id));
}
