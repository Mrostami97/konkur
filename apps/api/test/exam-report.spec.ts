import { breakdownOf, konkurPercentOf, rankBoxOf, tarazOf, weightedTaraz, type GradedItem } from "../src/modules/assessment/exam-report";

const item = (questionId: string, sectionId: string | null, subjectCode: string, outcome: GradedItem["outcome"], timeSpentMs = 1000): GradedItem => ({
  questionId,
  sectionId,
  subjectCode,
  outcome,
  timeSpentMs,
});

describe("report card arithmetic", () => {
  it("takes a third of a right answer for every wrong one", () => {
    expect(konkurPercentOf(3, 0, 3)).toBe(100);
    expect(konkurPercentOf(1, 3, 4)).toBe(0);
    expect(konkurPercentOf(0, 3, 3)).toBeCloseTo(-33.33, 1);
    expect(konkurPercentOf(0, 0, 0)).toBe(0);
  });

  it("puts each subject in its konkur section, and none for a dropped subject", () => {
    expect(rankBoxOf("english")).toBe("language");
    expect(rankBoxOf("data-structures-algorithms")).toBe("ds");
    expect(rankBoxOf("operating-systems")).toBe("os");
    expect(rankBoxOf("it-management")).toBeNull();
  });

  it("breaks an attempt down by section and by subject, in section order", () => {
    const sections = [
      { id: "s2", title: "ریاضیات", order: 1, rankBox: "math", coefficient: 2 },
      { id: "s1", title: "زبان", order: 0, rankBox: "language", coefficient: 1 },
      { id: "s3", title: "خالی", order: 2, rankBox: "os", coefficient: 1 },
    ];
    const result = breakdownOf(
      [
        item("q1", "s1", "english", "correct"),
        item("q2", "s1", "english", "wrong"),
        item("q3", "s2", "discrete-math", "correct", 4000),
        item("q4", "s2", "statistics", "blank"),
      ],
      sections,
    );
    expect(result.sections.map((section) => section.title)).toEqual(["زبان", "ریاضیات"]);
    expect(result.sections[0]).toMatchObject({ questions: 2, correct: 1, wrong: 1, blank: 0, coefficient: 1 });
    expect(result.sections[0].percent).toBeCloseTo(33.33, 1);
    expect(result.sections[1]).toMatchObject({ correct: 1, blank: 1, percent: 50, timeSpentMs: 5000 });
    expect(result.subjects.find((subject) => subject.subjectCode === "statistics")).toMatchObject({ questions: 1, blank: 1, percent: 0 });
    expect(result.timeSpentMs).toBe(7000);
  });

  it("treats an exam without sections as one section", () => {
    const result = breakdownOf([item("q1", null, "automata", "correct"), item("q2", null, "automata", "blank")], []);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({ sectionId: null, title: "کل آزمون", percent: 50 });
  });

  it("gives a standard score only with enough participants and some spread", () => {
    const population = [40, 50, 60, 70, 80];
    expect(tarazOf(60, population, 5)).toBe(5000);
    expect(tarazOf(80, population, 5)).toBeGreaterThan(6000);
    expect(tarazOf(60, population, 30)).toBeNull();
    expect(tarazOf(50, [50, 50, 50], 3)).toBeNull();
  });

  it("weights section standard scores by their coefficients, all or nothing", () => {
    expect(weightedTaraz([{ taraz: 5000, coefficient: 1 }, { taraz: 8000, coefficient: 2 }])).toBe(7000);
    expect(weightedTaraz([{ taraz: 5000, coefficient: 1 }, { taraz: null, coefficient: 2 }])).toBeNull();
  });
});
