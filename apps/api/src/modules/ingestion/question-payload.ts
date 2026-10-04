import type { QuestionV1, QuestionV2 } from "@konkurcom/contracts";
import { Prisma, QuestionQuality } from "@prisma/client";

/**
 * GOLD: text and key checked against the booklet, and a worked solution.
 * SILVER: checked, no solution yet. DRAFT: something still unchecked -- kept
 * in the admin review queue and out of every student-facing read.
 */
export function qualityTierOf(question: { textVerified: boolean; keyVerified: boolean; solutionBlocks: unknown }): QuestionQuality {
  if (!question.textVerified || !question.keyVerified) return QuestionQuality.DRAFT;
  const solution = question.solutionBlocks;
  return Array.isArray(solution) && solution.length > 0 ? QuestionQuality.GOLD : QuestionQuality.SILVER;
}

/**
 * The question row a published payload becomes, for both contract versions.
 * A v1 payload is staff-authored with a solution, so it counts as checked; a
 * v2 payload says itself how far it was checked. A shared passage is stored
 * once by its external id and linked.
 */
export async function questionRowFromPayload(tx: Prisma.TransactionClient, payload: QuestionV1 | QuestionV2) {
  const v2 = payload.schema_version === "question.v2" ? payload : null;
  const textVerified = v2 ? v2.review.text_verified : true;
  const keyVerified = v2 ? v2.review.key_verified : true;

  let passageId: string | null = null;
  if (v2?.passage) {
    const passage = await tx.questionPassage.upsert({
      where: { externalId: v2.passage.external_id },
      update: { blocks: v2.passage.blocks as unknown as Prisma.InputJsonValue },
      create: { externalId: v2.passage.external_id, blocks: v2.passage.blocks as unknown as Prisma.InputJsonValue },
    });
    passageId = passage.id;
  }

  const accepted = v2?.accepted_options ?? [];
  // A v1 payload (a staff edit in the panel) knows nothing of the booklet
  // slot, passage or extra accepted keys: it leaves them as they are rather
  // than wiping what the archive import recorded.
  const archive = v2
    ? {
        examCode: v2.exam.code ?? null,
        bookletNumber: v2.slot?.booklet ?? null,
        questionNumber: v2.slot?.number ?? null,
        sectionTitle: v2.slot?.section ?? null,
        passageId,
        // Only worth storing when the key accepts more than the one option.
        acceptedOptions: accepted.length > 1 ? [...accepted].sort() : [],
      }
    : {};
  return {
    examDegree: payload.exam.degree.toUpperCase() as "MASTER" | "PHD",
    examMajor: payload.exam.major,
    examYear: payload.exam.year,
    ...archive,
    subjectCode: payload.subject_code,
    topicCodes: payload.topic_codes,
    stemBlocks: payload.stem_blocks as unknown as Prisma.InputJsonValue,
    options: payload.options as unknown as Prisma.InputJsonValue,
    correctOption: payload.correct_option,
    solutionBlocks: payload.solution_blocks as unknown as Prisma.InputJsonValue,
    textVerified,
    keyVerified,
    qualityTier: qualityTierOf({ textVerified, keyVerified, solutionBlocks: payload.solution_blocks }),
    assets: (payload.assets ?? []) as unknown as Prisma.InputJsonValue,
    source: (payload.source ?? null) as unknown as Prisma.InputJsonValue,
    provenance: payload.provenance as unknown as Prisma.InputJsonValue,
  };
}

/** Whether `selected` earns the mark: the stored key, or any option the final key also accepts. */
export function isAcceptedAnswer(question: { correctOption: number; acceptedOptions?: number[] | null }, selected: number | null | undefined) {
  if (selected === null || selected === undefined) return false;
  return selected === question.correctOption || (question.acceptedOptions ?? []).includes(selected);
}
