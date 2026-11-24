-- Player progress kept on the account (favourite heroes, daily game stats
-- and streaks, reminders), and the opt-in public progress page.
-- CreateTable
CREATE TABLE "PlayerSync" (
    "accountId" VARCHAR(24) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSync_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "accountId" VARCHAR(24) NOT NULL,
    "slug" VARCHAR(16) NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "fields" VARCHAR(16)[] DEFAULT ARRAY[]::VARCHAR(16)[],
    "displayName" VARCHAR(40),
    "avatar" VARCHAR(200),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("accountId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_slug_key" ON "PlayerProfile"("slug");
