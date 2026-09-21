-- Phase 17 (doc/roadmap/LEARNING_GROWTH_ACCESS_AND_AEO.md §2-3): subject-scoped
-- Question Bank commerce grants, plus an admin-set sample flag on Question so
-- public pages can show a real, curated, fully-public preview instead of
-- every historical question. Purely additive.

ALTER TYPE "ProductKind" ADD VALUE 'QUESTION_BANK';

-- Admin-set flag (not auto-selected). Defaults to false: every existing row
-- stays gated until an admin deliberately marks it a sample.
ALTER TABLE "questions" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "questions_subjectCode_isSample_idx" ON "questions"("subjectCode", "isSample");

-- Scoped by subjectCode (a plain string), matching Question.subjectCode --
-- not a Subject.id foreign key. See the model comment in schema.prisma.
CREATE TABLE "product_question_bank_grants" (
    "productId" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,

    CONSTRAINT "product_question_bank_grants_pkey" PRIMARY KEY ("productId", "subjectCode")
);

CREATE INDEX "product_question_bank_grants_subjectCode_idx" ON "product_question_bank_grants"("subjectCode");

ALTER TABLE "product_question_bank_grants" ADD CONSTRAINT "product_question_bank_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
