-- CreateEnum
CREATE TYPE "TuitionType" AS ENUM ('FREE', 'PAID');

-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "degree" "Degree" NOT NULL,
    "field" TEXT NOT NULL,
    "tuitionType" "TuitionType" NOT NULL,
    "hasDormitory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacities" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "quota" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "capacities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choice_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "choice_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choice_list_items" (
    "id" TEXT NOT NULL,
    "choiceListId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "choice_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_estimates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estimatorVersion" TEXT NOT NULL,
    "degree" "Degree" NOT NULL,
    "field" TEXT NOT NULL,
    "quota" TEXT NOT NULL,
    "subjectScores" JSONB NOT NULL,
    "rankMedian" INTEGER NOT NULL,
    "rankP50Low" INTEGER NOT NULL,
    "rankP50High" INTEGER NOT NULL,
    "rankP80Low" INTEGER NOT NULL,
    "rankP80High" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "comparableCount" INTEGER NOT NULL,
    "comparableYears" INTEGER[],
    "sensitivity" JSONB NOT NULL,
    "methodology" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rank_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtest_reports" (
    "id" TEXT NOT NULL,
    "estimatorVersion" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "coverageP50" DOUBLE PRECISION NOT NULL,
    "coverageP80" DOUBLE PRECISION NOT NULL,
    "meanAbsPercentError" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "universities_code_key" ON "universities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "programs_degree_field_idx" ON "programs"("degree", "field");

-- CreateIndex
CREATE UNIQUE INDEX "capacities_programId_examYear_quota_key" ON "capacities"("programId", "examYear", "quota");

-- CreateIndex
CREATE UNIQUE INDEX "choice_lists_userId_key" ON "choice_lists"("userId");

-- CreateIndex
CREATE INDEX "choice_list_items_choiceListId_idx" ON "choice_list_items"("choiceListId");

-- CreateIndex
CREATE UNIQUE INDEX "choice_list_items_choiceListId_programId_key" ON "choice_list_items"("choiceListId", "programId");

-- CreateIndex
CREATE INDEX "rank_estimates_userId_idx" ON "rank_estimates"("userId");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacities" ADD CONSTRAINT "capacities_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choice_lists" ADD CONSTRAINT "choice_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choice_list_items" ADD CONSTRAINT "choice_list_items_choiceListId_fkey" FOREIGN KEY ("choiceListId") REFERENCES "choice_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choice_list_items" ADD CONSTRAINT "choice_list_items_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_estimates" ADD CONSTRAINT "rank_estimates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

