import type { BookletIdentity } from "./types";

export type CatalogRole = "question_booklet" | "answer_key" | "correction" | "other";

export interface CatalogEntry {
  sha256: string;
  role: CatalogRole;
  degree: "master" | "phd";
  major: string;
  year: number;
  bookletCode?: string;
  examCode?: string;
  originalPath: string;
}

export interface BookletJob {
  id: string;
  identity: BookletIdentity;
  questionSources: CatalogEntry[];
  answerSources: CatalogEntry[];
}

function logicalBookletKey(entry: CatalogEntry): string {
  return [
    entry.degree,
    entry.major,
    entry.year,
    entry.bookletCode ?? "",
    entry.examCode ?? "",
  ].join("|");
}

export function planBookletJobs(
  entries: CatalogEntry[],
  majorPriority: string[] = [],
): BookletJob[] {
  const groups = new Map<string, BookletJob>();

  const stableEntries = [...entries].sort(
    (a, b) =>
      a.originalPath.localeCompare(b.originalPath) ||
      a.sha256.localeCompare(b.sha256),
  );

  for (const entry of stableEntries) {
    if (entry.role === "other") continue;

    const id = logicalBookletKey(entry);
    let job = groups.get(id);
    if (!job) {
      job = {
        id,
        identity: {
          degree: entry.degree,
          major: entry.major,
          year: entry.year,
          bookletCode: entry.bookletCode,
          examCode: entry.examCode,
        },
        questionSources: [],
        answerSources: [],
      };
      groups.set(id, job);
    }

    if (entry.role === "question_booklet") {
      job.questionSources.push(entry);
    } else {
      job.answerSources.push(entry);
    }
  }

  const majorRank = (major: string): number => {
    const index = majorPriority.indexOf(major);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return [...groups.values()]
    .filter((job) => job.questionSources.length > 0)
    .sort(
      (a, b) =>
        b.identity.year - a.identity.year ||
        majorRank(a.identity.major) - majorRank(b.identity.major) ||
        a.identity.major.localeCompare(b.identity.major) ||
        (a.identity.bookletCode ?? "").localeCompare(b.identity.bookletCode ?? "") ||
        a.id.localeCompare(b.id),
    );
}
