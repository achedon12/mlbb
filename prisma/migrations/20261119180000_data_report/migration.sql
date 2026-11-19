-- Visitors' reports of wrong data on the data pages, anonymous: the page,
-- its language and what was typed, nothing else.
-- CreateTable
CREATE TABLE "DataReport" (
    "id" SERIAL NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "locale" VARCHAR(8) NOT NULL,
    "text" VARCHAR(1000) NOT NULL,
    "correction" VARCHAR(300),
    "source" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(20),

    CONSTRAINT "DataReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataReport_resolvedAt_createdAt_idx" ON "DataReport"("resolvedAt", "createdAt");
