import AdmZip from "adm-zip";
import type { QaStatus } from "./types";

export interface PackageItem {
  qaStatus: QaStatus;
  questionV1: unknown | null;
  reviewRecord: unknown;
  audit: unknown;
  taxonomyGaps: string[];
}

export interface BookletPackageInput {
  items: PackageItem[];
  assets?: Record<string, Buffer>;
}

function jsonl(values: unknown[]): string {
  return values.length > 0
    ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
    : "";
}

export function buildPackageFiles(
  input: Pick<BookletPackageInput, "items">,
): Record<string, string> {
  const verified = input.items.filter((item) => item.qaStatus === "VERIFIED");
  for (const item of verified) {
    if (item.questionV1 == null) {
      throw new Error("VERIFIED item is missing question.v1 payload");
    }
  }

  const manual = input.items.filter(
    (item) => item.qaStatus === "NEEDS_MANUAL_REVIEW",
  );
  const rejected = input.items.filter((item) => item.qaStatus === "REJECTED");
  const taxonomyGaps = [
    ...new Set(input.items.flatMap((item) => item.taxonomyGaps)),
  ].sort();

  return {
    "payload.json": JSON.stringify(
      { items: verified.map((item) => item.questionV1) },
      null,
      2,
    ),
    "questions_verified.jsonl": jsonl(
      verified.map((item) => item.questionV1),
    ),
    "questions_needs_manual_review.json": JSON.stringify(
      manual.map((item) => item.reviewRecord),
      null,
      2,
    ),
    "extraction_audit.jsonl": jsonl(input.items.map((item) => item.audit)),
    "taxonomy_gaps.json": JSON.stringify(taxonomyGaps, null, 2),
    "import_report.json": JSON.stringify(
      {
        total: input.items.length,
        verified: verified.length,
        needsManualReview: manual.length,
        rejected: rejected.length,
      },
      null,
      2,
    ),
  };
}

export function buildBookletPackage(input: BookletPackageInput): Buffer {
  const zip = new AdmZip();
  const files = buildPackageFiles(input);

  for (const filename of Object.keys(files).sort()) {
    zip.addFile(filename, Buffer.from(files[filename], "utf-8"));
  }

  for (const filename of Object.keys(input.assets ?? {}).sort()) {
    zip.addFile(filename, input.assets?.[filename] ?? Buffer.alloc(0));
  }

  return zip.toBuffer();
}
