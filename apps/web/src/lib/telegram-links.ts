/**
 * Deep links into the Telegram mini app. A channel post can open a page
 * straight inside the app with `t.me/<bot>?startapp=<param>`; Telegram hands
 * the param to /tg, which moves on to the page it names.
 *
 * Telegram allows only A-Z a-z 0-9 _ - in the param (at most 64 characters
 * for links), so a page is either a short name below or its path with `/`
 * written as `--` (`articles--master-computer-answer-keys`).
 *
 * Kept import-free so the web tests can load it directly.
 */

export const START_PARAM_PAGES: Record<string, string> = {
  budget: "/budget",
  solutions1405: "/articles/konkur-1405-computer-engineering-solutions",
  solutions1404: "/articles/konkur-1404-computer-engineering-solutions",
  keys: "/articles/master-computer-answer-keys",
  notes: "/lesson-notes",
  bank: "/questions",
  exams: "/exams",
  rank: "/rank-calculator/master-computer-engineering",
  choices: "/choices",
  courses: "/courses",
  videos: "/free-videos",
  cards: "/report-cards",
  guides: "/guides",
  articles: "/articles",
  account: "/account",
};

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/** The site path a start param opens, or null when it names nothing. */
export function startParamPath(param: string | null | undefined): string | null {
  if (!param) return null;
  const value = param.trim().toLowerCase();
  if (!value || value.length > 512) return null;
  const named = START_PARAM_PAGES[value];
  if (named) return named;
  const segments = value.split("--");
  // A single word that is not a short name above is not a page.
  if (segments.length < 2 || !segments.every((segment) => SEGMENT.test(segment) && !segment.endsWith("-"))) return null;
  return `/${segments.join("/")}`;
}

/** The start param that opens a site path, for building links. */
export function pathStartParam(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, "");
  const named = Object.entries(START_PARAM_PAGES).find(([, page]) => page === `/${clean}`);
  return named ? named[0] : clean.split("/").join("--");
}
