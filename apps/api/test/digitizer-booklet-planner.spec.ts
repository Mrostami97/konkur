import { planBookletJobs } from "../src/modules/digitizer/booklet-planner";
import type { CatalogEntry } from "../src/modules/digitizer/booklet-planner";

describe("planBookletJobs", () => {
  const entries: CatalogEntry[] = [
    {
      sha256: "1".repeat(64),
      role: "question_booklet",
      degree: "master",
      major: "it",
      year: 1403,
      bookletCode: "IT-A",
      originalPath: "it/1403/a.pdf",
      identityVerified: true,
    },
    {
      sha256: "2".repeat(64),
      role: "question_booklet",
      degree: "master",
      major: "computer-engineering",
      year: 1401,
      bookletCode: "CE-X",
      originalPath: "ce/1401/x.pdf",
      identityVerified: true,
    },
    {
      sha256: "3".repeat(64),
      role: "question_booklet",
      degree: "master",
      major: "computer-engineering",
      year: 1403,
      bookletCode: "164C",
      originalPath: "ce/1403/a.pdf",
      identityVerified: true,
    },
    {
      sha256: "4".repeat(64),
      role: "question_booklet",
      degree: "master",
      major: "computer-engineering",
      year: 1403,
      bookletCode: "164C",
      originalPath: "ce/1403/a-mirror.pdf",
      identityVerified: true,
    },
    {
      sha256: "5".repeat(64),
      role: "answer_key",
      degree: "master",
      major: "computer-engineering",
      year: 1403,
      bookletCode: "164C",
      originalPath: "ce/1403/key.pdf",
      identityVerified: true,
    },
    {
      sha256: "6".repeat(64),
      role: "correction",
      degree: "master",
      major: "computer-engineering",
      year: 1403,
      bookletCode: "164C",
      originalPath: "ce/1403/correction.pdf",
      identityVerified: true,
    },
  ];

  it("orders newest year first and respects major priority", () => {
    const jobs = planBookletJobs(entries, ["computer-engineering", "it"]);
    expect(jobs.map((job) => [job.identity.year, job.identity.major])).toEqual([
      [1403, "computer-engineering"],
      [1403, "it"],
      [1401, "computer-engineering"],
    ]);
  });

  it("groups duplicate booklet variants into one logical job", () => {
    const jobs = planBookletJobs(entries, ["computer-engineering", "it"]);
    expect(jobs[0].questionSources).toHaveLength(2);
  });

  it("attaches keys and corrections to the same booklet job", () => {
    const jobs = planBookletJobs(entries, ["computer-engineering", "it"]);
    expect(jobs[0].answerSources).toHaveLength(2);
    expect(jobs[0].answerSources.map((source) => source.role).sort()).toEqual([
      "answer_key",
      "correction",
    ]);
  });

  it("is deterministic across repeated runs", () => {
    expect(planBookletJobs(entries, ["computer-engineering", "it"])).toEqual(
      planBookletJobs(entries, ["computer-engineering", "it"]),
    );
  });

  it("refuses filename-inferred or otherwise unverified exam identity", () => {
    expect(() =>
      planBookletJobs([{ ...entries[0], identityVerified: false }]),
    ).toThrow("Unverified catalog identity");
  });
});
