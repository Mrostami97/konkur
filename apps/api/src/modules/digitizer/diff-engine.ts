import type {
  CandidateBlock,
  CandidateQuestion,
  DigitizerReasonCode,
} from "./types";

export interface CandidateDiff {
  materialAgreement: boolean;
  reasonCodes: DigitizerReasonCode[];
  differences: Array<{ field: string; left: string; right: string }>;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function blockValue(block: CandidateBlock): string {
  switch (block.type) {
    case "text":
      return normalizeWhitespace(block.text);
    case "latex":
      return normalizeWhitespace(block.latex);
    case "image":
      return `${block.mediaKey}|${normalizeWhitespace(block.alt ?? "")}`;
    case "table":
      return JSON.stringify(block.rows.map((row) => row.map(normalizeWhitespace)));
  }
}

function compareBlocks(
  field: string,
  left: CandidateBlock[],
  right: CandidateBlock[],
  textReason: DigitizerReasonCode,
  reasons: Set<DigitizerReasonCode>,
  differences: CandidateDiff["differences"],
): void {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!a || !b || a.type !== b.type || blockValue(a) !== blockValue(b)) {
      const reason: DigitizerReasonCode =
        a?.type === "latex" || b?.type === "latex"
          ? "FORMULA_MATERIAL_DIFF"
          : textReason;
      reasons.add(reason);
      differences.push({
        field: `${field}[${index}]`,
        left: a ? `${a.type}:${blockValue(a)}` : "<missing>",
        right: b ? `${b.type}:${blockValue(b)}` : "<missing>",
      });
    }
  }
}

export function compareCandidates(
  left: CandidateQuestion,
  right: CandidateQuestion,
): CandidateDiff {
  const reasons = new Set<DigitizerReasonCode>();
  const differences: CandidateDiff["differences"] = [];

  compareBlocks(
    "stemBlocks",
    left.stemBlocks,
    right.stemBlocks,
    "STEM_MATERIAL_DIFF",
    reasons,
    differences,
  );

  const leftOrder = left.options.map((option) => option.number).join(",");
  const rightOrder = right.options.map((option) => option.number).join(",");
  if (leftOrder !== rightOrder) {
    reasons.add("OPTION_ORDER_DIFF");
    differences.push({ field: "options.order", left: leftOrder, right: rightOrder });
  }

  const byNumber = (candidate: CandidateQuestion, number: 1 | 2 | 3 | 4) =>
    candidate.options.find((option) => option.number === number);

  for (const number of [1, 2, 3, 4] as const) {
    const a = byNumber(left, number);
    const b = byNumber(right, number);
    if (!a || !b) {
      reasons.add("OPTION_MATERIAL_DIFF");
      differences.push({
        field: `options.${number}`,
        left: a ? "present" : "<missing>",
        right: b ? "present" : "<missing>",
      });
      continue;
    }

    compareBlocks(
      `options.${number}.blocks`,
      a.blocks,
      b.blocks,
      "OPTION_MATERIAL_DIFF",
      reasons,
      differences,
    );
  }

  return {
    materialAgreement: reasons.size === 0,
    reasonCodes: [...reasons],
    differences,
  };
}
