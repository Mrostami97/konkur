import { canonicalGoalField, startOfStudyDay } from "../src/modules/planning/planning.service";

describe("Phase 16 planning helpers", () => {
  it.each([
    ["مهندسی کامپیوتر", "computer-engineering"],
    ["مهندسی فناوری‌اطلاعات", "information-technology"],
    ["علوم كامپيوتر", "computer-science"],
    ["computer_science", "computer-science"],
  ])("normalizes %s to canonical taxonomy field %s", (input, expected) => {
    expect(canonicalGoalField(input)).toBe(expected);
  });

  it("uses Tehran midnight independently from the server timezone", () => {
    expect(startOfStudyDay(new Date("2026-09-12T12:00:00.000Z")).toISOString())
      .toBe("2026-09-11T20:30:00.000Z");
    expect(startOfStudyDay(new Date("2026-09-11T20:29:59.000Z")).toISOString())
      .toBe("2026-09-10T20:30:00.000Z");
  });
});
