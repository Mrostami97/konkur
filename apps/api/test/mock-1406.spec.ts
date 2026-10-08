import { blueprint1406, mockDuration, pick, splitEvenly, type Candidate } from "../src/modules/assessment/mock-1406";

describe("1406 mock blueprint", () => {
  it("gives computer engineering 25 language, 20 maths and ten from each of seven specialised subjects", () => {
    const sections = blueprint1406("1277", () => true);
    expect(sections.map((section) => [section.title, section.coefficient])).toEqual([
      ["زبان عمومی و تخصصی", 1],
      ["ریاضیات", 2],
      ["دروس تخصصی", 4],
    ]);
    expect(sections[0].subjects).toEqual([{ code: "english", count: 25 }]);
    expect(sections[1].subjects.reduce((sum, subject) => sum + subject.count, 0)).toBe(20);
    expect(sections[2].subjects).toHaveLength(7);
    expect(sections[2].subjects.every((subject) => subject.count === 10)).toBe(true);
  });

  it("splits maths over the subjects the bank has: no linear algebra yet, so ten and ten", () => {
    const sections = blueprint1406("1277", (code) => code !== "linear-algebra");
    expect(sections[1].subjects).toEqual([
      { code: "discrete-math", count: 10 },
      { code: "statistics", count: 10 },
    ]);
  });

  it("gives IT six specialised subjects, networks and databases among them", () => {
    const specialised = blueprint1406("1276", () => true)[2].subjects.map((subject) => subject.code);
    expect(specialised).toHaveLength(6);
    expect(specialised).toEqual(expect.arrayContaining(["computer-networks", "databases"]));
    expect(specialised).not.toContain("digital-logic");
  });

  it("splits evenly with the remainder up front", () => {
    expect(splitEvenly(20, ["a", "b", "c"]).map((row) => row.count)).toEqual([7, 7, 6]);
  });

  it("allows about 1.2 minutes a question, rounded up to five", () => {
    expect(mockDuration(115)).toBe(140);
    expect(mockDuration(105)).toBe(130);
  });
});

describe("picking questions", () => {
  const question = (id: string, passageId: string | null = null, examYear = 1400): Candidate => ({ id, subjectCode: "english", passageId, examYear });
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  it("never splits a reading passage", () => {
    const pool = [question("p1a", "P1"), question("p1b", "P1"), question("p1c", "P1"), question("s1"), question("s2")];
    const chosen = pick(pool, 4, new Set(), random).map((item) => item.id);
    expect(chosen).toHaveLength(4);
    const fromPassage = chosen.filter((id) => id.startsWith("p1"));
    expect([0, 3]).toContain(fromPassage.length);
  });

  it("takes questions no earlier mock used before used ones", () => {
    const pool = ["a", "b", "c", "d"].map((id) => question(id));
    const chosen = pick(pool, 2, new Set(["a", "b"]), random).map((item) => item.id).sort();
    expect(chosen).toEqual(["c", "d"]);
  });

  it("returns what there is when the bank is short", () => {
    expect(pick([question("a")], 5, new Set(), random)).toHaveLength(1);
  });
});
