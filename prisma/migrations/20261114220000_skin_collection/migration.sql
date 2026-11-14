-- CreateTable
CREATE TABLE "SkinCollection" (
    "accountId" VARCHAR(24) NOT NULL,
    "heroes" VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR(40)[],
    "skins" VARCHAR(16)[] DEFAULT ARRAY[]::VARCHAR(16)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkinCollection_pkey" PRIMARY KEY ("accountId")
);
