import AdmZip from "adm-zip";
import {
  buildBookletPackage,
  buildPackageFiles,
} from "../src/modules/digitizer/package-writer";

describe("digitizer package writer", () => {
  const items = [
    {
      qaStatus: "VERIFIED" as const,
      questionV1: { schema_version: "question.v1", external_id: "q1" },
      reviewRecord: { external_id: "q1" },
      audit: { external_id: "q1", finalStatus: "VERIFIED" },
      taxonomyGaps: [],
    },
    {
      qaStatus: "NEEDS_MANUAL_REVIEW" as const,
      questionV1: null,
      reviewRecord: { external_id: "q2" },
      audit: { external_id: "q2", finalStatus: "NEEDS_MANUAL_REVIEW" },
      taxonomyGaps: ["missing-topic"],
    },
  ];

  it("puts VERIFIED items only in payload.json", () => {
    const files = buildPackageFiles({ items });
    expect(JSON.parse(files["payload.json"])).toEqual({
      items: [{ schema_version: "question.v1", external_id: "q1" }],
    });
    expect(JSON.parse(files["questions_needs_manual_review.json"])).toEqual([
      { external_id: "q2" },
    ]);
  });

  it("writes every required audit file at the ZIP root", () => {
    const buffer = buildBookletPackage({
      items,
      assets: { "q1.png": Buffer.from("image") },
    });
    const zip = new AdmZip(buffer);
    expect(zip.getEntries().map((entry) => entry.entryName).sort()).toEqual([
      "extraction_audit.jsonl",
      "import_report.json",
      "payload.json",
      "q1.png",
      "questions_needs_manual_review.json",
      "questions_verified.jsonl",
      "taxonomy_gaps.json",
    ]);
  });

  it("refuses a VERIFIED item without a question.v1 payload", () => {
    expect(() =>
      buildPackageFiles({
        items: [
          {
            ...items[0],
            questionV1: null,
          },
        ],
      }),
    ).toThrow("VERIFIED item is missing question.v1 payload");
  });
});
