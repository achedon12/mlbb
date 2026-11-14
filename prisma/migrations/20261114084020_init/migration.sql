-- CreateTable
CREATE TABLE "Guild" (
    "id" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(64),
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'en',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" VARCHAR(20) NOT NULL,
    "patchesChannelId" VARCHAR(20),
    "patchesRoleId" VARCHAR(20),
    "patchesFailing" BOOLEAN NOT NULL DEFAULT false,
    "skinsChannelId" VARCHAR(20),
    "skinsRoleId" VARCHAR(20),
    "skinsFailing" BOOLEAN NOT NULL DEFAULT false,
    "eventsChannelId" VARCHAR(20),
    "eventsRoleId" VARCHAR(20),
    "eventsFailing" BOOLEAN NOT NULL DEFAULT false,
    "advanceServerChannelId" VARCHAR(20),
    "advanceServerRoleId" VARCHAR(20),
    "advanceServerFailing" BOOLEAN NOT NULL DEFAULT false,
    "esportsChannelId" VARCHAR(20),
    "esportsRoleId" VARCHAR(20),
    "esportsFailing" BOOLEAN NOT NULL DEFAULT false,
    "dailyMlbbdleChannelId" VARCHAR(20),
    "dailyQuizChannelId" VARCHAR(20),
    "dailyHourUtc" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "silent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "announcementId" INTEGER NOT NULL,
    "guildId" VARCHAR(20) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "messageId" VARCHAR(20),
    "error" VARCHAR(300),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("announcementId","guildId")
);

-- CreateTable
CREATE TABLE "CommandLog" (
    "id" SERIAL NOT NULL,
    "command" VARCHAR(32) NOT NULL,
    "guildId" VARCHAR(20),
    "locale" VARCHAR(8) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyResult" (
    "guildId" VARCHAR(20) NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "game" VARCHAR(16) NOT NULL,
    "discordUserId" VARCHAR(20) NOT NULL,
    "discordUserName" VARCHAR(64) NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("guildId","day","game","discordUserId")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "list" VARCHAR(16) NOT NULL,
    "discordUserId" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guild_leftAt_idx" ON "Guild"("leftAt");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_type_key_key" ON "Announcement"("type", "key");

-- CreateIndex
CREATE INDEX "Delivery_guildId_idx" ON "Delivery"("guildId");

-- CreateIndex
CREATE INDEX "Delivery_sentAt_idx" ON "Delivery"("sentAt");

-- CreateIndex
CREATE INDEX "CommandLog_createdAt_idx" ON "CommandLog"("createdAt");

-- CreateIndex
CREATE INDEX "CommandLog_command_idx" ON "CommandLog"("command");

-- CreateIndex
CREATE INDEX "DailyResult_guildId_game_day_idx" ON "DailyResult"("guildId", "game", "day");

-- CreateIndex
CREATE INDEX "DailyResult_day_idx" ON "DailyResult"("day");

-- CreateIndex
CREATE INDEX "Vote_createdAt_idx" ON "Vote"("createdAt");

-- AddForeignKey
ALTER TABLE "GuildSettings" ADD CONSTRAINT "GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
