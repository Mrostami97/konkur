import type { QuestionV1, QuestionV2 } from "@konkurcom/contracts";
import { Prisma, QuestionKeyState, QuestionQuality } from "@prisma/client";

const KEY_STATE = { normal: QuestionKeyState.NORMAL, deleted: QuestionKeyState.DELETED, positive_effect: QuestionKeyState.POSITIVE_EFFECT } as const;

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
/** What a question already looked like, for keeping a reviewer's verdict. */
export interface ReviewedQuestion {
  stemBlocks: unknown;
  options: unknown;
  correctOption: number;
  acceptedOptions: number[];
  textVerified: boolean;
  keyVerified: boolean;
}

/** Key order does not count: Postgres stores JSONB with its keys reordered. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export async function questionRowFromPayload(
  tx: Prisma.TransactionClient,
  payload: QuestionV1 | QuestionV2,
  existing?: ReviewedQuestion | null,
) {
  const v2 = payload.schema_version === "question.v2" ? payload : null;
  const accepted = v2?.accepted_options ?? [];
  const acceptedOptions = accepted.length > 1 ? [...accepted].sort() : [];
  // A re-import of the archive (the bank rebuilt after other fixes) must not
  // undo a confirmation made in the review queue -- unless this question's
  // own text or key is what changed, which needs looking at again.
  const textUnchanged = !!existing && sameJson(existing.stemBlocks, payload.stem_blocks) && sameJson(existing.options, payload.options);
  const keyUnchanged =
    !!existing && existing.correctOption === payload.correct_option && sameJson(existing.acceptedOptions, v2 ? acceptedOptions : existing.acceptedOptions);
  const textVerified = v2 ? v2.review.text_verified || (textUnchanged && existing!.textVerified) : true;
  const keyVerified = v2 ? v2.review.key_verified || (keyUnchanged && existing!.keyVerified) : true;

  let passageId: string | null = null;
  if (v2?.passage) {
    const passage = await tx.questionPassage.upsert({
      where: { externalId: v2.passage.external_id },
      update: { blocks: v2.passage.blocks as unknown as Prisma.InputJsonValue },
      create: { externalId: v2.passage.external_id, blocks: v2.passage.blocks as unknown as Prisma.InputJsonValue },
    });
    passageId = passage.id;
  }

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
        acceptedOptions,
        keyState: KEY_STATE[v2.key_state ?? "normal"],
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
    // The tagger's own chapter and description travel with the source record.
    source: (v2?.labels ? { ...(payload.source ?? {}), labels: v2.labels } : (payload.source ?? null)) as unknown as Prisma.InputJsonValue,
    provenance: payload.provenance as unknown as Prisma.InputJsonValue,
    // A package may make a question its subject's public sample; without the
    // field the flag stays as the panel set it.
    ...(v2 && typeof v2.sample === "boolean" ? { isSample: v2.sample } : {}),
  };
}

/** Whether `selected` earns the mark: the stored key, or any option the final key also accepts.
 * A question the final key deleted earns nothing for anyone. */
export function isAcceptedAnswer(
  question: { correctOption: number; acceptedOptions?: number[] | null; keyState?: QuestionKeyState },
  selected: number | null | undefined,
) {
  if (selected === null || selected === undefined) return false;
  if (question.keyState === QuestionKeyState.DELETED) return false;
  return selected === question.correctOption || (question.acceptedOptions ?? []).includes(selected);
}
