import { Degree } from "@prisma/client";
import { PrismaService } from "../src/prisma/prisma.service";
import { AnalyticsService } from "../src/modules/analytics/analytics.service";
import { ContentDiscoveryService } from "../src/modules/content/content-discovery.service";

function report(rank: number, extra: Record<string, unknown> = {}) {
  return {
    examYear: 1405,
    degree: Degree.MASTER,
    field: "computer-engineering",
    quota: "region-1",
    subjectScores: [{ subject_code: "algorithms", percent: 70, student_name: "private" }],
    rank: { value: rank, scope: "quota", owner: "private" },
    admissions: [
      { program_code: "official-program", status: "accepted", evidence_url: "private" },
      { program_code: "unverified-private-program", status: "accepted" },
    ],
    ...extra,
  };
}

describe("Phase 15 public-data safeguards", () => {
  it("allowlists public report-card fields and suppresses small-cohort aggregates", async () => {
    const prisma = {
      reportCard: { findMany: jest.fn().mockResolvedValue([20, 30, 40, 50].map((rank) => report(rank))) },
      program: {
        findMany: jest.fn().mockResolvedValue([{
          code: "official-program",
          title: "نرم‌افزار",
          university: { code: "official-university", title: "دانشگاه رسمی" },
        }]),
      },
    } as unknown as PrismaService;
    const service = new ContentDiscoveryService(prisma);

    const result = await service.listPublicReportCards({ page: 1, limit: 50 });

    expect(result.total).toBe(4);
    expect(result.cohort.aggregate).toBeNull();
    expect(result.cohort.minimumSampleSize).toBe(5);
    expect(result.items[0]).toEqual({
      examYear: 1405,
      degree: Degree.MASTER,
      field: "computer-engineering",
      quota: "region-1",
      subjectScores: [{ subject_code: "algorithms", percent: 70 }],
      rank: { value: 20, scope: "quota" },
      admissions: [{
        program_code: "official-program",
        status: "accepted",
        program: {
          code: "official-program",
          title: "نرم‌افزار",
          university: { code: "official-university", title: "دانشگاه رسمی" },
        },
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(/student_name|owner|evidence_url|private/);
  });

  it("publishes an explicitly labelled empirical interval at five records", async () => {
    const prisma = {
      reportCard: { findMany: jest.fn().mockResolvedValue([20, 30, 40, 50, 60].map((rank) => report(rank))) },
      program: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new ContentDiscoveryService(prisma);

    const result = await service.listPublicReportCards({ page: 1, limit: 50 });

    expect(result.cohort.aggregate).toMatchObject({
      rankMedian: 40,
      intervalKind: "EMPIRICAL_CENTRAL_80",
    });
    expect(result.cohort.aggregate?.intervalNote).toContain("فاصلهٔ اطمینان آماری");
    expect(result.cohort.dataYears).toEqual([1405]);
  });

  it("returns no acceptance rate below five applicants and a Wilson interval at five", async () => {
    const prisma = {
      program: {
        findFirst: jest.fn().mockResolvedValue({
          id: "program-id",
          code: "official-program",
          degree: Degree.MASTER,
          field: "computer-engineering",
        }),
      },
      rankEstimate: {
        findFirst: jest.fn().mockResolvedValue({
          degree: Degree.MASTER,
          field: "computer-engineering",
          quota: "region-1",
          rankP80Low: 1,
          rankP80High: 100,
        }),
      },
      reportCard: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const service = new AnalyticsService(prisma);
    const applicants = [20, 30, 40, 50, 60].map((rank, index) => ({
      examYear: 1405,
      rank: { value: rank },
      admissions: [{ program_code: "official-program", status: index < 3 ? "accepted" : "rejected" }],
    }));

    (prisma.reportCard.findMany as jest.Mock).mockResolvedValueOnce(applicants.slice(0, 4));
    const small = await service.getAcceptanceChance("user-id", "program-id");
    expect(small).toMatchObject({ chance: null, interval: null, sampleSize: 4, minimumSampleSize: 5 });

    (prisma.reportCard.findMany as jest.Mock).mockResolvedValueOnce(applicants);
    const sufficient = await service.getAcceptanceChance("user-id", "program-id");
    expect(sufficient.chance).toBe(0.6);
    expect(sufficient.interval).toMatchObject({ level: 0.95, method: "WILSON_SCORE" });
    expect(sufficient.interval?.low).toBeLessThan(sufficient.chance ?? 0);
    expect(sufficient.interval?.high).toBeGreaterThan(sufficient.chance ?? 1);
  });
});
