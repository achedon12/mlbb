-- Discord profile card for the bot's /profile (src/lib/discord-profile): the
-- link between a Discord account and a game account, both hashed, and the
-- player's figures as saved at the last refresh.
-- CreateTable
CREATE TABLE "ProfileCard" (
    "discordKey" VARCHAR(24) NOT NULL,
    "accountId" VARCHAR(24) NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "showId" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileCard_pkey" PRIMARY KEY ("discordKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfileCard_accountId_key" ON "ProfileCard"("accountId");

-- CreateIndex
CREATE INDEX "ProfileCard_snapshotAt_idx" ON "ProfileCard"("snapshotAt");
