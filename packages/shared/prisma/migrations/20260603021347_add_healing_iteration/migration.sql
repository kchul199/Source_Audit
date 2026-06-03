-- CreateTable
CREATE TABLE "HealingIteration" (
    "id" TEXT NOT NULL,
    "testResultId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "testCode" TEXT NOT NULL,
    "exitCode" INTEGER,
    "stdout" TEXT,
    "stderr" TEXT,
    "errorAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealingIteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealingIteration_testResultId_idx" ON "HealingIteration"("testResultId");

-- AddForeignKey
ALTER TABLE "HealingIteration" ADD CONSTRAINT "HealingIteration_testResultId_fkey" FOREIGN KEY ("testResultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
