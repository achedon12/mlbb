-- DropIndex
DROP INDEX "CommandLog_command_idx";

-- DropIndex
DROP INDEX "Delivery_guildId_idx";

-- CreateIndex
CREATE INDEX "Delivery_guildId_sentAt_idx" ON "Delivery"("guildId", "sentAt");

-- CreateIndex
CREATE INDEX "Guild_joinedAt_idx" ON "Guild"("joinedAt");

-- CreateIndex
CREATE INDEX "GuildSettings_dailyHourUtc_idx" ON "GuildSettings"("dailyHourUtc");
